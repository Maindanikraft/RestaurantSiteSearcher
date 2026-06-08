# 🚀 The Client Delivery Playbook
### Every step, in order, start to finish — wired to the LeadStudio app.

> Read this once. After that, you mostly live inside the app (`python3 app.py`) and this
> doc is your reference for the parts that happen **off**-screen (meetings, domains, money).
> Tick the boxes as you go. When you hit an **IF** branch, only do it if it applies.

---

## 🗺️ The whole journey at a glance

```
STAGE 1  Set up your studio (once)              → app · Studio setup
STAGE 2  Find leads near an area                → app · Find leads
STAGE 3  Find each lead's email (with Claude)   → app · lead · step 1
STAGE 4  Generate a unique demo site            → app · lead · step 2
STAGE 5  Send the pitch email (no prices)       → app · lead · step 3
STAGE 6  They reply → qualify & quote           → off-app (you decide price)
STAGE 7  Build the real site                    → Master Prompt + their answers
   ├─ IF booking      → Branch A
   ├─ IF lead form    → Branch B   (on by default)
   ├─ IF online shop  → Branch C
   └─ IF 2nd language → Branch D
STAGE 8  Domain + go live                       → off-app
STAGE 9  Handover + get paid                    → off-app
STAGE 10 Yearly renewal + maintenance income    → off-app
```

---

## STAGE 1 — Set up your studio  *(once, 3 minutes)*

- [ ] Run the app: `python3 app.py` → it opens `http://localhost:8000`.
- [ ] Go to **Studio setup**. Fill in:
  - [ ] Studio name (e.g. *Bright Web Studio*)
  - [ ] Your name
  - [ ] Your email *(this is what clients see + reply to)*
  - [ ] Your phone / WhatsApp
  - [ ] Booking link *(optional — your Calendly/Cal.com)*
  - [ ] Form inbox *(where website messages get delivered)*
- [ ] Click **Save setup**. The sidebar flag turns green ✓.

**Why first:** every email and every demo site auto-fills with this. Skip it and you'll send
clients `you@email.com`.

✅ **Done when:** sidebar shows "✓ Studio set up".

---

## STAGE 2 — Find leads

- [ ] Go to **Find leads**.
- [ ] Type a location: `Harrison, NJ`, a ZIP, or a city.
- [ ] *(Optional)* set a type: `restaurant`, `salon`, `car_repair`, etc.
- [ ] Pick radius + max, hit **Search**.
- [ ] Skim the list — it's sorted best-first:
  - **100** = name + phone + address (best)
  - **70 / 60** = partial info
  - **30** = name only (hardest to reach)
- [ ] Click **Save** on the good ones, or **Save all**.

**Tip:** start with **score 70+** leads — they have a phone, so even if email-finding fails
you can still call.

✅ **Done when:** you have a batch of saved leads in **My leads**.

---

## STAGE 3 — Find each lead's email  *(you + Claude)*

For each promising lead:

- [ ] Open it → **Work this lead** → **Step 1**.
- [ ] Click **Copy research prompt for Claude**.
- [ ] Paste it to Claude (this chat). Claude checks Google Business, Facebook, Instagram,
      Yelp, directories, and confirms they truly have no website.
- [ ] Paste the email Claude finds back into the **Their email** box → **Save email**.
      *(Status auto-moves to "Contact found".)*

**IF no email exists anywhere:**
- [ ] Use the **Google them ↗** button to double-check.
- [ ] No email? Fall back to the **phone** (call) or a **Facebook/Instagram DM**. Note it in
      step 4 and keep going — a call often beats an email anyway.

✅ **Done when:** the lead has an email saved (or a clear "call/DM instead" note).

---

## STAGE 4 — Generate a unique demo site

