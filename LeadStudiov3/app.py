#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LeadStudio — local control panel for finding website-less businesses,
generating a unique demo site for each, and drafting a personalized
pitch email (with intake questions, no prices).

Zero dependencies. Python 3.8+ standard library only.

    python3 app.py            # then open http://localhost:8000

Data lives in ./data (leads + your studio settings).
Generated demo sites land in ./output/<business-slug>/index.html
"""

import json
import os
import re
import sys
import time
import base64
import hashlib
import threading
import webbrowser
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(ROOT, "ui")
DATA_DIR = os.path.join(ROOT, "data")
OUTPUT_DIR = os.path.join(ROOT, "output")
TEMPLATE = os.path.join(ROOT, "templates_src", "lumen.html")
LEADS_FILE = os.path.join(DATA_DIR, "leads.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

for d in (DATA_DIR, OUTPUT_DIR):
    os.makedirs(d, exist_ok=True)

USER_AGENT = "LeadStudio/1.0 (local prospecting tool)"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_CTYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


def guess_ctype(path):
    return _CTYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream")

# ─────────────────────────────────────────────────────────────────────────────
# Small JSON store helpers
# ─────────────────────────────────────────────────────────────────────────────
_lock = threading.Lock()


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


DEFAULT_SETTINGS = {
    "studio_name": "Your Studio",
    "operator_name": "Your Name",
    "operator_email": "you@email.com",
    "operator_phone": "+1 (000) 000-0000",
    "booking_url": "",            # Calendly / Cal.com link
    "formsubmit_email": "you@email.com",  # where website leads are sent
    "signature": "",              # extra email sign-off line
}


def get_settings():
    s = dict(DEFAULT_SETTINGS)
    s.update(load_json(SETTINGS_FILE, {}))
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Geocoding + Overpass search (free, no API key)
# ─────────────────────────────────────────────────────────────────────────────
def _get(url, params=None, headers=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def _post(url, data, headers=None):
    body = data.encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8")


def geocode(location):
    raw = _get(NOMINATIM_URL, {"q": location, "format": "json", "limit": 1})
    data = json.loads(raw)
    if not data:
        return None
    return {
        "lat": float(data[0]["lat"]),
        "lon": float(data[0]["lon"]),
        "display_name": data[0]["display_name"],
    }


# Human labels for common OSM tags
CATEGORY_LABELS = {
    "restaurant": "Restaurant", "cafe": "Café", "bar": "Bar", "pub": "Pub",
    "fast_food": "Eatery", "bakery": "Bakery", "ice_cream": "Ice Cream Shop",
    "hairdresser": "Hair Salon", "beauty": "Beauty Salon", "spa": "Spa",
    "car_repair": "Auto Shop", "florist": "Florist", "butcher": "Butcher",
    "clothes": "Boutique", "shoes": "Shoe Store", "jewelry": "Jeweler",
    "dentist": "Dental Practice", "doctors": "Clinic", "veterinary": "Vet Clinic",
    "pharmacy": "Pharmacy", "gym": "Gym", "fitness_centre": "Fitness Studio",
    "pet": "Pet Store", "hardware": "Hardware Store", "books": "Bookshop",
    "deli": "Deli", "greengrocer": "Grocer", "optician": "Optician",
    "massage": "Massage Studio", "tattoo": "Tattoo Studio", "laundry": "Laundry",
    "car_wash": "Car Wash", "photo": "Photo Studio", "travel_agency": "Travel Agency",
}


def category_label(tags):
    for key in ("amenity", "shop", "craft", "office", "leisure", "tourism"):
        v = tags.get(key)
        if v:
            return CATEGORY_LABELS.get(v, v.replace("_", " ").title())
    return "Local Business"


def opportunity_score(name, phone, address, has_category):
    """Higher = better lead. More complete info = easier to reach & pitch."""
    score = 30                      # has a name (required)
    if phone:
        score += 40
    if address:
        score += 30
    return score


# Amenity values that are NOT sales prospects (civic, infrastructure, etc.)
NON_COMMERCIAL_AMENITIES = {
    "school", "kindergarten", "college", "university", "library", "place_of_worship",
    "hospital", "clinic", "townhall", "public_building", "courthouse", "police",
    "fire_station", "post_office", "prison", "bench", "waste_basket", "recycling",
    "parking", "parking_space", "bicycle_parking", "fountain", "drinking_water",
    "toilets", "shelter", "grave_yard", "fuel", "charging_station", "atm",
    "vending_machine", "bus_station", "taxi", "ferry_terminal", "social_facility",
    "community_centre", "social_centre", "townhall", "bank",
}


def overpass_search(location, radius_m, keyword, max_results):
    geo = geocode(location)
    if not geo:
        return {"error": f"Could not find location: {location}"}
    lat, lon = geo["lat"], geo["lon"]

    # Build a tag filter. Keyword maps to amenity OR shop value when given.
    if keyword:
        k = keyword.strip().lower().replace(" ", "_")
        filt = f'["amenity"="{k}"]'
        shop_filt = f'["shop"="{k}"]'
        selectors = [
            f'node{filt}(around:{radius_m},{lat},{lon});',
            f'way{filt}(around:{radius_m},{lat},{lon});',
            f'node{shop_filt}(around:{radius_m},{lat},{lon});',
            f'way{shop_filt}(around:{radius_m},{lat},{lon});',
        ]
    else:
        selectors = [
            f'node["amenity"](around:{radius_m},{lat},{lon});',
            f'way["amenity"](around:{radius_m},{lat},{lon});',
            f'node["shop"](around:{radius_m},{lat},{lon});',
            f'way["shop"](around:{radius_m},{lat},{lon});',
        ]
    query = f"[out:json][timeout:60];({''.join(selectors)});out center;"

    try:
        raw = _post(OVERPASS_URL, query)
    except Exception as e:
        return {"error": f"Search service error: {e}. Try again in a moment."}

    try:
        elements = json.loads(raw).get("elements", [])
    except Exception:
        return {"error": "Unexpected response from search service. Try again."}

    leads = []
    seen = set()
    for el in elements:
        tags = el.get("tags", {})
        # Skip anything that already has a website
        if tags.get("website") or tags.get("contact:website") or tags.get("url"):
            continue
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        # When doing a broad (no-keyword) search, skip civic/infrastructure amenities
        amen = tags.get("amenity", "")
        if not keyword and amen in NON_COMMERCIAL_AMENITIES and not tags.get("shop"):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)

        phone = tags.get("phone") or tags.get("contact:phone") or tags.get("telephone") or ""
        addr_parts = [tags.get("addr:housenumber", ""), tags.get("addr:street", ""),
                      tags.get("addr:city", ""), tags.get("addr:postcode", "")]
        address = " ".join(p for p in addr_parts if p).strip()
        city = tags.get("addr:city", "") or location.split(",")[0].strip()
        cat = category_label(tags)
        email = tags.get("email") or tags.get("contact:email") or ""
        osm_id = el.get("id")
        osm_type = el.get("type", "node")

        leads.append({
            "id": hashlib.md5(f"{osm_type}{osm_id}{name}".encode()).hexdigest()[:10],
            "name": name,
            "category": cat,
            "category_raw": tags.get("amenity") or tags.get("shop") or "",
            "phone": phone,
            "email": email,
            "address": address,
            "city": city,
            "hours": tags.get("opening_hours", ""),
            "score": opportunity_score(name, phone, address, bool(cat)),
            "lat": el.get("lat") or (el.get("center", {}) or {}).get("lat", lat),
            "lon": el.get("lon") or (el.get("center", {}) or {}).get("lon", lon),
            "osm_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "maps_url": f"https://www.google.com/maps/search/{urllib.parse.quote(name + ' ' + city)}",
            "status": "new",
            "notes": "",
            "site_generated": False,
        })

    # Sort by opportunity FIRST, then keep the best `max_results`.
    leads.sort(key=lambda b: b["score"], reverse=True)
    leads = leads[:max_results]
    return {"location": geo["display_name"], "count": len(leads), "leads": leads}


# ─────────────────────────────────────────────────────────────────────────────
# Unique-per-business styling (deterministic from name)
# ─────────────────────────────────────────────────────────────────────────────
PALETTES = [
    # accent, deep, soft, tint
    ("#2f6df0", "#1f4fc0", "#7aa3f7", "#eaf1fe"),  # blue
    ("#e8632f", "#bf471a", "#f29a72", "#fdeee6"),  # terracotta
    ("#159a6b", "#0c7350", "#5fc39c", "#e7f6ef"),  # emerald
    ("#8b4fd6", "#6c34b0", "#b78ce7", "#f2ebfb"),  # violet
    ("#d4365f", "#ad2349", "#e87f9c", "#fcebf0"),  # rose
    ("#0f9bbd", "#0a7a96", "#5cc4dc", "#e6f6fa"),  # teal
    ("#c98a16", "#a06d0c", "#e0b35a", "#fbf3e1"),  # amber/gold
    ("#3b5bdb", "#2942b5", "#8197ec", "#eceffd"),  # indigo
]
FONT_PAIRS = [
    # import link, display family, body family
    ('<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />',
     '"Fraunces", Georgia, serif', '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
    ('<link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />',
     '"Sora", -apple-system, sans-serif', '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
    ('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />',
     '"Playfair Display", Georgia, serif', '"Source Sans 3", -apple-system, sans-serif'),
    ('<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />',
     '"Space Grotesk", -apple-system, sans-serif', '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
]
HERO_VARIANTS = ["hero--split", "hero--split", "hero--center"]


def _hash_int(text, salt=""):
    return int(hashlib.md5((salt + text).encode()).hexdigest(), 16)


def style_for(name):
    pal = PALETTES[_hash_int(name, "pal") % len(PALETTES)]
    font = FONT_PAIRS[_hash_int(name, "font") % len(FONT_PAIRS)]
    hero = HERO_VARIANTS[_hash_int(name, "hero") % len(HERO_VARIANTS)]
    return pal, font, hero


# ─────────────────────────────────────────────────────────────────────────────
# Category-aware copy (real, specific — not lorem)
# ─────────────────────────────────────────────────────────────────────────────
def copy_for(category_raw, label, name, city):
    c = category_raw
    food = {"restaurant", "cafe", "bar", "pub", "fast_food", "bakery", "ice_cream", "deli"}
    beauty = {"hairdresser", "beauty", "spa", "massage", "nails", "tattoo"}
    health = {"dentist", "doctors", "veterinary", "pharmacy", "optician"}
    fitness = {"gym", "fitness_centre"}
    retail_default = True

    if c in food:
        return {
            "headline": f"Real food, made with <span class='accent'>care.</span>",
            "sub": f"{name} has been a {city} favorite for the flavors people drive across town for. Come taste why.",
            "about_title": f"More than a meal at {name}",
            "about_text": f"{name} brings honest cooking and a warm welcome to {city}. Every plate is made fresh, the way it should be.",
            "services": [("Dine In", "A welcoming space to relax and enjoy great food with the people you love."),
                         ("Takeout & Delivery", "Your favorites, ready to go — fast, fresh, and exactly how you like them."),
                         ("Catering & Events", "Feeding a crowd? We make gatherings effortless and delicious.")],
            "products": ["Signature Dish", "House Favorite", "Sweet Finish"],
        }
    if c in beauty:
        return {
            "headline": f"Look great, feel <span class='accent'>amazing.</span>",
            "sub": f"{name} is where {city} comes to be pampered. Skilled hands, a relaxing space, and results you'll love.",
            "about_title": f"Your look, perfected at {name}",
            "about_text": f"At {name}, every appointment is about you. We listen, we craft, and you leave feeling your absolute best.",
            "services": [("Signature Service", "Our most-loved treatment, tailored exactly to what you want."),
                         ("Consultation", "Not sure what you need? We'll guide you to the perfect look."),
                         ("Special Occasions", "Weddings, events, big days — we'll have you glowing.")],
            "products": ["Popular Treatment", "Gift Card", "Care Product"],
        }
    if c in health:
        return {
            "headline": f"Care you can <span class='accent'>trust.</span>",
            "sub": f"{name} provides {city} with attentive, professional care in a comfortable, friendly setting.",
            "about_title": f"Your wellbeing comes first at {name}",
            "about_text": f"{name} combines real expertise with a genuinely caring approach. You're in good hands here.",
            "services": [("New Patients Welcome", "Booking your first visit is simple — we'll make you feel right at home."),
                         ("Expert Care", "Experienced professionals focused on the best outcome for you."),
                         ("Easy Scheduling", "Flexible appointment times that fit around your life.")],
            "products": ["Consultation", "Care Plan", "Follow-up"],
        }
    if c in fitness:
        return {
            "headline": f"Stronger starts <span class='accent'>here.</span>",
            "sub": f"{name} helps {city} move, sweat, and feel incredible — whatever your starting point.",
            "about_title": f"Your goals, our mission at {name}",
            "about_text": f"{name} is a place to push yourself and feel supported doing it. Real coaching, real community, real results.",
            "services": [("Memberships", "Flexible plans that fit your schedule and your goals."),
                         ("Personal Training", "One-on-one coaching to get you results faster."),
                         ("Classes", "Energizing group sessions for every level.")],
            "products": ["Day Pass", "Monthly Plan", "Personal Session"],
        }
    # default retail/service
    return {
        "headline": f"Quality you can <span class='accent'>count on.</span>",
        "sub": f"{name} is a {city} {label.lower()} people trust — friendly service and a job done right, every time.",
        "about_title": f"Proudly serving {city}",
        "about_text": f"{name} has built its name on doing things properly and treating every customer like a neighbor.",
        "services": [("What We Do Best", "The service our customers come back for, again and again."),
                     ("Personal Attention", "Real people who take the time to get it right for you."),
                     ("Fair & Honest", "Straightforward service with no surprises — just good work.")],
        "products": ["Popular Item", "Customer Favorite", "New Arrival"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Site generation
# ─────────────────────────────────────────────────────────────────────────────
def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "business"


def _esc_attr(s):
    return str(s).replace('"', "&quot;")


def _photo(path, alt, extra_class="", placeholder_label="Photo"):
    """Return an <img> when a real photo path is set, else the styled placeholder."""
    cls = (extra_class + " ").strip()
    if path:
        c = (' class="' + extra_class + '"') if extra_class else ''
        return (f'<img src="{_esc_attr(path)}" alt="{_esc_attr(alt)}"{c} '
                f'style="width:100%;height:100%;object-fit:cover;border-radius:inherit">')
    lbl = _esc_attr(placeholder_label)
    c = ('ph ' + extra_class).strip()
    return f'<div class="{c}" data-label="{lbl}" style="width:100%;height:100%"></div>'


def _gallery_items(images, name):
    """Build the 6-tile gallery, mixing real photos with placeholders."""
    layout = ["tall", "", "wide", "", "wide", ""]
    tiles = []
    for i, cls in enumerate(layout):
        img = images[i] if i < len(images) else ""
        tiles.append(_photo(img, f"{name} photo {i + 1}", cls, f"Photo {i + 1}"))
    return "".join(tiles)


def generate_site(lead, features, settings):
    with open(TEMPLATE, "r", encoding="utf-8") as f:
        tpl = f.read()

    name = lead["name"]
    city = lead.get("city") or "your area"
    label = lead.get("category", "Local Business")
    pal, font, hero = style_for(name)
    copy = copy_for(lead.get("category_raw", ""), label, name, city)

    # Per-lead content overrides (from the in-app editor). Any blank field falls
    # back to the smart category default, so an un-edited lead looks identical.
    c = lead.get("content") or {}

    def ov(key, default):
        v = (c.get(key) or "").strip() if isinstance(c.get(key), str) else c.get(key)
        return v if v else default

    config = {
        "demo": True,
        "booking": bool(features.get("booking")),
        "shop": bool(features.get("shop")),
        "languages": bool(features.get("languages")),
        "form": True,
        "bookingUrl": settings.get("booking_url", ""),
    }

    # Per-project feedback inbox: the lead's own override wins, else your global default.
    form_inbox = (lead.get("form_inbox") or "").strip() \
        or settings.get("formsubmit_email") \
        or settings.get("operator_email", "you@email.com")

    gallery_imgs = c.get("gallery") or []

    repl = {
        "{{BUSINESS_NAME}}": name,
        "{{TAGLINE}}": label + " in " + city,
        "{{CATEGORY_LABEL}}": label,
        "{{CITY}}": city,
        "{{HERO_VARIANT}}": hero,
        "{{HERO_HEADLINE}}": ov("headline", copy["headline"]),
        "{{HERO_SUB}}": ov("sub", copy["sub"]),
        "{{ABOUT_TITLE}}": ov("about_title", copy["about_title"]),
        "{{ABOUT_TEXT}}": ov("about_p1", copy["about_text"]),
        "{{ABOUT_P2}}": ov("about_p2",
                           f"[NEEDS: a sentence or two from the owner — what makes {name} special, "
                           f"and why customers keep coming back.]"),
        "{{SERVICE_1_TITLE}}": ov("s1t", copy["services"][0][0]), "{{SERVICE_1_DESC}}": ov("s1d", copy["services"][0][1]),
        "{{SERVICE_2_TITLE}}": ov("s2t", copy["services"][1][0]), "{{SERVICE_2_DESC}}": ov("s2d", copy["services"][1][1]),
        "{{SERVICE_3_TITLE}}": ov("s3t", copy["services"][2][0]), "{{SERVICE_3_DESC}}": ov("s3d", copy["services"][2][1]),
        "{{REVIEW_1}}": ov("review1", "[NEEDS: a real review you're proud of — paste your best one here.]"),
        "{{REVIEW_2}}": ov("review2", "[NEEDS: a second review — short and specific works best.]"),
        "{{REVIEW_3}}": ov("review3", "[NEEDS: a third review to round things out.]"),
        "{{PRODUCT_1_NAME}}": ov("p1n", copy["products"][0]),
        "{{PRODUCT_2_NAME}}": ov("p2n", copy["products"][1]),
        "{{PRODUCT_3_NAME}}": ov("p3n", copy["products"][2]),
        "{{PRODUCT_1_DESC}}": ov("p1d", "Short, tempting description."),
        "{{PRODUCT_2_DESC}}": ov("p2d", "Short, tempting description."),
        "{{PRODUCT_3_DESC}}": ov("p3d", "Short, tempting description."),
        "{{PRODUCT_1_PRICE}}": ov("p1price", "$—"),
        "{{PRODUCT_2_PRICE}}": ov("p2price", "$—"),
        "{{PRODUCT_3_PRICE}}": ov("p3price", "$—"),
        "{{PRODUCT_1_PHOTO}}": _photo(c.get("p1img"), name + " product", "", "Product photo"),
        "{{PRODUCT_2_PHOTO}}": _photo(c.get("p2img"), name + " product", "", "Product photo"),
        "{{PRODUCT_3_PHOTO}}": _photo(c.get("p3img"), name + " product", "", "Product photo"),
        "{{HERO_PHOTO}}": _photo(c.get("hero_image"), name, "", "Your best photo here"),
        "{{ABOUT_PHOTO}}": _photo(c.get("about_image"), "Inside " + name, "", "Inside " + name),
        "{{GALLERY_ITEMS}}": _gallery_items(gallery_imgs, name),
        "{{ADDRESS}}": ov("address", lead.get("address") or "[NEEDS: full address]"),
        "{{PHONE}}": ov("phone", lead.get("phone") or "[NEEDS: phone]"),
        "{{HOURS}}": ov("hours", lead.get("hours") or "[NEEDS: opening hours]"),
        "{{CUSTOMER_EMAIL}}": ov("email", lead.get("email") or "[NEEDS: best email for customers]"),
        "{{ACCENT}}": pal[0], "{{ACCENT_DEEP}}": pal[1], "{{ACCENT_SOFT}}": pal[2], "{{ACCENT_TINT}}": pal[3],
        "{{FONT_IMPORT}}": font[0], "{{FONT_DISPLAY}}": font[1], "{{FONT_BODY}}": font[2],
        "{{OPERATOR_STUDIO}}": settings.get("studio_name", "Your Studio"),
        "{{OPERATOR_EMAIL}}": settings.get("operator_email", "you@email.com"),
        "{{OPERATOR_PHONE}}": settings.get("operator_phone", ""),
        "{{OPERATOR_BOOKING_URL}}": settings.get("booking_url", ""),
        "{{FORMSUBMIT_EMAIL}}": form_inbox,
        "{{CONFIG_JSON}}": json.dumps(config),
        "{{YEAR}}": str(time.localtime().tm_year),
        "{{GEN_DATE}}": time.strftime("%Y-%m-%d"),
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))

    slug = slugify(name)
    out_dir = os.path.join(OUTPUT_DIR, slug)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "index.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(tpl)

    return {"slug": slug, "path": out_path, "preview_url": f"/output/{slug}/index.html"}


# Decode a data: URL ("data:image/jpeg;base64,...") and save it under the
# lead's output/<slug>/assets folder. Returns the site-relative path to use.
_MIME_EXT = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
}


def save_image(name, slot, data_url):
    m = re.match(r"data:([^;,]+);base64,(.*)$", data_url or "", re.DOTALL)
    if not m:
        raise ValueError("Expected a base64 data URL.")
    mime, b64 = m.group(1).lower(), m.group(2)
    ext = _MIME_EXT.get(mime, "jpg")
    slug = slugify(name)
    assets = os.path.join(OUTPUT_DIR, slug, "assets")
    os.makedirs(assets, exist_ok=True)
    safe_slot = re.sub(r"[^a-z0-9_-]+", "", slot.lower()) or "image"
    fname = f"{safe_slot}.{ext}"
    with open(os.path.join(assets, fname), "wb") as f:
        f.write(base64.b64decode(b64))
    # Strip any older versions of this slot with a different extension.
    for old in os.listdir(assets):
        if old.startswith(safe_slot + ".") and old != fname:
            try:
                os.remove(os.path.join(assets, old))
            except OSError:
                pass
    return f"assets/{fname}"


# ─────────────────────────────────────────────────────────────────────────────
# Email generation (pitch + intake questions, NO prices)
# ─────────────────────────────────────────────────────────────────────────────
def generate_email(lead, settings, preview_url=None):
    name = lead["name"]
    city = lead.get("city") or "your area"
    label = lead.get("category", "business").lower()
    studio = settings.get("studio_name", "Your Studio")
    op_name = settings.get("operator_name", "")
    op_email = settings.get("operator_email", "")
    op_phone = settings.get("operator_phone", "")
    sig_extra = settings.get("signature", "")

    subject = f"A little something I made for {name}"

    body = f"""Hi {name} team,

