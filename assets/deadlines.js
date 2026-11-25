(function () {
  const GS = window.GS, esc = GS.esc;
  const data = JSON.parse(document.getElementById("deadline-data").textContent);
  const S = data.schools;
  const events = data.events.map(([date, kind, si, event]) => ({ date, kind, s: S[si], event }));
  const $ = id => document.getElementById(id);
  const today = new Date().toISOString().slice(0, 10);
  const state = { within: "10", q: "", other: false, past: false };
  let home = GS.loadHome();

  let pcParam = "";
  try {
    const p = new URLSearchParams(location.search);
    pcParam = (p.get("pc") || "").trim();
    if (p.has("w")) state.within = p.get("w");
    state.q = p.get("q") || ""; state.other = p.get("o") === "1"; state.past = p.get("past") === "1";
  } catch (e) {}
  $("dl-within").value = state.within; $("dl-q").value = state.q; $("dl-other").checked = state.other; $("dl-past").checked = state.past;

  function sync() {
    const p = new URLSearchParams();
    if (home) { p.set("pc", home.postcode); if (state.within !== "10") p.set("w", state.within); }
    if (state.q) p.set("q", state.q);
    if (state.other) p.set("o", "1");
    if (state.past) p.set("past", "1");
    const qs = p.toString().replace(/%20/g, "+");
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function longDate(d) {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  let shown = [];
  function render() {
    const q = state.q.toLowerCase();
    S.forEach(s => { s._mi = home && s.lat != null ? GS.miles(home, s) : null; });
    shown = events.filter(x =>
      (state.past || x.date >= today) && (state.other || x.kind !== "other") &&
      (!home || !state.within || (x.s._mi != null && x.s._mi <= +state.within)) &&
      (!q || [x.s.name, x.s.town, x.s.test, x.event].some(t => t && t.toLowerCase().includes(q))));
    const schoolsN = new Set(shown.map(x => x.s.slug)).size;
    $("dl-count").textContent = `${shown.length} dates for ${schoolsN} school${schoolsN === 1 ? "" : "s"}`;
    $("dl-ics").disabled = !shown.length;
    let html = "", cur = "";
    const pcq = home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
    for (const x of shown) {
      const m = x.date.slice(0, 7);
      if (m !== cur) {
        if (cur) html += "</ul>";
        const [y, mm] = m.split("-").map(Number);
        html += `<h2 class="month">${new Date(y, mm - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2><ul class="evlist">`;
        cur = m;
      }
      html += `<li class="ev ev-${x.kind}"><time>${longDate(x.date)}</time><span><a href="schools/${x.s.slug}.html${pcq}">${esc(x.s.name)}</a>${x.s._mi != null ? ` <span class="muted small">${x.s._mi.toFixed(1)} mi</span>` : ""}: ${esc(x.event)}</span></li>`;
    }
    if (cur) html += "</ul>";
    $("dl-list").innerHTML = html || `<p class="empty">No dates match.${home && state.within ? " Try a larger distance." : ""}</p>`;
    $("dl-status").innerHTML = home ? `Schools within ${state.within ? state.within + " miles of" : "any distance of"} <b>${esc(home.postcode)}</b>. <button type="button" class="linkbtn" id="dl-clear">Clear</button>` : "";
    const c = $("dl-clear"); if (c) c.onclick = () => { home = null; GS.saveHome(null); $("dl-pc").value = ""; render(); };
    sync();
  }

  async function setPostcode(pc) {
    $("dl-error").textContent = "";
    try { home = await GS.lookupPostcode(pc); GS.saveHome(home); $("dl-pc").value = home.postcode; }
    catch (err) { $("dl-error").textContent = err.message; }
    render();
  }
  $("dl-form").addEventListener("submit", e => { e.preventDefault(); state.within = $("dl-within").value; setPostcode($("dl-pc").value); });
  $("dl-within").addEventListener("change", () => { state.within = $("dl-within").value; render(); });
  $("dl-q").addEventListener("input", () => { state.q = $("dl-q").value.trim(); render(); });
  $("dl-other").addEventListener("change", () => { state.other = $("dl-other").checked; render(); });
  $("dl-past").addEventListener("change", () => { state.past = $("dl-past").checked; render(); });

  // Calendar file for whatever is listed
  $("dl-ics").addEventListener("click", () => {
    const e = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//11plusroute//deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Grammar school dates"];
    shown.forEach((x, i) => {
      const d = x.date.replace(/-/g, "");
      const [y, m, dd] = x.date.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${x.s.slug}-${x.date}-${i}@11plusroute`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
        `SUMMARY:${e(x.s.name + ": " + x.event)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar" }));
    a.download = "grammar-school-dates.ics";
    document.body.appendChild(a); a.click(); a.remove();
  });

  if (pcParam && (!home || home.postcode.replace(/\s/g, "").toUpperCase() !== pcParam.replace(/\s/g, "").toUpperCase())) {
    $("dl-pc").value = pcParam; setPostcode(pcParam);
  } else {
    if (home && !pcParam && !location.search.includes("pc=")) { /* remembered postcode from another page */ }
    if (home) $("dl-pc").value = home.postcode;
    render();
  }
})();