- [ ] Same lead → **Step 2**.
- [ ] Choose the tools to include (you can change later):
  - **Lead form** — leave ON (sends to the owner's inbox).
  - **Booking** — ON for salons, clinics, restaurants that take reservations.
  - **Shop** — ON if they sell products/takeout.
  - **2nd language** — ON for bilingual areas.
- [ ] Click **Generate site** → **Open preview ↗**.
- [ ] Glance at it on desktop **and** narrow the window (phone view). It should look clean and
      load instantly.

The site is saved to `output/<business-name>/index.html`. Colors, fonts, headline and copy
are auto-matched to the business type, so each one looks like its own brand.

✅ **Done when:** the preview looks good and the lead shows "● site ready".

---

## STAGE 5 — Send the pitch email  *(no prices)*

- [ ] Same lead → **Step 3** → **Generate email**.
- [ ] Read it once. It's warm, personalized, includes the **intake questions**, and contains
      **no prices** (on purpose — price comes after they're interested).
- [ ] **Attach the demo:** zip the `output/<business-name>` folder and attach it,
      **or** paste the preview link (see "Sending the demo" in `README-APP.md`).
- [ ] Click **Open in mail app ↗** (or **Copy email** and paste into Gmail).
- [ ] Send. *(Status auto-moves to "Emailed".)*

**The intake questions in the email do double duty:** they make the owner feel proud to
answer ("oh, I *do* know my vibe!") and they hand you everything you need to build the real
site — before you've even talked price.

✅ **Done when:** email sent, lead = "Emailed".

> 🔁 Repeat Stages 3–5 for each lead. This is the engine. Most of your time is here.

---

## STAGE 6 — They reply → qualify & quote

When a reply lands:

- [ ] Mark the lead **Replied** (or **Won** when they say yes).
- [ ] Read their intake answers — you now know their vibe, goals, photos, reviews.
- [ ] Send your **price sheet** (`price-sheet.html` → print to PDF) or the
      `mobile-packages.html` link. Recommend a package (Starter / Pro / Premium).
- [ ] Agree on scope + price.

🔒 **Rule: take the 50% deposit before you build anything.** This one rule protects you on
every single job.

✅ **Done when:** package agreed + **deposit received**.

---

## STAGE 7 — Build the real site

Now you turn the demo into their finished site using their real answers.

- [ ] Make a folder for the job and copy their generated demo into it as the starting point.
- [ ] Collect + **label** their photos so it's obvious where each goes:
  ```
  logo.png      hero.jpg      about.jpg
  gallery-1.jpg … gallery-6.jpg     menu.pdf (if food)
  ```
  **IF they have no photos:** offer the Photography add-on, or keep tasteful placeholders and
  tell them their real photos close more sales.
- [ ] Open **`MASTER-PROMPT.md`**, fill in every `[BRACKET]` with their real answers, and
      paste it to Claude **with** their `index.html`. Claude returns the polished site +
      a **MISSING INFO CHECKLIST**.
- [ ] Work through every `[NEEDS: ...]` — fill it from their answers or ask one quick
      follow-up.
- [ ] **Quality gate — tick all 5:**
  - [ ] Loads fast, no broken images
  - [ ] Zero placeholder/lorem text left
  - [ ] The main action (call/book/order) is obvious on every screen
  - [ ] Looks right on a phone
  - [ ] Phone, email & address are correct (click each link to test)

### Feature branches (toggle in the app, or wire up for the live site)

#### 🅐 IF booking
- Free + easy: **Calendly** or **Cal.com**. Put the link in **Studio setup → Booking link**;
  every generated site embeds it automatically.
- ✅ Done when: you can complete a test booking and it appears in the provider's dashboard.

#### 🅑 IF lead form  *(on by default)*
- The form posts to the owner's inbox via **FormSubmit** — no server.
- [ ] Set the owner's email in the site's form (the app uses your **Form inbox**; for the
      live client site, change it to the **client's** email).
- [ ] Submit a test → owner clicks the one-time FormSubmit confirmation email.
- ✅ Done when: a test message reaches the owner's inbox.

#### 🅒 IF online shop  *(Premium scope)*
- Don't hand-build a cart. Drop in **Snipcart** or **Ecwid** (free tier) — the shop section
  is already scaffolded; paste their embed snippet and add products + real prices.
- ✅ Done when: a test product adds to cart and reaches checkout.

#### 🅓 IF 2nd language
- The template ships with a working **EN | ES** toggle and a starter dictionary.
- [ ] Replace the ES strings with a real translation of their content (sell as the Extra
      Language add-on).
- ✅ Done when: both languages read correctly and the toggle works both ways.

✅ **Stage done when:** all 5 quality gates pass + every needed feature tested.

---

## STAGE 8 — Domain + go live

- [ ] Suggest 3 domain names (`.com` first). Check at **Namecheap / Cloudflare / Porkbun**.
- [ ] **Register it on YOUR account** (this is what lets you manage renewals — Stage 10).
- [ ] Host it free: **Netlify Drop** (drag the site folder onto netlify.com/drop) — or
      Cloudflare Pages / GitHub Pages / Vercel.
- [ ] Add the custom domain in the host; point DNS from your registrar; wait for HTTPS 🔒.

> 💰 **Domain pricing:** you pay the registrar (~$12/yr for a `.com`). Bill the client a flat
> **"domain + management"** line at **cost + 30%** (≈ $16/yr), and you handle renewal, DNS and
> uptime forever. You're selling *peace of mind*. Keep the markup fixed and consistent. If a
> client ever asks point-blank, say "it covers me managing and renewing it for you" — true,
> clean, and keeps the client.

✅ **Done when:** the real `.com` loads over HTTPS on desktop + phone.

---

## STAGE 9 — Handover + get paid

- [ ] **Collect the remaining 50%** now it's live.
- [ ] Keep the keys: site files + a private backup, domain + host on your accounts. This is
      what lets you make changes anytime (your selling point) and protects your work.
- [ ] Send a short handover note: live URL, what they got, "need a change? just message me."
- [ ] **IF they took the Care Plan ($25/mo):** add them to your monthly list (backups,
      updates, small edits). **ELSE:** tell them edits are $[your rate] each, or re-offer the
      Care Plan.
- [ ] In the app, mark the lead **Won 🎉**.

✅ **Done when:** final payment received + handover sent + lead = Won.

---

## STAGE 10 — Yearly renewal + maintenance income 💵

Set a calendar reminder **1 month before** each domain renews.

- [ ] Renew the domain on your account (~$12 to the registrar).
- [ ] Invoice the client the **domain + management fee** (cost + 30%, fixed ≈ $16).
- [ ] **IF Care Plan active:** their $25/mo already covers hosting + edits — keep it running.
      **ELSE:** send a friendly "site anniversary" note + re-offer the Care Plan.

✅ **Done when:** domain renewed + yearly invoice paid. (Repeats every year = recurring income.)

---

## 🧾 One-page cheat sheet (pin this)

```
RUN:  python3 app.py
0. Studio setup (once)                    → green flag
1. Find leads → Save the good ones
2. Per lead, step 1: Copy prompt → Claude → paste email back
3. Per lead, step 2: Generate site (toggle tools) → preview
4. Per lead, step 3: Generate email (NO prices) → attach demo → send
5. Reply? → quote + 50% DEPOSIT FIRST
6. Build real site: Master Prompt + their answers + photos
     A booking  → Calendly/Cal.com link in Studio setup
     B form     → FormSubmit to CLIENT's email (test it)
     C shop     → Snipcart/Ecwid (Premium)
     D language → translate the ES strings
7. Domain on YOUR account → Netlify → connect → HTTPS
     bill domain at cost +30% fixed (you manage it)
8. Final 50% paid → handover → mark Won
9. Yearly: renew + invoice + Care Plan $25/mo
```

---

## ⚠️ Three guardrails that keep you safe

1. **Deposit before building.** Always. The single biggest protection you have.
2. **Test every `tel:` / `mailto:` link** before launch — a wrong number kills trust.
3. **The 30% domain markup is a normal management fee** — bill it as one clean line. Keeping
   the breakdown private is fine; **lying if asked directly is not.** "It covers managing and
   renewing it for you" is the honest, client-keeping answer.