I came across {name} while looking around {city}, and I have to say — your reputation really stands out. People clearly love what you do.

I noticed you don't have a website yet, so I did something a little unusual: I went ahead and built a small demo of what one could look like for {name} — completely free, no strings attached. I just thought it'd be easier to show you than to explain it.

It's attached / linked below. Take a look and picture your own photos and words in it.

If you like the direction, the fun part is making it truly *yours*. To get a head start, I'd love it if you could reply with a few quick things (no pressure, whatever comes to mind):

  1. In 3 words, what's the feeling you want people to get from {name}?
  2. What are the top 3 things a new customer should see first?
  3. Do you have a few favorite photos (your space, your work, your team, your products)?
  4. What's the ONE thing you'd most want visitors to do — call, book, visit, or order?
  5. A review or two you're really proud of?
  6. Your hours, best contact email, and any social pages?

Honestly, just answering these tends to get people excited — it's the first glimpse of seeing your business shine online.

No cost to look, no obligation at all. If it's not for you, no worries. But if it sparks something, just hit reply and we'll take it from there.

Warmly,
{op_name or studio}
{studio}
{op_email}{(' · ' + op_phone) if op_phone else ''}{(chr(10) + sig_extra) if sig_extra else ''}
"""

    if preview_url:
        body = body.replace("It's attached / linked below.",
                            f"It's attached, and you can also preview it here: {preview_url}")

    return {"subject": subject, "body": body}


# ─────────────────────────────────────────────────────────────────────────────
# Claude research prompt (to find the business email)
# ─────────────────────────────────────────────────────────────────────────────
def research_prompt(lead):
    name = lead["name"]
    city = lead.get("city", "")
    phone = lead.get("phone", "")
    addr = lead.get("address", "")
    return (
        f"Find the public contact email for this local business so I can send a "
        f"professional outreach message. Please check their Google Business listing, "
        f"Facebook/Instagram pages, Yelp, and any directory listings.\n\n"
        f"Business: {name}\n"
        f"City/Area: {city}\n"
        f"Phone: {phone or 'unknown'}\n"
        f"Address: {addr or 'unknown'}\n\n"
        f"Return: (1) the best public email, (2) any social media links, "
        f"(3) confirm whether they truly have NO website. "
        f"If you can't find an email, give the best contact method (e.g. Facebook DM or phone)."
    )


# ─────────────────────────────────────────────────────────────────────────────
# HTTP handler
# ─────────────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass  # quiet

    # ---- helpers ----
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def _serve_file(self, path, ctype):
        try:
            with open(path, "rb") as f:
                self._send(200, f.read(), ctype)
        except FileNotFoundError:
            self._send(404, {"error": "not found"})

    # ---- GET ----
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path

        if route == "/" or route == "/index.html":
            return self._serve_file(os.path.join(UI_DIR, "index.html"), "text/html; charset=utf-8")
        if route == "/styles.css":
            return self._serve_file(os.path.join(UI_DIR, "styles.css"), "text/css; charset=utf-8")
        if route == "/app.js":
            return self._serve_file(os.path.join(UI_DIR, "app.js"), "application/javascript; charset=utf-8")
        if route == "/price-sheet":
            return self._serve_file(os.path.join(ROOT, "price-sheet.html"), "text/html; charset=utf-8")

        if route == "/api/settings":
            return self._send(200, get_settings())

        if route == "/api/leads":
            return self._send(200, load_json(LEADS_FILE, []))

        # Serve generated demo sites for preview
        if route.startswith("/output/"):
            rel = urllib.parse.unquote(route[len("/output/"):])
            safe = os.path.normpath(os.path.join(OUTPUT_DIR, rel))
            if not safe.startswith(OUTPUT_DIR):
                return self._send(403, {"error": "forbidden"})
            return self._serve_file(safe, guess_ctype(safe))

        return self._send(404, {"error": "not found"})

    # ---- POST ----
    def do_POST(self):
        route = urllib.parse.urlparse(self.path).path
        payload = self._read_json()

        if route == "/api/search":
            location = (payload.get("location") or "").strip()
            if not location:
                return self._send(400, {"error": "Please enter a location."})
            radius = int(payload.get("radius", 5000))
            keyword = (payload.get("keyword") or "").strip() or None
            max_results = min(int(payload.get("max", 100)), 300)
            result = overpass_search(location, radius, keyword, max_results)
            return self._send(200, result)

        if route == "/api/leads/save":
            # Merge incoming leads into the store (dedupe by id)
            incoming = payload.get("leads", [])
            with _lock:
                store = load_json(LEADS_FILE, [])
                by_id = {l["id"]: l for l in store}
                for l in incoming:
                    if l["id"] in by_id:
                        by_id[l["id"]].update(l)
                    else:
                        by_id[l["id"]] = l
                store = list(by_id.values())
                save_json(LEADS_FILE, store)
            return self._send(200, {"ok": True, "count": len(store)})

        if route == "/api/lead/update":
            lead_id = payload.get("id")
            fields = payload.get("fields", {})
            with _lock:
                store = load_json(LEADS_FILE, [])
                for l in store:
                    if l["id"] == lead_id:
                        l.update(fields)
                        break
                save_json(LEADS_FILE, store)
            return self._send(200, {"ok": True})

        if route == "/api/lead/delete":
            lead_id = payload.get("id")
            with _lock:
                store = [l for l in load_json(LEADS_FILE, []) if l["id"] != lead_id]
                save_json(LEADS_FILE, store)
            return self._send(200, {"ok": True})

        if route == "/api/settings/save":
            with _lock:
                s = get_settings()
                s.update({k: v for k, v in payload.items() if k in DEFAULT_SETTINGS})
                save_json(SETTINGS_FILE, s)
            return self._send(200, {"ok": True, "settings": s})

        if route == "/api/generate-site":
            lead = payload.get("lead", {})
            features = payload.get("features", {})
            if not lead.get("name"):
                return self._send(400, {"error": "Missing lead."})
            try:
                res = generate_site(lead, features, get_settings())
            except Exception as e:
                return self._send(500, {"error": f"Generation failed: {e}"})
            # mark lead
            with _lock:
                store = load_json(LEADS_FILE, [])
                for l in store:
                    if l["id"] == lead.get("id"):
                        l["site_generated"] = True
                        l["site_slug"] = res["slug"]
                        if l.get("status") in ("new", "contact_found"):
                            l["status"] = "demo_ready"
                        break
                save_json(LEADS_FILE, store)
            return self._send(200, res)

        if route == "/api/upload-image":
            name = (payload.get("name") or "").strip()
            slot = (payload.get("slot") or "image").strip()
            data_url = payload.get("data_url") or ""
            if not name:
                return self._send(400, {"error": "Missing business name."})
            try:
                rel = save_image(name, slot, data_url)
            except Exception as e:
                return self._send(400, {"error": f"Could not save image: {e}"})
            return self._send(200, {"ok": True, "path": rel})

        if route == "/api/generate-email":
            lead = payload.get("lead", {})
            preview_url = payload.get("preview_url")
            res = generate_email(lead, get_settings(), preview_url)
            return self._send(200, res)

        if route == "/api/research-prompt":
            lead = payload.get("lead", {})
            return self._send(200, {"prompt": research_prompt(lead)})

        return self._send(404, {"error": "not found"})


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    port = int(os.environ.get("PORT", "8000"))
    host = "127.0.0.1"
    server = ThreadingHTTPServer((host, port), Handler)
    url = f"http://localhost:{port}"
    print("\n" + "═" * 56)
    print("  LeadStudio is running")
    print(f"  → Open: {url}")
    print("  → Press Ctrl+C here to stop")
    print("═" * 56 + "\n")
    if "--no-browser" not in sys.argv:
        try:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped. Your leads are saved in ./data/leads.json\n")
        server.shutdown()


if __name__ == "__main__":
    main()
