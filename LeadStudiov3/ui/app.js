/* ════════════════════════════════════════════════════════════════
   LeadStudio — dashboard logic (vanilla JS, no build step)
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const api = async (path, body) => {
    const opt = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    const res = await fetch(path, opt);
    return res.json();
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let STATE = { leads: [], settings: {}, lastResults: [] };

  /* ───── Status model (outreach + project workflow combined) ───── */
  const STATUSES = [
    { key: "new",           label: "New",          color: "#6b7585", next: "Find their email" },
    { key: "contact_found", label: "Contact found",color: "#5b8cff", next: "Generate a demo site" },
    { key: "demo_ready",    label: "Demo ready",   color: "#a988ff", next: "Send the pitch email" },
    { key: "emailed",       label: "Emailed",      color: "#e9b949", next: "Wait a few days, then follow up" },
    { key: "replied",       label: "Replied 🎯",   color: "#36c98e", next: "Send price + get 50% deposit" },
    { key: "in_progress",   label: "In progress",  color: "#5b8cff", next: "Build the real site (Master Prompt)" },
    { key: "review",        label: "In review",    color: "#e9b949", next: "Client reviewing — await feedback" },
    { key: "done",          label: "Done ✅",       color: "#36c98e", next: "Delivered + paid 🎉" },
    { key: "passed",        label: "Passed",       color: "#f06d8a", next: "Archived — not a fit" },
  ];
  const ST = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
  const stOf = (l) => ST[l.status] || ST.new;
  function statusChip(key) {
    const s = ST[key] || ST.new;
    return `<span class="status-chip" style="color:${s.color};background:${s.color}22">${s.label}</span>`;
  }

  /* ───── Toast ───── */
  let toastTimer;
  function toast(msg, isErr) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 2600);
  }
  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); toast((label || "Copied") + " ✓"); }
    catch { toast("Copy failed — select & copy manually", true); }
  }

  /* ───── Tabs ───── */
  $$(".side-nav__item").forEach((btn) =>
    btn.addEventListener("click", () => {
      $$(".side-nav__item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $("#tab-" + tab).classList.add("active");
      if (tab === "leads") renderLeads();
    })
  );

  /* ───── Score badge ───── */
  function scoreClass(s) { return s >= 90 ? "score-hi" : s >= 60 ? "score-mid" : "score-lo"; }

  function metaLine(l) {
    const bits = [];
    if (l.phone) bits.push(`<span>📞 ${esc(l.phone)}</span>`);
    if (l.email) bits.push(`<span>✉️ ${esc(l.email)}</span>`);
    if (l.address) bits.push(`<span>📍 ${esc(l.address)}</span>`);
    if (!l.phone && !l.address && !l.email) bits.push(`<span>No contact info in map data</span>`);
    return bits.join("");
  }

  /* ════════ SEARCH ════════ */
  $("#btnSearch").addEventListener("click", runSearch);
  $("#q-location").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

  async function runSearch() {
    const location = $("#q-location").value.trim();
    const hint = $("#searchHint");
    if (!location) { hint.className = "hint err"; hint.textContent = "Enter a location first."; return; }
    const btn = $("#btnSearch");
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Searching…';
    hint.className = "hint"; hint.textContent = "";
    $("#searchResults").innerHTML = '<div class="loading-block"><span class="spinner"></span><div>Scanning the map for businesses with no website…</div></div>';

    const payload = {
      location,
      keyword: $("#q-keyword").value.trim(),
      radius: parseInt($("#q-radius").value, 10),
      max: parseInt($("#q-max").value, 10),
    };
    try {
      const res = await api("/api/search", payload);
      btn.disabled = false; btn.innerHTML = searchIcon();
      if (res.error) { $("#searchResults").innerHTML = ""; hint.className = "hint err"; hint.textContent = res.error; return; }
      STATE.lastResults = res.leads || [];
      renderResults(res);
    } catch (e) {
      btn.disabled = false; btn.innerHTML = searchIcon();
      $("#searchResults").innerHTML = ""; hint.className = "hint err"; hint.textContent = "Something went wrong. Try again.";
    }
  }
  function searchIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg> Search'; }

  function renderResults(res) {
    const wrap = $("#searchResults");
    if (!res.leads.length) {
      wrap.innerHTML = `<div class="leads-empty">No website-less businesses found there. Try a bigger radius or a different area.</div>`;
      return;
    }
    const savedIds = new Set(STATE.leads.map((l) => l.id));
    const head = `<div class="results-head"><h3>${res.count} leads found near ${esc(res.location.split(",")[0])}</h3>
      <button class="btn btn--green btn--sm" id="saveAll">＋ Save all to my leads</button></div>`;
    wrap.innerHTML = head + res.leads.map((l) => leadCardHTML(l, savedIds.has(l.id))).join("");

    $("#saveAll").addEventListener("click", async () => {
      await api("/api/leads/save", { leads: res.leads });
      await loadLeads();
      toast(`Saved ${res.leads.length} leads ✓`);
      renderResults(res);
    });
    bindCardButtons(wrap, res.leads);
  }

  function leadCardHTML(l, saved) {
    return `<div class="lead-card" data-id="${l.id}">
      <div class="score-badge ${scoreClass(l.score)}">${l.score}</div>
      <div class="lead-main">
        <div class="lead-name">${esc(l.name)} <span class="lead-cat">${esc(l.category)}</span></div>
        <div class="lead-meta">${metaLine(l)}</div>
      </div>
      <div class="lead-actions">
        ${saved
          ? `<span class="tag-saved">✓ Saved</span><button class="btn btn--ghost btn--sm" data-open="${l.id}">Open</button>`
          : `<button class="btn btn--ghost btn--sm" data-save="${l.id}">＋ Save</button>`}
      </div>
    </div>`;
  }

  function bindCardButtons(wrap, leads) {
    $$("[data-save]", wrap).forEach((b) =>
      b.addEventListener("click", async () => {
        const l = leads.find((x) => x.id === b.dataset.save);
        await api("/api/leads/save", { leads: [l] });
        await loadLeads();
        toast("Saved ✓");
        b.closest(".lead-card").querySelector(".lead-actions").innerHTML =
          `<span class="tag-saved">✓ Saved</span><button class="btn btn--ghost btn--sm" data-open="${l.id}">Open</button>`;
        b.closest(".lead-card").querySelector("[data-open]").addEventListener("click", () => openDrawer(l.id));
      })
    );
    $$("[data-open]", wrap).forEach((b) => b.addEventListener("click", () => openDrawer(b.dataset.open)));
  }

  /* ════════ LEADS ════════ */
  async function loadLeads() {
    STATE.leads = await api("/api/leads");
    $("#leadCount").textContent = STATE.leads.length;
  }
  $("#leadFilter").addEventListener("input", renderLeads);
  $("#statusFilter").addEventListener("change", renderLeads);

  // populate status filter once
  (function fillStatusFilter() {
    const sel = $("#statusFilter");
    STATUSES.forEach((s) => { const o = document.createElement("option"); o.value = s.key; o.textContent = s.label; sel.appendChild(o); });
  })();

  function renderStatBar() {
    const bar = $("#statBar");
    if (!STATE.leads.length) { bar.innerHTML = ""; return; }
    const counts = {};
    STATE.leads.forEach((l) => { const k = (l.status || "new"); counts[k] = (counts[k] || 0) + 1; });
    const active = $("#statusFilter").value;
    const cells = [`<div class="stat ${active === "" ? "active" : ""}" data-st=""><b>${STATE.leads.length}</b><span>All</span></div>`];
    STATUSES.forEach((s) => {
      if (!counts[s.key]) return;
      cells.push(`<div class="stat ${active === s.key ? "active" : ""}" data-st="${s.key}"><span class="dot" style="background:${s.color}"></span><b>${counts[s.key]}</b><span>${s.label}</span></div>`);
    });
    bar.innerHTML = cells.join("");
    $$(".stat", bar).forEach((c) => c.addEventListener("click", () => { $("#statusFilter").value = c.dataset.st; renderLeads(); }));
  }

  function renderLeads() {
    const wrap = $("#leadsTable");
    renderStatBar();
    const term = $("#leadFilter").value.toLowerCase();
    const st = $("#statusFilter").value;
    let list = STATE.leads.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    if (term) list = list.filter((l) => l.name.toLowerCase().includes(term));
    if (st) list = list.filter((l) => (l.status || "new") === st);

    if (!STATE.leads.length) {
      wrap.innerHTML = `<div class="leads-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
        <div>No leads saved yet.<br/>Head to <b>Find leads</b> and run a search.</div></div>`;
      return;
    }
    if (!list.length) { wrap.innerHTML = `<div class="leads-empty">No leads match that filter.</div>`; return; }

    wrap.innerHTML = `<div class="results">` + list.map((l) => {
      const status = l.status || "new";
      const opts = STATUSES.map((s) => `<option value="${s.key}" ${s.key === status ? "selected" : ""}>${s.label}</option>`).join("");
      return `<div class="lead-card" data-id="${l.id}">
        <div class="score-badge ${scoreClass(l.score)}">${l.score}</div>
        <div class="lead-main">
          <div class="lead-name">${esc(l.name)} <span class="lead-cat">${esc(l.category)}</span>
            ${l.site_generated ? '<span class="tag-saved">● site ready</span>' : ""}</div>
          <div class="lead-meta">${metaLine(l)}</div>
          <div class="next-hint">${esc(stOf(l).next)}</div>
        </div>
        <div class="lead-actions">
          <select class="quick-status" data-qs="${l.id}" title="Change status">${opts}</select>
          <button class="btn btn--primary btn--sm" data-open="${l.id}">Open</button>
          <button class="icon-btn danger" data-del="${l.id}" title="Delete lead">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>`;
    }).join("") + `</div>`;

    $$("[data-open]", wrap).forEach((b) => b.addEventListener("click", () => openDrawer(b.dataset.open)));
    $$("[data-qs]", wrap).forEach((sel) =>
      sel.addEventListener("change", async () => {
        await api("/api/lead/update", { id: sel.dataset.qs, fields: { status: sel.value } });
        const l = STATE.leads.find((x) => x.id === sel.dataset.qs); if (l) l.status = sel.value;
        renderLeads(); toast("Status updated ✓");
      })
    );
    $$("[data-del]", wrap).forEach((b) =>
      b.addEventListener("click", async () => {
        const l = STATE.leads.find((x) => x.id === b.dataset.del);
        if (!confirm(`Delete "${l ? l.name : "this lead"}" from your leads?`)) return;
        await api("/api/lead/delete", { id: b.dataset.del });
        await loadLeads(); renderLeads(); toast("Lead deleted");
      })
    );
  }

  /* ════════ DRAWER (work a lead) ════════ */
  const overlay = $("#overlay"), drawer = $("#drawer");
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  function closeDrawer() { drawer.classList.remove("show"); overlay.classList.remove("show"); }

  function lead(id) { return STATE.leads.find((l) => l.id === id) || STATE.lastResults.find((l) => l.id === id); }

  async function openDrawer(id) {
    let l = lead(id);
    if (!l) return;
    if (!STATE.leads.find((x) => x.id === id)) { await api("/api/leads/save", { leads: [l] }); await loadLeads(); l = lead(id); }

    const status = l.status || "new";
    const defInbox = l.form_inbox || STATE.settings.formsubmit_email || STATE.settings.operator_email || "";
    drawer.innerHTML = `
      <div class="drawer__head">
        <div>
          <h2>${esc(l.name)}</h2>
          <div class="lead-meta">${metaLine(l)}</div>
          <div class="status-select">
            ${statusChip(status)}
            <select class="mini-input" id="statusPick" style="max-width:170px">
              ${STATUSES.map((s) => `<option value="${s.key}" ${s.key === status ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
            ${l.phone ? `<button class="btn btn--ghost btn--sm" id="copyPhone">Copy phone</button>` : ""}
            <a class="btn btn--ghost btn--sm" href="${esc(l.maps_url)}" target="_blank" rel="noopener">Map ↗</a>
          </div>
        </div>
        <button class="drawer__close" id="drawerClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button>
      </div>
      <div class="drawer__body">

        <div class="step-block">
          <div class="step-block__head"><span class="step-num">1</span><h3>Find their email</h3>
            ${l.email ? '<span class="step-done">✓ have it</span>' : ""}</div>
          <div class="step-block__body">
            <p>Map data ${l.email ? "already included an email — confirm it below." : "rarely includes email. Copy this prompt, paste it to Claude, and it'll dig up the public email + socials for you."}</p>
            <div class="row-btns">
              <button class="btn btn--ghost btn--sm" id="btnPrompt">Copy research prompt for Claude</button>
              <a class="btn btn--ghost btn--sm" href="https://www.google.com/search?q=${encodeURIComponent(l.name + " " + (l.city || "") + " email contact")}" target="_blank" rel="noopener">Google them ↗</a>
            </div>
            <div class="email-field" style="margin-top:12px">
              <label class="field"><span style="font-size:.8rem;color:var(--ink-soft);font-weight:600">Their email</span>
              <input id="leadEmail" type="email" placeholder="paste the email you found" value="${esc(l.email || "")}" /></label>
            </div>
            <div class="row-btns"><button class="btn btn--green btn--sm" id="saveEmail">Save email</button>
              ${l.email ? `<button class="btn btn--ghost btn--sm" id="copyEmailAddr">Copy email</button>` : ""}</div>
          </div>
        </div>

        <div class="step-block">
          <div class="step-block__head"><span class="step-num">2</span><h3>Generate their demo site</h3>
            ${l.site_generated ? '<span class="step-done">✓ generated</span>' : ""}</div>
          <div class="step-block__body">
            <p>One click builds a unique, personalized site for ${esc(l.name)}. Pick which tools to include:</p>
            <div class="feature-toggles" id="features">
              <label class="toggle on"><input type="checkbox" data-f="form" checked> Lead form</label>
              <label class="toggle"><input type="checkbox" data-f="booking"> Booking</label>
              <label class="toggle"><input type="checkbox" data-f="shop"> Shop</label>
              <label class="toggle"><input type="checkbox" data-f="languages"> 2nd language</label>
            </div>
            <div class="email-field">
              <label class="field"><span style="font-size:.8rem;color:var(--ink-soft);font-weight:600">📨 Feedback form sends to <span style="color:var(--ink-faint);font-weight:400">— your email now, the client's email for their live site</span></span>
              <input id="formInbox" type="email" placeholder="where this site's messages go" value="${esc(defInbox)}" /></label>
            </div>
            <div class="row-btns">
              <button class="btn btn--primary btn--sm" id="btnGenSite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18" stroke-linecap="round"/></svg> ${l.site_generated ? "Regenerate" : "Generate site"}</button>
              ${l.site_generated && l.site_slug ? `<a class="btn btn--ghost btn--sm" href="/output/${l.site_slug}/index.html" target="_blank" rel="noopener">Preview ↗</a>` : ""}
            </div>
            <div id="genResult"></div>
          </div>
        </div>

        ${contentEditorHTML(l)}

        <div class="step-block">
          <div class="step-block__head"><span class="step-num">4</span><h3>Write the pitch email</h3></div>
          <div class="step-block__body">
            <p>Personalized to ${esc(l.name)}, with the intake questions built in and <b>no prices</b>.</p>
            <button class="btn btn--primary btn--sm" id="btnGenEmail">Generate email</button>
            <div id="emailResult" style="margin-top:14px"></div>
          </div>
        </div>

        <div class="step-block">
          <div class="step-block__head"><span class="step-num">5</span><h3>Notes</h3></div>
          <div class="step-block__body">
            <textarea id="leadNotes" class="codebox" style="width:100%;min-height:80px;font-family:inherit" placeholder="Anything to remember about this lead…">${esc(l.notes || "")}</textarea>
            <div class="row-btns"><button class="btn btn--ghost btn--sm" id="saveNotes">Save notes</button>
              <button class="btn btn--ghost btn--sm" id="delLead" style="color:var(--rose);border-color:rgba(240,109,138,.3)">Delete lead</button></div>
          </div>
        </div>

      </div>`;

    overlay.classList.add("show"); drawer.classList.add("show");
    bindDrawer(l);
  }

  function bindDrawer(l) {
    $("#drawerClose").addEventListener("click", closeDrawer);
    if ($("#copyPhone")) $("#copyPhone").addEventListener("click", () => copy(l.phone, "Phone copied"));

    $("#statusPick").addEventListener("change", async (e) => {
      const v = e.target.value;
      await api("/api/lead/update", { id: l.id, fields: { status: v } });
      l.status = v; await loadLeads();
      const chip = $(".status-select .status-chip");
      const s = ST[v]; chip.style.color = s.color; chip.style.background = s.color + "22"; chip.textContent = s.label;
      toast("Status updated ✓");
    });

    $$("#features .toggle").forEach((t) => {
      const cb = t.querySelector("input");
      cb.addEventListener("change", () => t.classList.toggle("on", cb.checked));
    });

    $("#btnPrompt").addEventListener("click", async () => {
      const res = await api("/api/research-prompt", { lead: l });
      copy(res.prompt, "Prompt copied — paste it to Claude");
    });
    $("#saveEmail").addEventListener("click", async () => {
      const email = $("#leadEmail").value.trim();
      const fields = { email };
      if (email && (l.status || "new") === "new") fields.status = "contact_found";
      await api("/api/lead/update", { id: l.id, fields });
      Object.assign(l, fields); await loadLeads();
      toast(email ? "Email saved ✓" : "Cleared");
      if (fields.status) updateChip("contact_found");
    });
    if ($("#copyEmailAddr")) $("#copyEmailAddr").addEventListener("click", () => copy(l.email, "Email copied"));

    $("#btnGenSite").addEventListener("click", async () => {
      const btn = $("#btnGenSite"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Building…';
      const features = {}; $$("#features input").forEach((cb) => (features[cb.dataset.f] = cb.checked));
      const formInbox = $("#formInbox").value.trim();
      // persist the per-project inbox on the lead so it's remembered + used in generation
      l.form_inbox = formInbox;
      await api("/api/lead/update", { id: l.id, fields: { form_inbox: formInbox } });
      const res = await api("/api/generate-site", { lead: l, features });
      btn.disabled = false;
      if (res.error) { toast(res.error, true); btn.textContent = "Generate site"; return; }
      l.site_generated = true; l.site_slug = res.slug; await loadLeads();
      btn.innerHTML = "✓ Done — Regenerate";
      $("#genResult").innerHTML = `<div class="row-btns" style="margin-top:12px">
        <a class="btn btn--green btn--sm" href="${res.preview_url}" target="_blank" rel="noopener">Open preview ↗</a>
        <span class="hint">Saved to <code style="color:#cfe0ff">output/${res.slug}/</code></span></div>
        <p class="hint" style="margin-top:8px">Form messages will go to <b style="color:#cfe0ff">${esc(formInbox || "your email")}</b>. To attach in your email: zip the <code style="color:#cfe0ff">output/${res.slug}</code> folder, or send the preview link.</p>`;
      toast("Demo site generated ✓");
    });

    $("#btnGenEmail").addEventListener("click", async () => {
      const preview = l.site_slug ? location.origin + "/output/" + l.site_slug + "/index.html" : null;
      const res = await api("/api/generate-email", { lead: l, preview_url: preview });
      const mailto = `mailto:${encodeURIComponent(l.email || "")}?subject=${encodeURIComponent(res.subject)}&body=${encodeURIComponent(res.body)}`;
      $("#emailResult").innerHTML = `
        <div class="email-field"><label class="field"><span style="font-size:.8rem;color:var(--ink-soft);font-weight:600">Subject</span>
          <input id="emSubject" value="${esc(res.subject)}" /></label></div>
        <div class="codebox" id="emBody">${esc(res.body)}</div>
        <div class="row-btns">
          <button class="btn btn--primary btn--sm" id="copyEmail">Copy email</button>
          <button class="btn btn--ghost btn--sm" id="copySubject">Copy subject</button>
          <a class="btn btn--green btn--sm" href="${mailto}" id="openMail">Open in mail app ↗</a>
        </div>
        <p class="hint" style="margin-top:8px">${l.email ? "" : "⚠ No email saved yet — add it in step 1 to enable the mail button."} Tip: attach the demo (step 2) before sending.</p>`;
      $("#copyEmail").addEventListener("click", () => copy($("#emBody").textContent, "Email body copied"));
      $("#copySubject").addEventListener("click", () => copy($("#emSubject").value, "Subject copied"));
      if (!l.email) $("#openMail").addEventListener("click", (e) => { e.preventDefault(); toast("Add their email in step 1 first", true); });
      else $("#openMail").addEventListener("click", async () => {
        const cur = l.status || "new";
        if (["new", "contact_found", "demo_ready"].includes(cur)) {
          await api("/api/lead/update", { id: l.id, fields: { status: "emailed" } });
          l.status = "emailed"; await loadLeads(); updateChip("emailed");
        }
      });
    });

    $("#saveNotes").addEventListener("click", async () => {
      const notes = $("#leadNotes").value;
      await api("/api/lead/update", { id: l.id, fields: { notes } });
      l.notes = notes; toast("Notes saved ✓");
    });
    $("#delLead").addEventListener("click", async () => {
      if (!confirm(`Delete ${l.name} from your leads?`)) return;
      await api("/api/lead/delete", { id: l.id });
      await loadLeads(); closeDrawer(); renderLeads(); toast("Lead deleted");
    });

    function updateChip(key) {
      const chip = $(".status-select .status-chip"); const s = ST[key];
      chip.style.color = s.color; chip.style.background = s.color + "22"; chip.textContent = s.label;
      $("#statusPick").value = key;
    }

    bindEditor(l);
  }

  /* ════════ CONTENT EDITOR (work on the site for free, locally) ════════ */
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "business";

  // Shrink + compress a chosen photo in the browser before saving (keeps sites fast, files small).
  function resizeImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
          const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject; img.src = rd.result;
      };
      rd.onerror = reject; rd.readAsDataURL(file);
    });
  }

  const edVal = (v) => esc(v == null ? "" : v);
  function edText(key, val, ph) {
    return `<label class="ed-field"><span>${esc(ph)}</span><input data-ed="${key}" type="text" value="${edVal(val)}" placeholder="Leave blank = keep auto text"></label>`;
  }
  function edArea(key, val, ph) {
    return `<label class="ed-field"><span>${esc(ph)}</span><textarea data-ed="${key}" rows="2" placeholder="Leave blank = keep auto text">${edVal(val)}</textarea></label>`;
  }
  function photoSlot(sg, slotName, path, label) {
    const t = path
      ? `<img src="/output/${sg}/${path}?t=${Date.now()}" alt="">`
      : `<span>${esc(label)}</span>`;
    return `<div class="photo-slot${path ? " has" : ""}">
      <div class="photo-thumb">${t}</div>
      <label class="mini-pick">${path ? "Replace" : "＋ Add"}<input type="file" accept="image/*" data-img="${slotName}" hidden></label>
      ${path ? `<button class="mini-clear" data-clear="${slotName}" title="Remove">×</button>` : ""}
    </div>`;
  }
  function buildPhotos(l) {
    const c = l.content || {}, sg = slug(l.name), g = c.gallery || [];
    let h = `<div class="photo-row">${photoSlot(sg, "hero", c.hero_image, "Hero / main")}${photoSlot(sg, "about", c.about_image, "About / inside")}</div>`;
    h += `<div class="ed-sub" style="margin:12px 0 6px">Gallery — up to 6</div><div class="photo-row">`;
    for (let i = 0; i < 6; i++) h += photoSlot(sg, "gallery" + i, g[i] || "", "Photo " + (i + 1));
    h += `</div>`;
    return h;
  }
  function buildShop(l) {
    const c = l.content || {}, sg = slug(l.name);
    let h = "";
    for (let i = 1; i <= 3; i++) {
      const img = c["p" + i + "img"];
      h += `<div class="ed-prod">
        ${photoSlot(sg, "p" + i + "img", img, "Item " + i)}
        <div class="ed-prod-fields">
          ${edText("p" + i + "n", c["p" + i + "n"], "Item " + i + " name")}
          ${edText("p" + i + "d", c["p" + i + "d"], "Short description")}
          ${edText("p" + i + "price", c["p" + i + "price"], "Price e.g. $9")}
        </div></div>`;
    }
    return h;
  }
  function contentEditorHTML(l) {
    const c = l.content || {};
    return `<div class="step-block" id="contentEditor">
      <div class="step-block__head"><span class="step-num">3</span><h3>Make it theirs — edit words &amp; photos</h3>
        <span class="free-tag">free</span></div>
      <div class="step-block__body">
        <p>This is where you actually <b>work on the site</b>. Change any wording, drop in real photos, then hit save &amp; it rebuilds instantly. Leave a box blank to keep the smart auto-text. None of this costs a thing — it all lives on your computer.</p>

        <details class="ed-group" open>
          <summary>✍️ Words</summary>
          <div class="ed-fields">
            ${edText("headline", c.headline, "Hero headline")}
            ${edArea("sub", c.sub, "One-line promise under the headline")}
            ${edText("about_title", c.about_title, "About section title")}
            ${edArea("about_p1", c.about_p1, "About — paragraph 1")}
            ${edArea("about_p2", c.about_p2, "About — paragraph 2 (the owner's voice)")}
            <div class="ed-pair">${edText("s1t", c.s1t, "Service 1 — title")}${edArea("s1d", c.s1d, "Service 1 — description")}</div>
            <div class="ed-pair">${edText("s2t", c.s2t, "Service 2 — title")}${edArea("s2d", c.s2d, "Service 2 — description")}</div>
            <div class="ed-pair">${edText("s3t", c.s3t, "Service 3 — title")}${edArea("s3d", c.s3d, "Service 3 — description")}</div>
            ${edArea("review1", c.review1, "Customer review 1")}
            ${edArea("review2", c.review2, "Customer review 2")}
            ${edArea("review3", c.review3, "Customer review 3")}
          </div>
        </details>

        <details class="ed-group">
          <summary>📞 Contact details <span class="ed-sub">— what shows on the site</span></summary>
          <div class="ed-fields ed-grid2">
            ${edText("address", c.address || l.address, "Street address")}
            ${edText("phone", c.phone || l.phone, "Phone")}
            ${edText("email", c.email || l.email, "Best email for customers")}
            ${edText("hours", c.hours || l.hours, "Opening hours")}
          </div>
        </details>

        <details class="ed-group">
          <summary>📷 Photos <span class="ed-sub">— auto-resized, stored with the site</span></summary>
          <div id="edPhotos">${buildPhotos(l)}</div>
        </details>

        <details class="ed-group">
          <summary>🛒 Shop items <span class="ed-sub">— only appear if Shop is on (step 2)</span></summary>
          <div id="edShop">${buildShop(l)}</div>
        </details>

        <div class="row-btns" style="margin-top:14px">
          <button class="btn btn--primary btn--sm" data-ed-save>Save content &amp; rebuild site</button>
          <span class="hint" id="edHint"></span>
        </div>
      </div>
    </div>`;
  }

  function setContentImage(l, slotName, path) {
    l.content = l.content || {};
    if (slotName === "hero") { if (path) l.content.hero_image = path; else delete l.content.hero_image; }
    else if (slotName === "about") { if (path) l.content.about_image = path; else delete l.content.about_image; }
    else if (slotName.startsWith("gallery")) {
      const i = +slotName.slice(7);
      const g = l.content.gallery || (l.content.gallery = ["", "", "", "", "", ""]);
      g[i] = path || "";
    } else { if (path) l.content[slotName] = path; else delete l.content[slotName]; }
  }
  function collectText(l) {
    l.content = l.content || {};
    $$("#contentEditor [data-ed]").forEach((el) => {
      const k = el.dataset.ed, v = el.value.trim();
      if (v) l.content[k] = v; else delete l.content[k];
    });
  }
  function refreshPhotos(l) {
    collectText(l); // keep any typed words before re-rendering tiles
    const p = $("#edPhotos"); if (p) p.innerHTML = buildPhotos(l);
    const s = $("#edShop"); if (s) s.innerHTML = buildShop(l);
  }
  function bindEditor(l) {
    const root = $("#contentEditor"); if (!root) return;
    l.content = l.content || {};
    root.addEventListener("change", async (e) => {
      const inp = e.target.closest("input[type=file][data-img]"); if (!inp) return;
      const slotName = inp.dataset.img, file = inp.files[0]; if (!file) return;
      const hint = $("#edHint"); hint.className = "hint"; hint.textContent = "Optimizing photo…";
      try {
        const dataUrl = await resizeImage(file, 1600);
        const res = await api("/api/upload-image", { name: l.name, slot: slotName, data_url: dataUrl });
        if (res.error) { hint.className = "hint err"; hint.textContent = res.error; return; }
        setContentImage(l, slotName, res.path);
        await api("/api/lead/update", { id: l.id, fields: { content: l.content } });
        refreshPhotos(l);
        hint.className = "hint ok"; hint.textContent = "Photo added ✓ — hit rebuild to see it on the site";
      } catch (err) { hint.className = "hint err"; hint.textContent = "Couldn't read that image — try a JPG or PNG."; }
    });
    root.addEventListener("click", async (e) => {
      const clr = e.target.closest("[data-clear]");
      if (clr) {
        setContentImage(l, clr.dataset.clear, "");
        await api("/api/lead/update", { id: l.id, fields: { content: l.content } });
        refreshPhotos(l);
        return;
      }
      if (e.target.closest("[data-ed-save]")) await saveContentAndRegen(l);
    });
  }
  async function saveContentAndRegen(l) {
    collectText(l);
    const hint = $("#edHint"); hint.className = "hint"; hint.textContent = "Saving & rebuilding…";
    await api("/api/lead/update", { id: l.id, fields: { content: l.content } });
    const features = {}; $$("#features input").forEach((cb) => (features[cb.dataset.f] = cb.checked));
    const fi = $("#formInbox"); if (fi && fi.value.trim()) l.form_inbox = fi.value.trim();
    const res = await api("/api/generate-site", { lead: l, features });
    if (res.error) { hint.className = "hint err"; hint.textContent = res.error; return; }
    l.site_generated = true; l.site_slug = res.slug; await loadLeads();
    hint.className = "hint ok";
    hint.innerHTML = `Saved &amp; rebuilt ✓ &nbsp;<a href="${res.preview_url}?t=${Date.now()}" target="_blank" rel="noopener" style="color:#9cbcff;text-decoration:underline">Open preview ↗</a>`;
    toast("Site updated with your content ✓");
  }

  /* ════════ EXPORT CSV ════════ */
  $("#btnExport").addEventListener("click", () => {
    if (!STATE.leads.length) return toast("No leads to export", true);
    const cols = ["score", "name", "category", "phone", "email", "address", "city", "hours", "status", "form_inbox", "notes", "maps_url"];
    const rows = [cols.join(",")].concat(
      STATE.leads.map((l) => cols.map((c) => `"${String(l[c] == null ? "" : l[c]).replace(/"/g, '""')}"`).join(","))
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
    toast("CSV exported ✓");
  });

  /* ════════ SETTINGS ════════ */
  async function loadSettings() {
    STATE.settings = await api("/api/settings");
    Object.keys(STATE.settings).forEach((k) => { const el = $("#s-" + k); if (el) el.value = STATE.settings[k]; });
    updateSetupFlag();
  }
  function updateSetupFlag() {
    const flag = $("#setupFlag");
    const s = STATE.settings;
    const done = s.operator_email && s.operator_email !== "you@email.com" && s.studio_name && s.studio_name !== "Your Studio";
    if (done) { flag.className = "setup-flag ok"; flag.textContent = "✓ Studio set up"; }
    else { flag.className = "setup-flag warn"; flag.innerHTML = "⚠ Finish Studio setup so emails & sites use your real info"; }
  }
  $("#btnSaveSettings").addEventListener("click", async () => {
    const payload = {};
    ["studio_name", "operator_name", "operator_email", "operator_phone", "booking_url", "formsubmit_email", "signature"]
      .forEach((k) => (payload[k] = $("#s-" + k).value.trim()));
    if (!payload.formsubmit_email) payload.formsubmit_email = payload.operator_email;
    const res = await api("/api/settings/save", payload);
    STATE.settings = res.settings;
    const hint = $("#settingsHint"); hint.className = "hint ok"; hint.textContent = "Saved ✓";
    setTimeout(() => (hint.textContent = ""), 2000);
    updateSetupFlag(); toast("Studio setup saved ✓");
  });

  /* ════════ THE FLOW ════════ */
  const FLOW = [
    {
      tag: "$0", cls: "free", title: "Build it — right here on your computer",
      sub: "Everything in this phase is free and offline. No accounts, no card, nothing bought.",
      steps: [
        { t: "<b>Find a business</b> with no website in <b>Find leads</b>, and save it." },
        { t: "<b>Open the lead → step 2 → Generate site.</b> A unique, personalized demo is built in one click into your <code>output/</code> folder." },
        { t: "<b>Preview it</b> — the preview link opens the real site in your browser. This is the live thing, running from your own machine." },
        {
          t: "<b>Make it theirs (step 3).</b> Change any words, drop in real photos, hit <b>rebuild</b>. Repeat as much as you like. This is \"working on the website\" — and it costs nothing.",
          d: `<p>Open any saved lead and scroll to <b>step 3 — Make it theirs</b>. You can edit:</p>
              <ul><li>Every headline, paragraph, service and review (blank = keep the smart auto-text)</li>
              <li>Real photos — they're shrunk automatically and saved next to the site</li>
              <li>Contact details and shop items</li></ul>
              <p>Hit <b>Save content &amp; rebuild site</b> and the preview updates instantly. Do this 1 time or 50 times — still $0.</p>`
        },
      ],
    },
    {
      tag: "$0", cls: "free", title: "Show the client — still nothing bought",
      sub: "Put the site on the internet for free with a shareable link. No domain, no account, no payment.",
      steps: [
        {
          t: "<b>Drag the site folder onto Netlify Drop</b> → you get a public link like <code>your-site.netlify.app</code> in ~10 seconds.",
          d: `<ol>
              <li>Find the folder <code>output/&lt;business-name&gt;</code> on your computer.</li>
              <li>Go to <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">app.netlify.com/drop</a>.</li>
              <li><b>Drag the whole folder</b> onto the page. Wait a few seconds.</li>
              <li>It hands you a free live link. That's the site, online, free — no signup needed to get the link (make a free account only if you want to keep a tidy dashboard).</li>
              </ol>
              <div class="tipbox">This is the link you put in your pitch email so the client can open it on their phone, anywhere.</div>`
        },
        { t: "<b>Send the pitch.</b> Open the lead → step 4 → Generate email. It's warm, personal, has the intake questions, and <b>no prices</b>. Paste in the Netlify link and send." },
        { t: "Move the lead to <b>Emailed</b>. (Opening the mail button does this for you.)" },
      ],
    },
    {
      tag: "money IN", cls: "free", title: "They say yes — you get paid first",
      sub: "The deal closes before you spend a cent of your own. Money comes in, then a tiny bit goes out.",
      steps: [
        { t: "They reply → mark the lead <b>Replied</b>." },
        { t: "<b>Send your price</b> (Pricing tab → copy a package) and take a <b>50% deposit</b> before building the real version. Now their money is in your pocket." },
        { t: "<b>Collect their real stuff</b> — photos, hours, reviews, best email — and drop it straight into the step-3 editor. Mark the lead <b>In progress</b>." },
      ],
    },
    {
      tag: "~$12", cls: "pay", title: "Go live — the first and only real cost",
      sub: "Now — and only now — you buy a domain. About $12/year, and you bill it back to the client. Everything else stays free.",
      steps: [
        {
          t: "<b>Buy the domain</b> (their web address, e.g. <code>tonys.com</code>). ~$12/year. Register it on <b>your</b> account so you manage it.",
          d: `<ol>
              <li>Go to <a href="https://www.namecheap.com" target="_blank" rel="noopener">Namecheap</a> (or Porkbun / Cloudflare).</li>
              <li>Search the business name. Try <code>.com</code>; if taken, add the city or try <code>.co</code>.</li>
              <li>Check out (~$10–13). Turn ON auto-renew + free domain privacy.</li>
              </ol>
              <div class="tipbox">💰 You pay ~$12, you bill the client ~$16/yr as a flat "domain + management" line. That covers it and pays you to handle renewals.</div>`
        },
        {
          t: "<b>Connect the domain to the site</b> so the address shows their site. The padlock 🔒 (HTTPS/SSL) then turns on by itself — free.",
          d: `<ol>
              <li>Re-drop the final folder to Netlify (or open your existing site there).</li>
              <li>Netlify → <em>Domain settings</em> → <em>Add a custom domain</em> → type the domain → <em>Set up Netlify DNS</em>. It shows 4 nameservers.</li>
              <li>Namecheap → your domain → <em>Nameservers</em> → <em>Custom DNS</em> → paste Netlify's 4 → save.</li>
              <li>Wait 15 min–a few hours. Done: the domain loads the site and the padlock appears automatically.</li>
              </ol>
              <div class="tipbox">SSL = that padlock. Netlify creates it for you, free. You click nothing for it.</div>`
        },
        {
          t: "<b>Point the feedback form at THEIR email</b>, then rebuild. First message triggers a one-time \"confirm\" click.",
          d: `<ol>
              <li>Open the lead → step 2 → the <b>\"Feedback form sends to\"</b> box. While testing, keep your own email; for the live site, switch it to theirs and rebuild.</li>
              <li>The first time the form is used, the free <b>FormSubmit</b> service emails that address a confirm link. Click it once. After that, every message lands in the inbox, nicely formatted.</li>
              </ol>
              <div class="tipbox">Each lead remembers its own form inbox, so juggling several clients stays easy.</div>`
        },
        {
          t: "<b>Booking?</b> Set up a free Cal.com per client and paste the link into Studio setup; toggle Booking on and rebuild.",
          d: `<ol>
              <li><a href="https://cal.com" target="_blank" rel="noopener">cal.com</a> → sign up free (use the client's Google so it's <b>their</b> calendar).</li>
              <li>Set their hours, make an Event Type (e.g. \"Table for 2\", 30 min). You get a link like <code>cal.com/their-name/table</code>.</li>
              <li>Paste it into <b>Studio setup → Booking link</b>, toggle Booking ON in step 2, rebuild — it embeds itself.</li>
              </ol>`
        },
        { t: "Deliver, collect the <b>other 50%</b>, mark the lead <b>Done ✅</b>." },
      ],
    },
    {
      tag: "$0 / auto", cls: "free", title: "Keep it running — the \"care plan\", demystified",
      sub: "You worried about this part. Here's the truth: almost all of it is free and automatic. You barely lift a finger.",
      steps: [
        {
          t: "<b>\"Hosting &amp; SSL\"</b> → Netlify does both, free, forever. You do nothing.",
          d: `<p>Hosting = the site's files sitting on the internet. SSL = the padlock. On Netlify both are <b>free and automatic</b> — there is no monthly hosting bill for sites this size, and the padlock renews itself. You never touch it.</p>`
        },
        {
          t: "<b>\"Security + automatic backups\"</b> → also automatic, and you already have a backup.",
          d: `<p>Netlify keeps every version you've ever deployed, so you can roll back with a click. On top of that, the <code>output/&lt;business&gt;</code> folder on your computer <b>is</b> a full backup — copy it to Google Drive once and you're double-covered. Nothing to buy.</p>`
        },
        {
          t: "<b>\"Domain renewal &amp; management\"</b> → once a year, automatic, ~$12.",
          d: `<p>You turned on auto-renew when you bought it, so the domain renews itself on your card each year (~$12). You literally click nothing. You bill the client back for it — that's the \"management\" part.</p>`
        },
        {
          t: "<b>\"Up to 30 min of edits / month\"</b> → this is the whole job, and it's tiny.",
          d: `<p>When a client wants a change (new hours, a photo, a price): open their lead → step 3 → edit the text or swap the photo → <b>rebuild</b> → re-drag the folder to Netlify. About 5 minutes. That's the entire monthly task.</p>
              <div class="tipbox">That's why a <b>$20/mo care plan</b> is fair on both sides: the client gets a maintained, always-on site and a human who'll make quick changes; you get steady income for a few minutes of easy work. Most months you'll do nothing at all.</div>`
        },
      ],
    },
  ];

  function renderFlow() {
    const wrap = $("#flowWrap"); if (!wrap) return;
    const banner = `<div class="flow-banner">
        <div class="flow-banner__big">You spend <span>$0</span> until the client has paid you.</div>
        <p>Build the whole site, polish it, show it, and get a yes — all free, all on your own computer. The <b>only</b> thing that ever costs money is a domain (~$12/yr), and that's the very last step, after their deposit is already in your pocket.</p>
      </div>`;
    const phases = FLOW.map((p, i) => `
      <section class="phase">
        <div class="phase__rail"><span class="phase__dot ${p.cls}">${i + 1}</span>${i < FLOW.length - 1 ? '<span class="phase__line"></span>' : ""}</div>
        <div class="phase__card">
          <div class="phase__top"><span class="phase__badge ${p.cls}">${p.tag}</span><h3>${p.title}</h3></div>
          <p class="phase__sub">${p.sub}</p>
          <ul class="phase__steps">${p.steps.map((s) => `<li>
            <span class="st-check">✓</span>
            <div class="st-body"><div class="st-t">${s.t}</div>${s.d ? `<details class="st-d"><summary>Show me exactly how</summary><div class="st-d__b">${s.d}</div></details>` : ""}</div>
          </li>`).join("")}</ul>
        </div>
      </section>`).join("");
    wrap.innerHTML = banner + `<div class="flow">${phases}</div>`;
  }

  /* ════════ PRICING ════════ */
  const PRICING = {
    packages: [
      { name: "Starter", sub: "A clean one-page site to get them online fast.", price: 290, time: "~3–5 hours of work · ready in ~1 week",
        feats: [["One-page website", 1], ["Mobile & tablet ready", 1], ["Contact form to their inbox", 1], ["Map + social links", 1], ["Basic Google SEO", 1], ["Multiple pages", 0], ["Booking / shop", 0]] },
      { name: "Standard", sub: "A full multi-page site for an established local brand.", price: 590, feat: true, time: "~8–12 hours · ready in ~2 weeks",
        feats: [["Up to 5 pages", 1], ["Everything in Starter", 1], ["Photo gallery + reviews", 1], ["Booking OR simple menu", 1], ["Google-ready SEO", 1], ["2 rounds of revisions", 1], ["Online shop / 2 languages", 0]] },
      { name: "Premium", sub: "Custom site with booking, a shop, or two languages.", price: 1200, time: "~15–22 hours · ready in ~3–4 weeks",
        feats: [["Everything in Standard", 1], ["Online booking system", 1], ["Online shop OR 2nd language", 1], ["Custom design polish", 1], ["Copywriting help", 1], ["Priority support", 1], ["Unlimited revisions (30 days)", 1]] },
    ],
    addons: [
      ["Extra page", "Any page beyond the package", "$55"],
      ["Logo & brand kit", "Simple logo, colors & fonts", "$110"],
      ["Photo session", "Real photos of the business", "$180"],
      ["Google Business setup", "Get them on Maps & Search", "$75"],
      ["Extra language", "Full translation of the site", "$120"],
      ["Copywriting", "Per page, written for them", "$40"],
      ["Rush delivery", "Bumped to the front of the line", "+25%"],
    ],
    care: { price: "$20/mo", yearly: "or $200/year", items: ["Hosting & SSL (the lock icon)", "Security + automatic backups", "Domain renewal & management included", "Up to 30 min of small edits each month"] },
  };

  function renderPricing() {
    const p = PRICING;
    const cards = p.packages.map((pk) => `
      <div class="price-card ${pk.feat ? "feat" : ""}">
        ${pk.feat ? '<span class="price-badge">Most popular</span>' : ""}
        <h3>${pk.name}</h3><div class="sub">${pk.sub}</div>
        <div class="amt">$${pk.price}<small> one-time</small></div>
        <div class="time">${pk.time}</div>
        <ul>${pk.feats.map((f) => `<li class="${f[1] ? "" : "off"}">${f[0]}</li>`).join("")}</ul>
        <button class="btn btn--ghost btn--sm copy-pkg" data-pkg="${pk.name}">Copy this package</button>
      </div>`).join("");
    const addons = p.addons.map((a) => `<div class="addon-row"><div>${a[0]}<span class="desc">${a[1]}</span></div><div class="price">${a[2]}</div></div>`).join("");
    $("#pricingWrap").innerHTML = `
      <p class="price-intro">These prices are set to be <b>fair both ways</b> — good value for a small local business getting their first website, and worth your time for casual, mostly-template work (the hours shown are realistic). Round them up for bigger cities, down for favors. Always take <b>50% upfront, 50% on launch</b>.</p>
      <div class="price-grid">${cards}</div>
      <div class="addon-table"><h3>Add-ons</h3>${addons}</div>
      <div class="care-card"><h3>Care plan — ${p.care.price} <span style="color:var(--ink-faint);font-size:.85rem;font-weight:400">${p.care.yearly}</span></h3>
        <div class="addon-row" style="border:0;padding-top:0"><div><ul style="padding-left:18px;color:var(--ink-soft);font-size:.88rem;display:grid;gap:6px;margin:0">${p.care.items.map((i) => `<li>${i}</li>`).join("")}</ul></div></div></div>
      <div class="fair-note"><b>Why this is fair:</b> a small business with no website is currently invisible on Google. A $290–$1,200 one-time site that brings in even one or two extra customers a month pays for itself fast — while the hours shown keep it worthwhile for you to do casually on the side. The <b>$20/mo care plan</b> is where steady income builds over time.</div>`;
    $$("[data-pkg]").forEach((b) => b.addEventListener("click", () => copy(packageText(b.dataset.pkg), b.dataset.pkg + " package copied")));
  }

  function packageText(name) {
    const pk = PRICING.packages.find((x) => x.name === name);
    const inc = pk.feats.filter((f) => f[1]).map((f) => "  • " + f[0]).join("\n");
    return `${pk.name} package — $${pk.price} (one-time)\n${pk.sub}\n${pk.time}\n\nIncludes:\n${inc}\n\nTerms: 50% to start, 50% when the site goes live. Hosting & domain handled for you.`;
  }
  $("#copyPriceText").addEventListener("click", () => {
    const lines = ["MY WEB DESIGN PACKAGES", ""];
    PRICING.packages.forEach((pk) => { lines.push(`${pk.name} — $${pk.price} (${pk.time})`); pk.feats.filter((f) => f[1]).forEach((f) => lines.push("  • " + f[0])); lines.push(""); });
    lines.push("ADD-ONS"); PRICING.addons.forEach((a) => lines.push(`  • ${a[0]} — ${a[2]} (${a[1]})`));
    lines.push("", `CARE PLAN — ${PRICING.care.price} ${PRICING.care.yearly}`); PRICING.care.items.forEach((i) => lines.push("  • " + i));
    lines.push("", "Terms: 50% to start, 50% on launch.");
    copy(lines.join("\n"), "Full price list copied");
  });

  /* ════════ INIT ════════ */
  (async function init() {
    await loadSettings();
    await loadLeads();
    renderLeads();
    renderPricing();
    renderFlow();
  })();
})();
