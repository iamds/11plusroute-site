// Shared vocabulary labels used by both the index and school pages.
window.GS = (function () {
  const CATEGORIES = {
    looked_after:   { label: "Looked after",        short: "LAC",     cls: "c-lac" },
    disadvantaged:  { label: "Pupil Premium / FSM", short: "PP",      cls: "c-pp" },
    medical_social: { label: "Medical / social",    short: "Med/Soc", cls: "c-med" },
    sibling:        { label: "Siblings",            short: "Sibling", cls: "c-sib" },
    staff:          { label: "Staff children",      short: "Staff",   cls: "c-staff" },
    faith:          { label: "Faith",               short: "Faith",   cls: "c-faith" },
    feeder_school:  { label: "Feeder school",       short: "Feeder",  cls: "c-feeder" },
    area:           { label: "Catchment / area",    short: "Area",    cls: "c-area" },
    aptitude:       { label: "Aptitude", short: "Aptitude", cls: "c-apt" },
    score_rank:     { label: "Test rank",           short: "Rank",    cls: "c-rank" },
    distance:       { label: "Distance",            short: "Dist",    cls: "c-dist" },
    other:          { label: "Other",               short: "Other",   cls: "c-other" },
  };
  const SUBJECTS = {
    english: "English", comprehension: "Comprehension", creative_writing: "Creative writing",
    maths: "Maths", verbal_reasoning: "Verbal reasoning", non_verbal_reasoning: "Non-verbal reasoning",
    spatial_reasoning: "Spatial reasoning", music: "Music", sport: "Sport", other: "Other",
  };
  const GENDER = { boys: "Boys", girls: "Girls", mixed: "Mixed" };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtDate(d) {
    if (!d) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(d);
    if (!m) return esc(d);
    const dt = new Date(+m[1], +m[2] - 1, +m[3]);
    let s = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (m[4] && m[4] !== "23:59") s += ", " + m[4];  // midnight deadlines don't need the time
    return s;
  }
  function catBadge(cat, text) {
    const c = CATEGORIES[cat] || CATEGORIES.other;
    return `<span class="badge ${c.cls}">${esc(text || c.label)}</span>`;
  }

  // ---------- home postcode: lookup (postcodes.io, in the browser), distance and area checks ----------
  const HOME_KEY = "gs-home";
  const norm = t => String(t || "").toLowerCase().replace(/&/g, "and").replace(/\bst\.?\s/g, "st ").replace(/[^a-z0-9]+/g, " ").trim();
  async function lookupPostcode(pc) {
    const q = String(pc || "").trim();
    if (!q) throw new Error("Enter a postcode");
    let r;
    try { r = await fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(q)); }
    catch (e) { throw new Error("Couldn't reach the postcode service. Check your connection and try again."); }
    if (r.status === 404) throw new Error("That postcode wasn't recognised");
    if (!r.ok) throw new Error("The postcode service didn't respond. Try again in a moment.");
    const d = (await r.json()).result;
    return { postcode: d.postcode, lat: d.latitude, lng: d.longitude, outcode: d.outcode, sector: d.postcode.slice(0, -2).trim(),
             district: d.admin_district, county: d.admin_county, ward: d.admin_ward, parish: d.parish };
  }
  // "Use my location": browser geolocation -> nearest postcode (postcodes.io) -> fill the input and submit its form
  async function nearestPostcode() {
    if (!navigator.geolocation) throw new Error("Your browser can't share its location. Type your postcode instead.");
    const pos = await new Promise((ok, bad) => navigator.geolocation.getCurrentPosition(ok, bad, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }))
      .catch(err => { throw new Error(err && err.code === 1 ? "Location permission was turned off. Type your postcode instead." : "Couldn't find your location. Type your postcode instead."); });
    let r;
    try { r = await fetch(`https://api.postcodes.io/postcodes?lon=${pos.coords.longitude}&lat=${pos.coords.latitude}&limit=1&radius=2000`); }
    catch (e) { throw new Error("Couldn't reach the postcode service. Check your connection and try again."); }
    const d = r.ok ? (await r.json()).result : null;
    if (!d || !d.length) throw new Error("No UK postcode found near your location. Type your postcode instead.");
    return d[0].postcode;
  }
  function addLocateButton(input, form, errEl) {
    if (!input || !form || !navigator.geolocation || !window.isSecureContext || form.querySelector(".locate")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "locate"; b.title = "Use my location";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2Zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg><span>Use my location</span>';
    input.insertAdjacentElement("afterend", b);
    b.addEventListener("click", async () => {
      b.disabled = true; if (errEl) errEl.textContent = "";
      try { input.value = await nearestPostcode(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); }
      catch (err) { if (errEl) errEl.textContent = err.message; }
      b.disabled = false;
    });
  }
  // ---------- shared map helpers (MapLibre + OpenFreeMap, loaded on first use) ----------
  const MAP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/";
  let mapLoading;
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve();
    if (mapLoading) return mapLoading;
    mapLoading = new Promise((res, rej) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = MAP_CDN + "maplibre-gl.min.css"; document.head.appendChild(css);
      const js = document.createElement("script"); js.src = MAP_CDN + "maplibre-gl.min.js"; js.onload = res; js.onerror = rej; document.head.appendChild(js);
    });
    return mapLoading;
  }
  const isDark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const mapStyle = () => "https://tiles.openfreemap.org/styles/" + (isDark() ? "dark" : "positron");
  function circleGeo(lat, lng, miles) {
    const pts = [], R = 3958.8, d = miles / R;
    for (let i = 0; i <= 64; i++) {
      const brg = 2 * Math.PI * i / 64, la1 = lat * Math.PI / 180, lo1 = lng * Math.PI / 180;
      const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brg));
      const lo2 = lo1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
      pts.push([lo2 * 180 / Math.PI, la2 * 180 / Math.PI]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
  }
  // Run fn as soon as the map style accepts sources/layers. isStyleLoaded() stays false while tiles load,
  // so don't wait for it: just try, and retry on style events and a short timer. fn must be idempotent.
  function onStyle(map, fn) {
    const attempt = () => { try { fn(); return true; } catch (e) { return false; } };
    if (attempt()) return;
    let done = false, timer;
    const h = () => { if (!done && attempt()) { done = true; map.off("styledata", h); map.off("load", h); clearInterval(timer); } };
    map.on("styledata", h); map.on("load", h);
    timer = setInterval(h, 250); setTimeout(() => clearInterval(timer), 30000);
  }
  function homeMarkerEl(postcode) {
    const el = document.createElement("div"); el.className = "mhome"; el.title = "Your postcode: " + postcode;
    el.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/></svg>';
    return el;
  }
  // ---------- shortlist (kept in this browser only) ----------
  const SL_KEY = "gs-shortlist";
  const shortlist = {
    get() { try { const v = JSON.parse(localStorage.getItem(SL_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } },
    set(list) { try { localStorage.setItem(SL_KEY, JSON.stringify([...new Set(list)])); } catch (e) {} paintCount(); calSyncSoon(); document.dispatchEvent(new CustomEvent("shortlist")); },
    has(slug) { return this.get().includes(slug); },
    toggle(slug) { const l = this.get(); this.set(l.includes(slug) ? l.filter(x => x !== slug) : l.concat(slug)); return this.has(slug); },
  };
  // One-time explanation the first time someone stars a school. Returns true if it was shown.
  function shortlistTip(up) {
    try { if (localStorage.getItem("gs-sl-tip")) return false; localStorage.setItem("gs-sl-tip", "1"); } catch (e) { return false; }
    const d = document.createElement("div"); d.className = "sltip"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "About your shortlist");
    d.innerHTML = `<b>Added to your shortlist ★</b>
      <p>Star the schools you're considering. Your shortlist is saved on this device only, with no account needed.</p>
      <ul><li><a href="${up}shortlist.html"><b>★ My shortlist</b></a> at the top of every page shows these schools and their key dates.</li>
      <li>On the <a href="${up}deadlines.html?sl=1">Deadlines</a> page, tick <b>Only my shortlist</b> to get their dates in one calendar.</li>
      <li>You can share it or add all its dates to your calendar from there.</li></ul>
      <button type="button" class="btn-primary">Got it</button>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.querySelector("button").onclick = close;
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
    d.querySelector("button").focus();
    return true;
  }
  // ---------- personal shortlist calendar (Cloudflare Worker; only used once someone sets one up) ----------
  const CAL_KEY = "gs-cal";
  const calFeed = () => { const m = document.querySelector('meta[name="cal-feed"]'); return m ? m.content.replace(/\/?$/, "/") : ""; };
  const calRec = () => { try { return JSON.parse(localStorage.getItem(CAL_KEY) || "null"); } catch (e) { return null; } };
  let calTimer = null;
  function calSyncSoon() {
    const rec = calRec(), feed = calFeed();
    if (!rec || !feed) return;
    clearTimeout(calTimer);
    calTimer = setTimeout(() => {
      fetch(feed + "api/shortlist", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
        body: JSON.stringify({ id: rec.id, key: rec.key, slugs: shortlist.get() }) }).catch(() => {});
    }, 600);
  }
  async function ensureShortlistCalendar() {
    const feed = calFeed();
    if (!feed) throw new Error("no feed");
    let rec = calRec();
    if (!rec) {
      const r = await fetch(feed + "api/shortlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: shortlist.get() }) });
      if (!r.ok) throw new Error("calendar service unavailable");
      rec = await r.json();
      try { localStorage.setItem(CAL_KEY, JSON.stringify(rec)); } catch (e) {}
    } else calSyncSoon();
    return feed + "u/" + rec.id + ".ics";
  }
  function paintCount() {
    const n = shortlist.get().length;
    document.querySelectorAll(".slcount").forEach(e => e.textContent = n ? ` (${n})` : "");
    document.querySelectorAll(".navsl").forEach(e => e.classList.toggle("has", n > 0));
  }
  window.addEventListener("storage", e => { if (e.key === SL_KEY) paintCount(); });
  const STAR = on => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
  // ---------- glossary: dotted-underline the first mention of each term; tap/hover/focus shows a short definition ----------
  function glossarize(root, entries) {
    entries = entries || window.GLOSSARY || [];
    if (!root || !entries.length) return;
    const seen = new Set([...document.querySelectorAll(".gl")].map(e => e.dataset.term));
    const SKIP = "A,BUTTON,INPUT,SELECT,TEXTAREA,LABEL,SCRIPT,STYLE,SVG,SUMMARY,H1,H2,TIME,CODE,.gl,.subjects,.kicker,.crumbs,.keybar dt,.sharemenu,.maplegend";
    const res = entries.map(e => ({ e, re: new RegExp("(" + e.match + ")", "i") }));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim().length > 2 && !n.parentElement.closest(SKIP) ? 1 : 2 });
    const queue = []; while (walker.nextNode()) queue.push(walker.currentNode);
    while (queue.length && seen.size < entries.length) {
      const node = queue.shift();
      let best = null;  // earliest unseen term in this text
      for (const { e, re } of res) {
        if (seen.has(e.term)) continue;
        const m = re.exec(node.nodeValue);
        if (m && (!best || m.index < best.m.index)) best = { e, m };
      }
      if (!best) continue;
      const { e, m } = best;
      const span = document.createElement("span"); span.className = "gl"; span.tabIndex = 0; span.dataset.term = e.term; span.dataset.def = e.def;
      span.setAttribute("role", "button"); span.setAttribute("aria-label", m[1] + ": " + e.def);
      const after = node.splitText(m.index); after.nodeValue = after.nodeValue.slice(m[1].length);
      span.textContent = m[1]; node.parentNode.insertBefore(span, after);
      seen.add(e.term);
      if (after.nodeValue.trim().length > 2) queue.unshift(after);  // the rest of this text may hold other terms
    }
  }
  let tip = null, tipFor = null;
  function showGl(el) {
    if (!tip) { tip = document.createElement("div"); tip.className = "gltip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.innerHTML = `<b>${esc(el.dataset.term)}</b><br>${esc(el.dataset.def)}`;
    tip.hidden = false; tipFor = el;
    const r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 24);
    tip.style.width = w + "px";
    tip.style.left = Math.max(12, Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - w - 12)) + "px";
    tip.style.top = (window.scrollY + r.bottom + 6) + "px";
  }
  function hideGl() { if (tip) tip.hidden = true; tipFor = null; }
  document.addEventListener("mouseover", e => { const g = e.target.closest && e.target.closest(".gl"); if (g) showGl(g); });
  document.addEventListener("mouseout", e => { const g = e.target.closest && e.target.closest(".gl"); if (g && !g.contains(e.relatedTarget)) hideGl(); });
  document.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("gl")) showGl(e.target); });
  document.addEventListener("focusout", e => { if (e.target.classList && e.target.classList.contains("gl")) hideGl(); });
  document.addEventListener("click", e => { const g = e.target.closest && e.target.closest(".gl"); if (g) { e.preventDefault(); e.stopPropagation(); tipFor === g ? hideGl() : showGl(g); } else if (tipFor) hideGl(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideGl(); });

  // Calendar buttons: subscribe in Google / Apple / Outlook (updates automatically), or download once
  function calButtons(icsUrl, name, downloadHref) {
    if (!icsUrl) return "";
    const webcal = icsUrl.replace(/^https?:/, "webcal:");
    const g = "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(webcal);
    const o = "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(icsUrl) + "&name=" + encodeURIComponent(name);
    return `<span class="calbtns"><a class="calbtn" href="${esc(g)}" target="_blank" rel="noopener">Google Calendar</a><a class="calbtn" href="${esc(webcal)}">Apple / iPhone</a><a class="calbtn" href="${esc(o)}" target="_blank" rel="noopener">Outlook</a><a class="calbtn ghost" href="${esc(downloadHref || icsUrl)}" download>Download (.ics)</a></span>`;
  }
  // One "Add to calendar" button that opens a small menu of options
  const CAL_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm12 8H5v10h14V10ZM5 8h14V6H5v2Zm2 4h4v4H7v-4Z"/></svg>';
  function calMenu(itemsHtml, label) {
    return `<div class="calwrap"><button type="button" class="sharebtn calmain" aria-haspopup="true" aria-expanded="false">${CAL_SVG}${label || "Add to calendar"}</button><div class="calmenu" hidden>${itemsHtml}</div></div>`;
  }
  function calItems(icsUrl, name, downloadHref) {
    if (!icsUrl) return "";
    const webcal = icsUrl.replace(/^https?:/, "webcal:");
    const g = "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(webcal);
    const o = "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(icsUrl) + "&name=" + encodeURIComponent(name);
    return `<a href="${esc(g)}" target="_blank" rel="noopener">Google Calendar</a><a href="${esc(webcal)}">Apple Calendar / iPhone</a><a href="${esc(o)}" target="_blank" rel="noopener">Outlook</a><a href="${esc(downloadHref || icsUrl)}" download>Download (.ics)</a><p class="small muted">Google, Apple and Outlook stay up to date if dates change.</p>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".calmain");
    document.querySelectorAll(".calwrap").forEach(w => {
      const m = w.querySelector(".calmenu"), btn = w.querySelector(".calmain");
      const open = b && w.contains(b) ? m.hidden : false;
      if (!(b && w.contains(b)) && w.contains(e.target)) return;  // clicks inside an open menu
      m.hidden = !open; btn.setAttribute("aria-expanded", String(open));
      // inside a scrolling table the menu would be clipped, so float it above the page
      if (open && w.closest(".table-wrap")) {
        const r = btn.getBoundingClientRect(), mw = Math.max(m.offsetWidth, 240);
        Object.assign(m.style, { position: "fixed", top: (r.bottom + 6) + "px", left: Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8)) + "px", right: "auto" });
      }
    });
  });
  window.addEventListener("scroll", () => document.querySelectorAll(".table-wrap .calmenu:not([hidden])").forEach(m => { m.hidden = true; }), { passive: true });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".calmenu").forEach(m => { m.hidden = true; }); });
  function loadHome() { try { return JSON.parse(localStorage.getItem(HOME_KEY) || "null"); } catch (e) { return null; } }
  function saveHome(h) { try { h ? localStorage.setItem(HOME_KEY, JSON.stringify(h)) : localStorage.removeItem(HOME_KEY); } catch (e) {} }
  function miles(a, b) {
    const R = 3958.8, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function areaStatus(a, home, d) {
    const checks = [];
    if (a.radius != null) checks.push(a.centre ? miles(home, a.centre) <= a.radius : a.centred_on_school ? d <= a.radius : null);
    const pcs = [...(a.postcode_districts || []).map(x => ["d", x]), ...(a.postcode_sectors || []).map(x => ["s", x])];
    if (pcs.length) checks.push(pcs.some(([k, x]) => k === "d" ? norm(x) === norm(home.outcode) : norm(x) === norm(home.sector)));
    if (a.units) checks.push(a.units.includes(home.postcode.replace(/\s/g, "")));
    // When an area lists wards or parishes, its councils only say where those wards are; they aren't part of the area.
    const fine = a.wards && a.wards.length;  // parish lists add to their councils (e.g. "Dartford borough plus 10 parishes")
    const near = (x, mine) => mine.some(m => m && (norm(m) === norm(x) || norm(m).includes(norm(x)) || norm(x).includes(norm(m))));
    const places = [...(fine ? [] : (a.local_authorities || []).map(x => [x, [home.district, home.county]])), ...(a.wards || []).map(x => [x, [home.ward]]), ...(a.parishes || []).map(x => [x, [home.parish]])];
    if (places.length) {
      const inCouncil = !fine || !(a.local_authorities || []).length || (a.local_authorities || []).some(x => near(x, [home.district, home.county]));
      checks.push(inCouncil && places.some(([x, mine]) => mine.some(m => m && norm(m) === norm(x))));
    }
    const known = checks.filter(c => c !== null);
    if (!known.length) return "unknown";
    return known.some(Boolean) ? "in" : "out";
  }
  function assess(g, home) {
    if (!g || g.lat == null || !home) return null;
    const d = miles(home, g);
    const areas = (g.areas || []).map(a => ({ id: a.id, name: a.name, radius: a.radius, centre: a.centre, centred_on_school: a.centred_on_school, status: areaStatus(a, home, d) }));
    return { miles: d, areas, score_based: g.score_based,
             last: g.last ? { miles: g.last.miles, year: g.last.year, within: d <= g.last.miles } : null };
  }
  function statusChips(r, esc) {
    if (!r) return "";
    const out = [];
    const inA = r.areas.find(a => a.status === "in");
    const known = r.areas.filter(a => a.status !== "unknown");
    if (inA) out.push(`<span class="gchip in" title="${esc(inA.name)}">✓ Inside priority area</span>`);
    else if (known.length) out.push(`<span class="gchip out" title="${esc(known.map(a => a.name).join("; "))}">Outside priority area</span>`);
    else if (r.areas.length) out.push(`<span class="gchip maybe">Check the catchment map</span>`);
    if (r.score_based) out.push(`<span class="gchip neutral">Places go by test score</span>`);
    return out.join("");
  }
  return { CATEGORIES, SUBJECTS, GENDER, esc, fmtDate, catBadge, lookupPostcode, addLocateButton, loadMapLib, mapStyle, isDark, circleGeo, homeMarkerEl, onStyle, loadHome, saveHome, miles, assess, statusChips, shortlist, shortlistTip, STAR, glossarize, calButtons, calMenu, calItems, ensureShortlistCalendar, calFeed };
})();
