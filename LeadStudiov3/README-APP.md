# 🚀 LeadStudio — your prospecting control panel

One window that does the whole job: **find businesses with no website → find their email →
generate a unique demo site → write the pitch email → track the deal.** Free data, no API
keys, runs entirely on your computer.

---

## ▶️ Run it (one command)

```bash
cd RestaurantSiteSearcher
python3 app.py
```

Your browser opens at **http://localhost:8000** automatically.
To stop it: press **Ctrl + C** in the terminal.

> No installs. No pip. No accounts. It only needs Python 3 (you already have it).
> If the browser doesn't open, just visit http://localhost:8000 yourself.

---

## 🖥️ The 4 screens

### 1. Studio setup  *(do this first, once)*
Enter your studio name, your email, phone, and (optional) Calendly link.
Everything you generate — every email, every demo site footer & contact form — fills in
with **your real info** automatically. The sidebar shows a ⚠️ until this is done.

### 2. Find leads
Type a place (`Harrison, NJ`, a ZIP, or a city). Optionally narrow by type
(`restaurant`, `salon`, `car_repair`…). You get a list of businesses that have a real local
presence and **no website**, scored best-first:

| Score | Meaning |
|------|---------|
| **100** | Has name + phone + address → easiest to reach, best lead |
| **70**  | Name + phone |
| **60**  | Name + address |
| **30**  | Name only |

Click **Save** on the good ones (or **Save all**).

### 3. My leads  *(your pipeline)*
Every saved lead with a status: **New → Contact found → Demo ready → Emailed → Replied →
In progress → In review → Done → Passed**. Change status right from the list, delete a dud
with the trash icon, or click **Open** to work the lead through 5 steps:

1. **Find their email** — copy the ready-made research prompt, paste it to **Claude**, and it
   digs up the public email + socials. Paste the email back and save.
2. **Generate their demo site** — one click builds a unique, personalized site
   (colors/fonts/copy auto-matched to the business type). Toggle **Booking / Shop / 2nd
   language** on or off, and set where the **feedback form** delivers (per-lead).
3. **Make it theirs** — the built-in **content editor**: rewrite any headline, paragraph,
   service, review, or contact detail, and **drop in real photos** (auto-resized, saved next
   to the site). Hit *Save & rebuild* and the preview updates instantly. Everything here is
   free and local — this is how you "work on the website" before spending anything.
4. **Write the pitch email** — a warm, personalized message with the intake questions built
   in and **no prices**. Copy it, or open it straight in your mail app.
5. **Notes** — jot anything; delete the lead if it's a dud.

Export the whole pipeline to **CSV** anytime.

### 4. The Flow
The calm, free-first journey from "found them" to "live and paid", with every scary
technical step (domain, hosting, SSL, backups, the feedback form, monthly edits) explained
in plain language — and a clear reminder that **you spend $0 until the client has paid you.**
See also `FREE-FIRST-FLOW.md`.

### 5. Pricing
Your fair, copy-ready packages and add-ons, plus a printable price sheet.

---

## 📎 Sending the demo with your email

When you generate a site it's saved to `output/<business-name>/index.html`. To attach it:

- **Easiest:** zip the `output/<business-name>` folder and attach the zip, **or**
- Paste the **preview link** the app gives you (works while the app is running on your
  machine — for a link the client can open anytime, drop the folder on
  [Netlify Drop](https://netlify.com/drop) for a free public URL).

---

## 🔌 Where the "automatic" parts plug in

| Job | How it works in LeadStudio |
|---|---|
| Find businesses | Free **OpenStreetMap / Overpass** data — no key, no cost |
| Skip ones with sites | Auto-filters out anything with a website tag |
| Find emails | You + **Claude** (the app hands you the exact prompt) |
| Build the site | Built-in generator (the **Lumen** template + your settings) |
| Booking / form / shop / language | All four are **pre-built** in every site — just toggle |
| Write the email | Built-in, personalized, no prices |
| Track deals | Local pipeline saved in `data/leads.json` |

Nothing leaves your computer except the public map lookups and (when you choose) the email
you send.

---

## 🗂️ Files

```
app.py                  ← the whole app (run this)
ui/                     ← the dashboard (html/css/js)
templates_src/lumen.html← the universal site template (all 4 tools built in)
output/                 ← generated demo sites land here (one folder per business)
data/                   ← your saved leads + studio settings
MASTER-PROMPT.md        ← the deep-customization prompt for Claude
CLIENT-PLAYBOOK.md      ← the full start-to-finish delivery process
```

---

## ❓ Troubleshooting

- **"Could not find location"** → try a more specific place (`City, State` or a ZIP).
- **Search says "try again in a moment"** → the free map service rate-limits bursts; wait
  ~10 seconds and search again.
- **Port already in use** → run `PORT=8080 python3 app.py` and open http://localhost:8080.
- **Browser didn't open** → go to http://localhost:8000 manually.
