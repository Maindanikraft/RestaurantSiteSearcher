# The Flow — build everything free first, spend last

The one rule: **you spend $0 until the client has already paid you.**
Build the whole site, polish it, show it, and get a "yes" — all free, all on
your own computer. The *only* thing that ever costs money is a domain (~$12/yr),
and that's the very last step, after their deposit is in your pocket.

This is the same guide that lives in the app under the **The Flow** tab. Keep it
here for offline reference.

---

## Phase 1 — Build it (FREE · on your computer)

Nothing bought. No accounts. Offline.

1. **Find a business** with no website in *Find leads*, and save it.
2. **Open the lead → step 2 → Generate site.** A unique, personalized demo is
   built in one click into your `output/<business>/` folder.
3. **Preview it** — the preview link opens the real site in your browser. This
   is the live thing, running from your own machine.
4. **Make it theirs (step 3 — "Make it theirs").** This is *working on the
   website*:
   - Edit every headline, paragraph, service, review (leave a box blank to keep
     the smart auto-text).
   - Drop in real photos — they're shrunk automatically and saved next to the
     site.
   - Edit contact details and shop items.
   - Hit **Save content & rebuild site** → the preview updates instantly.
   - Do this 1 time or 50 times. Still **$0**.

---

## Phase 2 — Show the client (FREE · still nothing bought)

Put it online for free with a shareable link. No domain, no card.

1. **Drag the site folder onto Netlify Drop:**
   - Find `output/<business>` on your computer.
   - Go to **app.netlify.com/drop**.
   - **Drag the whole folder** onto the page. Wait ~10 seconds.
   - You get a free live link like `your-site.netlify.app`. (You only need a
     free account if you want a tidy dashboard — not to get the link.)
   - This is the link you put in your pitch email.
2. **Send the pitch.** Lead → step 4 → Generate email. Warm, personal, intake
   questions, **no prices**. Paste in the Netlify link and send.
3. Move the lead to **Emailed** (the mail button does this for you).

---

## Phase 3 — They say yes (money comes IN first)

The deal closes before you spend a cent of your own.

1. They reply → mark the lead **Replied**.
2. **Send your price** (Pricing tab → copy a package) and take a **50% deposit**
   before building the real version. Their money is now in your pocket.
3. **Collect their real stuff** — photos, hours, reviews, best email — and drop
   it into the step-3 editor. Mark the lead **In progress**.

---

## Phase 4 — Go live (the FIRST and ONLY real cost: ~$12)

Now — and only now — you buy a domain. You bill it back to the client.

1. **Buy the domain** (e.g. `tonys.com`), ~$12/yr, on **your** account:
   - **Namecheap** (or Porkbun / Cloudflare). Search the name; try `.com`, else
     add the city or try `.co`.
   - Check out (~$10–13). Turn ON auto-renew + free domain privacy.
   - 💰 You pay ~$12; bill the client ~$16/yr as a flat "domain + management"
     line.
2. **Connect the domain to the site** (the padlock 🔒 / SSL then turns on by
   itself, free):
   - Re-drop the final folder to Netlify (or open your existing site there).
   - Netlify → *Domain settings* → *Add a custom domain* → type the domain →
     *Set up Netlify DNS* (shows 4 nameservers).
   - Namecheap → your domain → *Nameservers* → *Custom DNS* → paste Netlify's 4
     → save.
   - Wait 15 min–a few hours. Done.
3. **Point the feedback form at THEIR email**, then rebuild:
   - Lead → step 2 → *"Feedback form sends to"* box → switch from your email to
     theirs → rebuild.
   - First time the form is used, **FormSubmit** emails that address a confirm
     link. Click it once. Every message then lands in their inbox, formatted.
4. **Booking?** Free **Cal.com** per client:
   - cal.com → sign up free (use the client's Google so it's *their* calendar).
   - Set hours, make an Event Type (e.g. "Table for 2", 30 min) → get a link.
   - Paste into *Studio setup → Booking link*, toggle Booking ON in step 2,
     rebuild — it embeds itself.
5. Deliver, collect the **other 50%**, mark the lead **Done ✅**.

---

## Phase 5 — Keep it running (the "care plan", demystified)

The part that sounded scary. The truth: almost all of it is free and automatic.

- **"Hosting & SSL"** → Netlify does both, free, forever. No monthly hosting
  bill for sites this size; the padlock renews itself. You do nothing.
- **"Security + automatic backups"** → Netlify keeps every version (one-click
  rollback). And your `output/<business>` folder *is* a full backup — copy it to
  Google Drive once and you're double-covered. Nothing to buy.
- **"Domain renewal & management"** → auto-renews on your card once a year
  (~$12). You click nothing. You bill the client back — that's the
  "management".
- **"Up to 30 min of edits/month"** → open the lead → step 3 → edit text or swap
  a photo → rebuild → re-drag the folder to Netlify. ~5 minutes. That's the
  whole monthly task.

**Why a $20/mo care plan is fair both ways:** the client gets a maintained,
always-on site and a human who'll make quick changes; you get steady income for
a few minutes of easy work. Most months you'll do nothing at all.
