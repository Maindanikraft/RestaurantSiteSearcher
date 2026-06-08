# 🧠 The Master Prompt (v2)

This is the single prompt you paste to an AI to turn a blank template into a finished,
professional site. It keeps the original prompt intact and adds the extras that make the
output **unique, honest, accessible, and conversion-focused** — plus the four built-in tools.

> How to use: fill every `[BRACKET]`, delete the guidance in *italics*, paste it to Claude
> (or any capable model) along with the `templates_src/lumen.html` file (or your generated
> `output/<business>/index.html`). The model returns the finished files **and** a checklist
> of anything still missing.

---

## The prompt (copy everything in the box)

```
You are a senior web designer + copywriter. Customize my existing HTML template into a
complete, professional, mobile-first website for a specific local business.

══ HARD RULES (do not break) ══
1. DO NOT invent facts. No fake reviews, fake stats, fake addresses, fake awards, fake years.
   If something is missing, insert a clearly marked placeholder: [NEEDS: real review] etc.
2. At the very end, output a "MISSING INFO CHECKLIST" listing every [NEEDS: ...] you used,
   so I know exactly what to collect from the client.
3. Keep it mobile-first and fast. Must work offline (fonts degrade gracefully).
4. Real, specific, benefit-led copy. No lorem ipsum, no empty clichés ("we are the best").
5. Accessible: alt text on every image, good color contrast, keyboard-friendly nav,
   visible focus states, semantic headings (one h1).

══ BUSINESS ══
- Name: [NAME]
- Category: [e.g. Italian restaurant / hair salon / auto repair]
- City / area: [CITY]
- One-line tagline: [TAGLINE or "NEEDS: tagline"]
- What they do (2–3 sentences): [DESCRIPTION]
- Primary goal of the site: [CALL / BOOK / VISIT / ORDER]
- Their vibe in 3 words: [e.g. warm, family, authentic]

══ DESIGN (make it feel made-for-them, not generic) ══
- Base file: [lumen.html OR the generated output/<slug>/index.html]
- Color feeling: [LIGHT+CLEAN / DARK+GOLD / VIBRANT / EARTHY] → set the :root accent
  variables + fonts to match. Pick an accent that suits the brand and city, not a default.
- Choose a display + body font pairing that fits the vibe (the template already imports one;
  swap if a better fit exists).
- Vary the hero layout / section rhythm so it doesn't look like a template clone.

══ CONTENT (use ONLY what I provide; placeholder the rest) ══
- Services / menu / offerings (3–6): [LIST or "NEEDS: services"]
- About story: [REAL STORY or "NEEDS: about text"]
- Real reviews (verbatim): [PASTE or "NEEDS: reviews"]
- Photos available: [LIST filenames in /assets, or "NEEDS: photos — use tasteful placeholders"]
- Contact: address [..] · phone [..] · public email [..] · hours [..] · socials [..]

══ BUILT-IN TOOLS (turn each ON/OFF; the template already contains all of them) ══
- Lead form  → [ON]  sends to the owner's inbox via FormSubmit. Owner email: [OWNER EMAIL]
- Booking    → [ON/OFF]  if ON, embed this link: [CALENDLY/CAL.COM URL]
- Online shop→ [ON/OFF]  if ON, scaffold product cards (Snipcart/Ecwid ready)
- 2nd language→ [ON/OFF]  if ON, target language: [LANGUAGE] (add a working EN|XX toggle)

══ ALSO ADD (professional polish) ══
- A <title> and <meta name="description"> written for Google (include city + category).
- JSON-LD structured data: schema.org "LocalBusiness" with name, address, phone, hours,
  geo, and priceRange omitted (we set prices later). Use [NEEDS: ...] for anything unknown.
- Open Graph tags (og:title, og:description, og:type=website) for nice link previews.
- A clear primary call-to-action repeated sensibly (matching the Primary goal above).
- Sensible section order for this business type (e.g. food → menu/gallery high up;
  service → trust/reviews high up).

══ OUTPUT ══
- Return the full file(s), ready to save and open.
- Then the MISSING INFO CHECKLIST.
- Then 3 short suggestions for what would most improve conversions for THIS business.
```

---

## What changed from v1 (the additions)

| Added | Why it matters |
|---|---|
| **MISSING INFO CHECKLIST** requirement | Turns the AI's gaps into your client follow-up list automatically. |
| **Accessibility rules** | Alt text, contrast, focus, semantic headings — looks professional + ranks better. |
| **SEO meta + JSON-LD LocalBusiness** | Helps the business actually get found on Google Maps & Search. |
| **Open Graph tags** | Their link looks clean when shared on WhatsApp/Facebook. |
| **"make it feel made-for-them"** | Prevents the template-clone look — each site reads unique. |
| **Built-in tools toggle block** | Matches the four tools already scaffolded in `lumen.html`. |
| **3 conversion suggestions** | Free extra value you can mention to the client. |

> The **LeadStudio app already applies most of this automatically** when you click
> "Generate site" (unique colors/fonts/copy + tools). Use this full Master Prompt when you
> want to go further — refine the copy, add real reviews, or hand the file to Claude for a
> top-to-bottom polish before the client meeting.
