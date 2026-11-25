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
    if (m[4]) s += ", " + m[4];
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
    if (a.radius != null) checks.push(a.centred_on_school ? d <= a.radius : null);
    const pcs = [...(a.postcode_districts || []).map(x => ["d", x]), ...(a.postcode_sectors || []).map(x => ["s", x])];
    if (pcs.length) checks.push(pcs.some(([k, x]) => k === "d" ? norm(x) === norm(home.outcode) : norm(x) === norm(home.sector)));
    if (a.units) checks.push(a.units.includes(home.postcode.replace(/\s/g, "")));
    const places = [...(a.local_authorities || []).map(x => [x, [home.district, home.county]]), ...(a.wards || []).map(x => [x, [home.ward]]), ...(a.parishes || []).map(x => [x, [home.parish]])];
    if (places.length) checks.push(places.some(([x, mine]) => mine.some(m => m && (norm(m) === norm(x) || norm(m).includes(norm(x)) || norm(x).includes(norm(m))))));
    const known = checks.filter(c => c !== null);
    if (!known.length) return "unknown";
    return known.some(Boolean) ? "in" : "out";
  }
  function assess(g, home) {
    if (!g || g.lat == null || !home) return null;
    const d = miles(home, g);
    const areas = (g.areas || []).map(a => ({ name: a.name, status: areaStatus(a, home, d) }));
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
  return { CATEGORIES, SUBJECTS, GENDER, esc, fmtDate, catBadge, lookupPostcode, addLocateButton, loadHome, saveHome, miles, assess, statusChips };
})();
