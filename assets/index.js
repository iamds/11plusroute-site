(function () {
  const GS = window.GS;
  const { CATEGORIES, GENDER, esc } = GS;
  const data = JSON.parse(document.getElementById("index-data").textContent);
  const rows = data.schools;
  const state = { q: "", type: "", gender: "", town: "", la: "", cats: new Set(), sort: "attainment8", dir: -1, within: "", view: "list" };
  let home = GS.loadHome();

  // Restore filters (and postcode) from the query string so links can be shared; old #hash links still work.
  let pcParam = "";
  try {
    const p = new URLSearchParams(location.search.length > 1 ? location.search.slice(1) : location.hash.slice(1));
    pcParam = (p.get("pc") || "").trim();
    state.q = p.get("q") || ""; state.type = p.get("ty") || ""; state.gender = p.get("g") || ""; state.town = p.get("t") || "";
    state.la = p.get("la") || ""; state.within = p.get("w") || ""; if (p.get("only") === "sl" || p.get("sl")) { location.replace("shortlist.html" + (p.get("sl") ? "?sl=" + encodeURIComponent(p.get("sl")) : "")); return; } state.view = p.get("v") === "map" ? "map" : "list";
    if (p.get("s")) { state.sort = p.get("s"); state.dir = p.get("d") === "-1" ? -1 : 1; }
  } catch (e) {}

  const $ = id => document.getElementById(id);
  const fill = (sel, vals) => { sel.innerHTML += vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(""); };
  fill($("f-town"), [...new Set(rows.map(r => r.town))].sort());
  fill($("f-la"), [...new Set(rows.map(r => r.local_authority).filter(Boolean))].sort());


  $("f-q").value = state.q; $("f-type").value = state.type; $("f-gender").value = state.gender; $("f-town").value = state.town;
  $("f-la").value = state.la; $("f-within").value = state.within;

  // ---------- home postcode ----------
  function applyHome() {
    rows.forEach(r => { r._a = GS.assess(r.geo, home); r.miles = r._a ? Math.round(r._a.miles * 10) / 10 : null; });
    document.body.classList.toggle("has-home", !!home);
    $("f-within").disabled = !home;
    $("pc").value = home ? home.postcode : "";
    $("pc-status").innerHTML = home
      ? `Showing distances from <b>${esc(home.postcode)}</b> (straight line). <button type="button" class="linkbtn" id="pc-clear">Clear</button>`
      : `Enter your postcode to see how far each school is and whether you're in its priority area.`;
    if (home && !state.sortChosen) { state.sort = "miles"; state.dir = 1; }
    if (!home && state.sort === "miles") { state.sort = "attainment8"; state.dir = -1; }
  }
  GS.addLocateButton($("pc"), $("pc-form"), $("pc-error"));
  $("pc-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("pc-go"); btn.disabled = true; $("pc-error").textContent = "";
    try {
      home = await GS.lookupPostcode($("pc").value); GS.saveHome(home); state.sortChosen = false; applyHome(); render();
      const target = document.querySelector(".listbar");
      if (target) {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        $("pc").blur();
      }
    }
    catch (err) { $("pc-error").textContent = err.message; }
    finally { btn.disabled = false; }
  });
  document.addEventListener("click", e => {
    if (e.target.id === "pc-clear") { home = null; GS.saveHome(null); state.within = ""; $("f-within").value = ""; applyHome(); render(); }
  });

  function sync() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q); if (state.type) p.set("ty", state.type); if (state.gender) p.set("g", state.gender);
    if (state.town) p.set("t", state.town); if (state.la) p.set("la", state.la); if (state.within) p.set("w", state.within);
    if (state.view === "map") p.set("v", "map");
    if (state.sortChosen) { p.set("s", state.sort); p.set("d", state.dir); }
    const qs = p.toString();
    const pcq = home ? (qs ? "&" : "") + "pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
    history.replaceState(null, "", location.pathname + (qs || pcq ? "?" + qs + pcq : ""));
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const w = home && state.within ? +state.within : null;
    return rows.filter(r =>
      (!q || (r.name + " " + r.town + " " + (r.local_authority || "")).toLowerCase().includes(q)) &&
      (!state.type || r.selection === state.type) &&
      (!state.gender || r.gender === state.gender) &&
      (!state.town || r.town === state.town) &&
      (!state.la || r.local_authority === state.la) &&
      (w == null || (r.miles != null && r.miles <= w)) &&
      [...state.cats].every(c => (r.categories || []).includes(c)));
  }

  document.addEventListener("click", e => {
    const st = e.target.closest(".star[data-slug]");
    if (!st) return;
    e.preventDefault();
    const on = GS.shortlist.toggle(st.dataset.slug);
    if (on) GS.shortlistTip("");
    if (st.closest(".maplibregl-popup")) {  // update in place so the popup stays open
      st.classList.toggle("on", on); st.setAttribute("aria-pressed", String(on)); st.innerHTML = GS.STAR(on);
      const p = pinEls[st.dataset.slug]; if (p) paintPin(p.el, p.r);
      return;
    }
    render();
  });
  function render() {
    const list = filtered();
    const k = state.sort, d = state.dir;
    list.sort((a, b) => {
      let x = a[k], y = b[k];
      if (x == null && y == null) return a.name.localeCompare(b.name);
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * d || a.name.localeCompare(b.name);
    });
    document.querySelectorAll("th[data-sort]").forEach(th => th.setAttribute("aria-sort", th.dataset.sort === k ? (d === 1 ? "ascending" : "descending") : "none"));
    $("count").textContent = `${list.length} of ${rows.length} schools${home && state.within ? ` within ${state.within} miles` : ""}`;
    $("rows").innerHTML = list.map(r => {
      const chips = home ? `<div class="gchips">${GS.statusChips(r._a, esc)}</div>` : "";
      return `<tr>
        <td class="name"><button type="button" class="star${GS.shortlist.has(r.slug) ? " on" : ""}" data-slug="${r.slug}" aria-pressed="${GS.shortlist.has(r.slug)}" aria-label="Shortlist ${esc(r.name)}">${GS.STAR(GS.shortlist.has(r.slug))}</button><a href="schools/${r.slug}.html${home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : ""}">${esc(r.name)}</a>${chips}</td>
        <td class="num dist">${r.miles != null ? r.miles.toFixed(1) + " mi" : ""}</td>
        <td>${esc(r.town)}</td>
        <td><span class="g g-${r.gender}">${GENDER[r.gender]}</span></td>
        <td class="small">${r.selection === "grammar" ? "Grammar" : `<span class="ptype" title="${esc(r.selective_places || r.selective_places_listed || "")}">${r.selection === "aptitude_only" ? "Aptitude places" : "Partially selective"}</span>`}</td>
        <td class="num">${r.attainment8 != null ? r.attainment8.toFixed(1) : "–"}</td>
        <td class="num">${r.pan ?? ""}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="7" class="empty">No schools match these filters.</td></tr>`;
    document.querySelectorAll(".viewtoggle button").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === state.view));
    $("listview").hidden = state.view !== "list";
    $("mapview").hidden = state.view !== "map";
    if (state.view === "map") drawMap(list);
    sync();
  }

  // ---------- map (MapLibre + OpenFreeMap vector tiles: free, no API key; loaded on first use) ----------
  let map, markers = [], mapLoading;
  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/";
  const loadMapLib = GS.loadMapLib;
  const isDark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const colour = r => r.selection === "grammar" ? "#1f4e79" : r.selection === "aptitude_only" ? "#c2186b" : "#c98a00";
  const pcq = () => home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
  const circleGeo = GS.circleGeo;
  // Hover (or tap) a school to see its priority areas: circles from the index data, other shapes from assets/areas.json
  let areaShapes = null, areaShapesLoading = null, pinned = null;
  function loadAreaShapes() {
    // a script tag (not fetch) so it also works when the site is opened from local files
    if (!areaShapesLoading) areaShapesLoading = new Promise(res => {
      const js = document.createElement("script"); js.src = "assets/areas.js";
      js.onload = () => res(areaShapes = window.AREA_SHAPES || {}); js.onerror = () => res(areaShapes = {});
      document.head.appendChild(js);
    });
    return areaShapesLoading;
  }
  const areaColour = r => isDark()
    ? (r.selection === "grammar" ? "#79b4ff" : r.selection === "aptitude_only" ? "#ff7eb6" : "#f2c14e")
    : colour(r);
  const EMPTY = { type: "FeatureCollection", features: [] };
  const SEL_C = () => isDark() ? "#79b4ff" : "#1f4e79", NONSEL_C = () => isDark() ? "#c0c8d2" : "#646d78";
  function areaGeom(r, x) {
    const shapes = (areaShapes || {})[r.slug] || {};
    return shapes[x.id] ? { type: "Feature", geometry: shapes[x.id] }
      : x.radius != null && x.centre ? circleGeo(x.centre.lat, x.centre.lng, x.radius)
      : x.radius != null && x.centred_on_school ? circleGeo(r.geo.lat, r.geo.lng, x.radius) : null;
  }
  const tag = (f, c, k) => Object.assign(f, { properties: { c, k } });
  function schoolAreas(r) {
    if (!r || !r.geo || r.geo.lat == null) return EMPTY;
    const g = r.geo, feats = [];
    // merged display groups replace their member areas
    const shp = (areaShapes || {})[r.slug] || {}, grp = (g.groups || []).filter(x => shp[x.id]);
    const inGroup = new Set(grp.flatMap(x => x.members));
    const areas = (g.areas || []).filter(x => !inGroup.has(x.id)).concat(grp.map(x => ({ id: x.id, name: x.name, members: x.members })));
    if (r.selection && r.selection !== "grammar") {
      // Selective places in the selective colour, other places in the non-selective colour
      const sel = new Set(g.sel_areas || []);
      const isSel = x => sel.has(x.id) || (x.members || []).some(m => sel.has(m));
      areas.forEach(x => { const f = areaGeom(r, x); if (f) feats.push(tag(f, isSel(x) ? SEL_C() : NONSEL_C(), isSel(x) ? "sel" : "nonsel")); });
      if (g.sel_open || (sel.size && !feats.some(f => f.properties.k === "sel"))) feats.push(tag(circleGeo(g.lat, g.lng, 100), SEL_C(), "sel"));
      if (!feats.some(f => f.properties.k === "nonsel") && g.last && g.last.miles) feats.push(tag(circleGeo(g.lat, g.lng, g.last.miles), NONSEL_C(), "last"));
      return { type: "FeatureCollection", features: feats };
    }
    areas.forEach(x => { const f = areaGeom(r, x); if (f) feats.push(tag(f, areaColour(r), "area")); });
    // nothing drawable but places went by distance: last year's furthest offer, dashed
    if (!feats.length && g.last && g.last.miles) feats.push(tag(circleGeo(g.lat, g.lng, g.last.miles), areaColour(r), "last"));
    // no priority area at all, or "anywhere in the UK": show a 100-mile circle
    else if (!areas.length || areas.some(x => /anywhere/i.test(x.name || ""))) feats.push(tag(circleGeo(g.lat, g.lng, 100), areaColour(r), "area"));
    return { type: "FeatureCollection", features: feats };
  }
  function showAreas(r) {
    const src = map && map.getSource("hover-areas");
    if (!src) return;
    src.setData(schoolAreas(r));
    if (r && !areaShapes) loadAreaShapes().then(() => { if ((pinned || hovered) === r) src.setData(schoolAreas(r)); });
  }
  let hovered = null, hoverTip = null;
  // School name in a fixed corner panel (not on the map), so it never hides the home marker or the area
  function showTip(r) {
    if (!hoverTip) return;
    if (!r || r === pinned && r !== hovered) { hoverTip.hidden = true; return; }
    hoverTip.innerHTML = `<b>${esc(r.name)}</b>${r.miles != null ? ` · ${r.miles.toFixed(1)} mi` : ""}${tipNote(r)}`;
    hoverTip.hidden = false;
  }
  const tipNote = r => {
    const f = schoolAreas(r).features, has = k => f.some(x => x.properties.k === k), sw = c => `<span class="sw" style="border-color:${c}"></span>`;
    const yr = r.geo.last ? esc(String(r.geo.last.year).slice(0, 4)) : "", mi = r.geo.last ? r.geo.last.miles.toFixed(2) : "";
    const lines = [];
    if (has("sel")) lines.push(`${sw(SEL_C())}Selective places${r.geo.sel_open && !(r.geo.sel_areas || []).length ? ": by test score, from any distance" : ""}`);
    if (has("nonsel")) lines.push(`${sw(NONSEL_C())}Other places`);
    if (has("last")) lines.push(`<span class="sw dash" style="border-color:${f.find(x => x.properties.k === "last").properties.c}"></span>${r.selection && r.selection !== "grammar" ? "Other places: f" : "F"}urthest offer in ${yr}, ${mi} mi`);
    return lines.length ? `<div class="small tiplines">${lines.join("<br>")}</div>` : "";
  };
  // shortlisted schools show as stars in the school's map colour
  const pinEls = {};
  function paintPin(el, r) {
    const keep = [...el.classList].filter(c => c.startsWith("maplibregl"));
    if (GS.shortlist.has(r.slug)) {
      el.className = ["mpin", "mstar", ...keep].join(" "); el.style.background = ""; el.style.color = colour(r);
      el.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>';
    } else { el.className = ["mpin", ...keep].join(" "); el.innerHTML = ""; el.style.background = colour(r); }
  }
  async function drawMap(list) {
    loadAreaShapes();
    try { await loadMapLib(); } catch (e) { $("map").innerHTML = '<p class="empty">The map couldn\'t load. Check your connection.</p>'; return; }
    if (!map) {
      map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/" + (isDark() ? "dark" : "positron"),
        center: [-1.5, 52.6], zoom: 5.5, cooperativeGestures: true, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    }
    markers.forEach(m => m.remove()); markers = [];
    if (!hoverTip) { hoverTip = document.createElement("div"); hoverTip.className = "maptip"; hoverTip.hidden = true; hoverTip.setAttribute("aria-live", "polite"); $("map").appendChild(hoverTip); }
    const bounds = new maplibregl.LngLatBounds();
    list.forEach(r => {
      if (!r.geo || r.geo.lat == null) return;
      const el = document.createElement("button"); el.type = "button"; el.setAttribute("aria-label", r.name);
      paintPin(el, r); pinEls[r.slug] = { el, r };
      const pop = new maplibregl.Popup({ offset: 10, maxWidth: "280px" }).setHTML(
        `<button type="button" class="star${GS.shortlist.has(r.slug) ? " on" : ""}" data-slug="${r.slug}" aria-pressed="${GS.shortlist.has(r.slug)}" aria-label="Shortlist ${esc(r.name)}">${GS.STAR(GS.shortlist.has(r.slug))}</button><b><a href="schools/${r.slug}.html${pcq()}">${esc(r.name)}</a></b><br>${esc(r.town)} · ${GENDER[r.gender]}${r.miles != null ? ` · ${r.miles.toFixed(1)} mi` : ""}${home ? `<div class="gchips">${GS.statusChips(r._a, esc)}</div>` : ""}`);
      const mk = new maplibregl.Marker({ element: el }).setLngLat([r.geo.lng, r.geo.lat]).setPopup(pop).addTo(map);
      el.addEventListener("mouseenter", () => { hovered = r; showAreas(r); showTip(r); });
      el.addEventListener("mouseleave", () => { hovered = null; showAreas(pinned); showTip(pinned); });
      el.addEventListener("focus", () => { hovered = r; showAreas(r); });
      el.addEventListener("blur", () => { hovered = null; showAreas(pinned); });
      pop.on("open", () => {
        pinned = r; showAreas(r); showTip(null);
        // offer to zoom out when the school's area runs off the visible map
        const go = () => {
          const f = schoolAreas(r).features.filter(x => x.properties.k !== "sel" || (r.geo.sel_areas || []).length);
          if (!f.length) return null;
          const b = new maplibregl.LngLatBounds([r.geo.lng, r.geo.lat], [r.geo.lng, r.geo.lat]);
          f.forEach(x => { const w = c => typeof c[0] === "number" ? b.extend(c) : c.forEach(w); w(x.geometry.coordinates); });
          return b;
        };
        const b = go(), v = map.getBounds(), el = pop.getElement();
        if (b && el && !el.querySelector(".zoomarea") && !(v.contains(b.getSouthWest()) && v.contains(b.getNorthEast()))) {
          const btn = document.createElement("button"); btn.type = "button"; btn.className = "linkbtn small zoomarea"; btn.textContent = "Zoom to its priority area";
          btn.onclick = () => { pop.remove(); map.fitBounds(b, { padding: 40, maxZoom: 13, duration: 600 }); };
          el.querySelector(".maplibregl-popup-content").appendChild(btn);
        }
      });
      pop.on("close", () => { if (pinned === r) { pinned = null; showAreas(hovered); } });
      mk.getElement().setAttribute("aria-label", r.name + (r.miles != null ? `, ${r.miles.toFixed(1)} miles` : ""));
      markers.push(mk);
      bounds.extend([r.geo.lng, r.geo.lat]);
    });
    const empty = { type: "FeatureCollection", features: [] };
    const radius = home && state.within ? circleGeo(home.lat, home.lng, +state.within) : empty;
    const setRadius = () => {
      const src = map.getSource("radius");
      if (src) { src.setData(radius); return; }
      map.addSource("radius", { type: "geojson", data: radius });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#1f4e79", "fill-opacity": 0.06 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#1f4e79", "line-width": 1.5 } });
    };
    const setHover = () => {
      if (map.getSource("hover-areas")) return;
      map.addSource("hover-areas", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "hover-fill", type: "fill", source: "hover-areas", paint: { "fill-color": ["get", "c"], "fill-opacity": 0.12 } });
      map.addLayer({ id: "hover-line", type: "line", source: "hover-areas", filter: ["!=", ["get", "k"], "last"], paint: { "line-color": ["get", "c"], "line-width": 2 } });
      map.addLayer({ id: "hover-dash", type: "line", source: "hover-areas", filter: ["==", ["get", "k"], "last"], paint: { "line-color": ["get", "c"], "line-width": 2, "line-dasharray": [2, 1.5] } });
    };
    const setLayers = () => { setHover(); setRadius(); };
    GS.onStyle(map, setLayers);
    if (home) {
      const hel = GS.homeMarkerEl(home.postcode);
      markers.push(new maplibregl.Marker({ element: hel }).setLngLat([home.lng, home.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`Your postcode: <b>${esc(home.postcode)}</b>`)).addTo(map));
      bounds.extend([home.lng, home.lat]);
      if (state.within) radius.geometry.coordinates[0].forEach(c => bounds.extend(c));
    }
    map.resize();
    let view = bounds;
    if (home) {
      // Zoom to the selected distance plus 10% around the postcode (5 miles when "any distance" is chosen).
      const reach = state.within ? +state.within * 1.1 : 5;
      view = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
      circleGeo(home.lat, home.lng, reach).geometry.coordinates[0].forEach(c => view.extend(c));
    }
    if (!view.isEmpty()) map.fitBounds(view, { padding: home ? 20 : 70, maxZoom: 13, duration: 0 });
  }

  // ---------- events ----------
  $("f-q").addEventListener("input", e => { state.q = e.target.value; render(); });
  $("f-type").addEventListener("change", e => { state.type = e.target.value; render(); });
  $("f-gender").addEventListener("change", e => { state.gender = e.target.value; render(); });
  $("f-town").addEventListener("change", e => { state.town = e.target.value; render(); });
  $("f-la").addEventListener("change", e => { state.la = e.target.value; render(); });
  $("f-within").addEventListener("change", e => { state.within = e.target.value; render(); });
  $("f-reset").addEventListener("click", () => {
    Object.assign(state, { q: "", type: "", gender: "", town: "", la: "", within: "", sortChosen: false }); state.cats.clear();
    ["f-q", "f-type", "f-gender", "f-town", "f-la", "f-within"].forEach(id => $(id).value = "");
    if (home) { state.sort = "miles"; state.dir = 1; } else { state.sort = "attainment8"; state.dir = -1; }
    render();
  });
  document.querySelectorAll(".viewtoggle button").forEach(b => b.addEventListener("click", () => { state.view = b.dataset.view; render(); }));
  document.querySelectorAll("th[data-sort]").forEach(th => {
    const go = () => { const k = th.dataset.sort; state.dir = state.sort === k ? -state.dir : (k === "attainment8" ? -1 : 1); state.sort = k; state.sortChosen = true; render(); };
    th.addEventListener("click", go);
    th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
  if (location.hash.includes("s=")) state.sortChosen = true;
  const same = (a, b) => String(a || "").replace(/\s/g, "").toUpperCase() === String(b || "").replace(/\s/g, "").toUpperCase();
  applyHome();
  render();
  if (pcParam && !(home && same(home.postcode, pcParam))) {
    $("pc").value = pcParam; $("pc-status").textContent = "Looking up " + pcParam + "…";
    GS.lookupPostcode(pcParam).then(h => { home = h; GS.saveHome(h); applyHome(); render(); })
      .catch(err => { $("pc-error").textContent = err.message; applyHome(); });
  }
})();
