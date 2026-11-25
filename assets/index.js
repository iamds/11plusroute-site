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
    state.la = p.get("la") || ""; state.within = p.get("w") || ""; state.view = p.get("v") === "map" ? "map" : "list";
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
        <td class="name"><a href="schools/${r.slug}.html${home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : ""}">${esc(r.name)}</a>${chips}</td>
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
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve();
    if (mapLoading) return mapLoading;
    mapLoading = new Promise((res, rej) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = CDN + "maplibre-gl.min.css"; document.head.appendChild(css);
      const js = document.createElement("script"); js.src = CDN + "maplibre-gl.min.js"; js.onload = res; js.onerror = rej; document.head.appendChild(js);
    });
    return mapLoading;
  }
  const isDark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const colour = r => r.selection === "grammar" ? "#1f4e79" : r.selection === "aptitude_only" ? "#c2186b" : "#c98a00";
  const pcq = () => home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
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
  async function drawMap(list) {
    try { await loadMapLib(); } catch (e) { $("map").innerHTML = '<p class="empty">The map couldn\'t load. Check your connection.</p>'; return; }
    if (!map) {
      map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/" + (isDark() ? "dark" : "positron"),
        center: [-1.5, 52.6], zoom: 5.5, cooperativeGestures: true, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    }
    markers.forEach(m => m.remove()); markers = [];
    const bounds = new maplibregl.LngLatBounds();
    list.forEach(r => {
      if (!r.geo || r.geo.lat == null) return;
      const el = document.createElement("button"); el.type = "button"; el.className = "mpin"; el.style.background = colour(r); el.setAttribute("aria-label", r.name);
      const pop = new maplibregl.Popup({ offset: 10, maxWidth: "280px" }).setHTML(
        `<b><a href="schools/${r.slug}.html${pcq()}">${esc(r.name)}</a></b><br>${esc(r.town)} · ${GENDER[r.gender]}${r.miles != null ? ` · ${r.miles.toFixed(1)} mi` : ""}${home ? `<div class="gchips">${GS.statusChips(r._a, esc)}</div>` : ""}`);
      const mk = new maplibregl.Marker({ element: el }).setLngLat([r.geo.lng, r.geo.lat]).setPopup(pop).addTo(map);
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
    if (map.isStyleLoaded()) setRadius();
    else map.once("styledata", function retry() { map.isStyleLoaded() ? setRadius() : map.once("styledata", retry); });
    if (home) {
      const hel = document.createElement("div"); hel.className = "mhome"; hel.title = home.postcode;
      markers.push(new maplibregl.Marker({ element: hel }).setLngLat([home.lng, home.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`Your postcode: <b>${esc(home.postcode)}</b>`)).addTo(map));
      bounds.extend([home.lng, home.lat]);
      if (state.within) radius.geometry.coordinates[0].forEach(c => bounds.extend(c));
    }
    map.resize();
    let view = bounds;
    if (home) {
      // Zoom to the visitor's postcode plus the 4 nearest schools in the current list (with some margin).
      const near = list.filter(r => r.miles != null && r.geo && r.geo.lat != null).sort((a, b) => a.miles - b.miles).slice(0, 4);
      if (near.length) {
        view = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
        near.forEach(r => view.extend([r.geo.lng, r.geo.lat]));
      }
    }
    if (!view.isEmpty()) map.fitBounds(view, { padding: { top: 70, bottom: 70, left: 70, right: 70 }, maxZoom: 13, duration: 0 });
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
