# LeadStudio — find businesses with no website & win them as clients

A complete, **free**, run-on-your-own-computer toolkit for selling websites to local
businesses. Find prospects with no website, generate a unique demo site for each, send a
personalized pitch, and track every deal — all from one dashboard.

---

## ▶️ Start here

```bash
python3 app.py
```

Opens **http://localhost:8000** in your browser. No installs, no API keys, no accounts.
Full guide: **[README-APP.md](README-APP.md)**.

---

## What's in this repo

| File | What it is |
|---|---|
| **`app.py`** | The LeadStudio app — run this. Zero dependencies (Python 3 stdlib only). |
| **`ui/`** | The dashboard (search · pipeline · settings · guide). |
| **`templates_src/lumen.html`** | Universal site template with **booking, lead form, shop & 2nd-language all built in**. |
| **`MASTER-PROMPT.md`** | The deep-customization prompt for finishing a site with Claude. |
| **`CLIENT-PLAYBOOK.md`** | The full start-to-finish delivery process (10 stages, every step). |
| **`price-sheet.html`** | Print-to-PDF price sheet to show clients. |
| **`mobile-packages.html`** | Mobile-first pricing page. |
| **`searcher.py`** | Legacy command-line searcher (Google Places version). The app replaces it. |

---

## How the flow works

```
1. Studio setup (once)   → your name/email auto-fills everything
2. Find leads            → businesses with no website, scored best-first  (free OpenStreetMap data)
3. Find their email      → you + Claude (the app gives you the exact prompt)
4. Generate a demo site  → unique colors/fonts/copy per business, tools togg; one click
5. Send the pitch email  → personalized, intake questions included, NO prices
6. Track the deal        → New → Contact found → Site ready → Emailed → Replied → Won
```

Everything runs locally. The only outside calls are public map lookups and the emails you
choose to send.

---

## Why free

LeadStudio uses **OpenStreetMap / Overpass** for business data — no Google API key, no credit
card, no monthly bill. It auto-skips any business that already has a website, so every lead is
a real opportunity.
