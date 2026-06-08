#!/usr/bin/env python3
"""
Business Site Searcher
Finds local businesses with 3.7+ star ratings and no website on Google Maps,
sorted by opportunity score (reviews × rating weight — missing info penalty).
"""

import argparse
import csv
import os
import sys
import time
from dataclasses import dataclass, field, fields
from typing import Optional

import requests

PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

MIN_RATING = 3.7


@dataclass
class Business:
    name: str
    rating: float
    user_ratings_total: int
    phone: str
    address: str
    place_id: str
    types: str
    opportunity_score: float = 0.0
    maps_url: str = ""

    def compute_score(self):
        """
        Opportunity score formula:
          base     = rating × log10(reviews + 1)   — rewards high-rated, well-reviewed places
          penalty  = missing phone (-20) + missing address (-10)
        Higher = better opportunity (established business, easy to contact).
        """
        import math
        base = self.rating * math.log10(self.user_ratings_total + 1)
        penalty = 0
        if not self.phone:
            penalty += 20
        if not self.address:
            penalty += 10
        self.opportunity_score = round(base - penalty, 3)


def geocode_location(api_key: str, location_str: str) -> tuple[float, float]:
    resp = requests.get(GEOCODE_URL, params={"address": location_str, "key": api_key})
    resp.raise_for_status()
    data = resp.json()
    if data["status"] != "OK":
        print(f"[ERROR] Could not geocode '{location_str}': {data['status']}")
        sys.exit(1)
    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]


def fetch_place_details(api_key: str, place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,formatted_address,website,url",
        "key": api_key,
    }
    resp = requests.get(PLACES_DETAILS_URL, params=params)
    resp.raise_for_status()
    return resp.json().get("result", {})


def search_businesses(
    api_key: str,
    lat: float,
    lng: float,
    radius_m: int,
    keyword: Optional[str],
    max_results: int,
) -> list[Business]:
    results = []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "key": api_key,
    }
    if keyword:
        params["keyword"] = keyword

    fetched = 0
    page = 0
    next_page_token = None

    while fetched < max_results:
        if next_page_token:
            params = {"pagetoken": next_page_token, "key": api_key}
            time.sleep(2)  # Google requires a short delay before using page tokens

        resp = requests.get(PLACES_NEARBY_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            print(f"[ERROR] Places API: {status} — {data.get('error_message', '')}")
            break

        for place in data.get("results", []):
            if fetched >= max_results:
                break

            rating = place.get("rating", 0)
            reviews = place.get("user_ratings_total", 0)

            if rating < MIN_RATING:
                continue

            place_id = place["place_id"]
            details = fetch_place_details(api_key, place_id)

            # Skip businesses that already have a website
            if details.get("website"):
                continue

            business = Business(
                name=place.get("name", ""),
                rating=rating,
                user_ratings_total=reviews,
                phone=details.get("formatted_phone_number", ""),
                address=details.get("formatted_address", place.get("vicinity", "")),
                place_id=place_id,
                types=", ".join(place.get("types", [])),
                maps_url=details.get("url", f"https://www.google.com/maps/place/?q=place_id:{place_id}"),
            )
            business.compute_score()
            results.append(business)
            fetched += 1
            print(f"  [{fetched}] {business.name} ★{rating} ({reviews} reviews) — score {business.opportunity_score}")

        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break
        page += 1

    return results


def write_csv(businesses: list[Business], output_path: str):
    if not businesses:
        print("[INFO] No results to write.")
        return

    sorted_list = sorted(businesses, key=lambda b: b.opportunity_score, reverse=True)

    cols = ["opportunity_score", "name", "rating", "user_ratings_total",
            "phone", "address", "types", "maps_url", "place_id"]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        for b in sorted_list:
            writer.writerow({c: getattr(b, c) for c in cols})

    print(f"\n[DONE] {len(sorted_list)} businesses saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Find local businesses with 3.7+ stars and no website — sorted by opportunity."
    )
    parser.add_argument("location", help='City or address to search near, e.g. "Austin, TX"')
    parser.add_argument("--radius", type=int, default=5000, help="Search radius in meters (default: 5000)")
    parser.add_argument("--keyword", default=None, help='Optional keyword filter, e.g. "restaurant" or "salon"')
    parser.add_argument("--max", type=int, default=60, help="Max businesses to scan (default: 60, max: 180)")
    parser.add_argument("--output", default="leads.csv", help="Output CSV filename (default: leads.csv)")
    parser.add_argument("--api-key", default=None, help="Google Places API key (or set GOOGLE_PLACES_API_KEY env var)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        print("[ERROR] No API key provided.")
        print("  Set it via --api-key YOUR_KEY or export GOOGLE_PLACES_API_KEY=YOUR_KEY")
        print("\nTo get a free API key:")
        print("  1. Go to https://console.cloud.google.com/")
        print("  2. Create a project → Enable 'Places API' and 'Geocoding API'")
        print("  3. Go to APIs & Services → Credentials → Create API Key")
        print("  4. Restrict the key to 'Places API' + 'Geocoding API' for safety")
        sys.exit(1)

    max_results = min(args.max, 180)

    print(f"\nSearching near: {args.location}")
    print(f"Radius: {args.radius}m | Min rating: {MIN_RATING} | Keyword: {args.keyword or 'any'}")
    print(f"Scanning up to {max_results} candidates...\n")

    lat, lng = geocode_location(api_key, args.location)
    businesses = search_businesses(api_key, lat, lng, args.radius, args.keyword, max_results)
    write_csv(businesses, args.output)


if __name__ == "__main__":
    main()
