(function () {
  const GS = window.GS, esc = GS.esc;
  const data = JSON.parse(document.getElementById("sl-data").textContent);
  const bySlug = Object.fromEntries(data.schools.map(s => [s.slug, s]));
  const $ = id => document.getElementById(id);
  const home = GS.loadHome();
  const GENDER = GS.GENDER;
  const TYPE = { grammar: "Grammar", partially_selective: "Partially selective", aptitude_only: "Aptitude places" };

  // A shared shortlist arrives as ?sl=slug1,slug2
  let shared = [];
  try { shared = (new URLSearchParams(location.search).get("sl") || "").split(",").map(x => x.trim()).filter(x => bySlug[x]); } catch (e) {}

  const fmt = d => {
    if (!d) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(d);
    if (!m) return esc(d);
    const s = new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return m[4] && m[4] !== "23:59" ? `${s}, ${m[4]}` : s;
  };
  const today = new Date().toISOString().slice(0, 10);
  const pcq = home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";

  const initial = GS.shortlist.get();
  function list() { return (shared.length ? shared : initial).map(s => bySlug[s]).filter(Boolean); }

  function render() {
    const items = list();
    items.forEach(s => { s._mi = home && s.lat != null ? GS.miles(home, s) : null; });
    items.sort((a, b) => (a._mi ?? 1e9) - (b._mi ?? 1e9) || a.name.localeCompare(b.name));

    $("sl-banner").innerHTML = shared.length
      ? `<div class="card sl-shared"><b>Someone shared a shortlist of ${shared.length} school${shared.length === 1 ? "" : "s"} with you.</b>
         <button type="button" class="linkbtn" id="sl-save">Add them to my shortlist</button> · <a href="shortlist.html">View my own shortlist</a></div>` : "";
    if (shared.length) $("sl-save").onclick = () => { GS.shortlist.set(GS.shortlist.get().concat(shared)); location.replace("shortlist.html"); };

    $("sl-count").textContent = items.length ? `${items.length} school${items.length === 1 ? "" : "s"}${home ? ` · distances from ${home.postcode}` : ""}` : "";
    $("sl-ics").hidden = $("sl-share").hidden = !items.length;
    $("sl-share").textContent = "Share shortlist";

    if (!items.length) {
      $("sl-list").innerHTML = `<div class="card sl-empty"><p><b>Your shortlist is empty.</b></p>
        <p>Tap the ☆ next to a school in the <a href="index.html">school list</a>, on the map, or on a school's page to add it here.</p></div>`;
      $("sl-dates-card").hidden = true; $("sl-sub-card").hidden = true;
      return;
    }
    $("sl-list").innerHTML = `<div class="card table-wrap" style="padding:0"><table class="sltable"><thead><tr>
      <th>School</th>${home ? '<th class="num">Distance</th>' : ""}<th>Register by</th><th>Test</th><th>Apply by</th><th>Offers</th><th class="num">Places</th></tr></thead><tbody>
      ${items.map(s => {
        const on = GS.shortlist.has(s.slug);

        const past = d => d && d.slice(0, 10) < today ? ' class="past"' : "";
        return `<tr>
          <td class="name">${shared.length ? "" : `<button type="button" class="star${on ? " on" : ""}" data-slug="${s.slug}" aria-pressed="${on}" aria-label="Remove ${esc(s.name)} from your shortlist">${GS.STAR(on)}</button>`}<a href="schools/${s.slug}.html${pcq}">${esc(s.name)}</a>
            <div class="small muted">${esc(s.town || "")} · ${GENDER[s.gender] || ""} · ${TYPE[s.selection] || ""}${s.test ? ` · ${esc(s.test)}` : ""}</div></td>
          ${home ? `<td class="num">${s._mi != null ? s._mi.toFixed(1) + " mi" : ""}</td>` : ""}
          <td${past(s.reg)}>${fmt(s.reg) || "–"}</td><td${past(s.testDate)}>${fmt(s.testDate) || "–"}</td>
          <td${past(s.caf)}>${fmt(s.caf) || "–"}</td><td${past(s.offer)}>${fmt(s.offer) || "–"}</td><td class="num">${s.pan ?? ""}</td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="small muted">Dates already passed are greyed out. Always check each school's page and admissions policy.</p>`;

    // next dates across the shortlist
    const evs = items.flatMap(s => (s.events || []).map(e => ({ d: e[0], k: e[1], t: e[2], s }))).filter(e => e.d >= today).sort((a, b) => a.d.localeCompare(b.d));
    $("sl-dates-card").hidden = !evs.length;
    $("sl-dates").innerHTML = `<ul class="evlist">${evs.slice(0, 12).map(e => `<li class="ev ev-${e.k}"><time>${new Date(e.d + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</time>
      <span><a href="schools/${e.s.slug}.html${pcq}">${esc(e.s.name)}</a>: ${esc(e.t)}</span></li>`).join("")}</ul>`;
    window._slEvents = evs;
    $("sl-sub-card").hidden = false;
    $("sl-subs").innerHTML = items.map(s => `<li><a href="${esc((s.ics || "").replace(/^https?:/, "webcal:"))}">${esc(s.name)}</a> <input class="icsurl" readonly value="${esc(s.ics || "")}" aria-label="Calendar link for ${esc(s.name)}" onfocus="this.select()"></li>`).join("");
  }

  // Unstarring keeps the row (faded) until the page is reloaded, with an Undo, so a slip is easy to fix
  let shown = null;
  function setStar(st, on) {
    st.classList.toggle("on", on); st.setAttribute("aria-pressed", String(on)); st.innerHTML = GS.STAR(on);
    const row = st.closest("tr"); if (row) row.classList.toggle("removed", !on);
    const name = bySlug[st.dataset.slug].name;
    st.setAttribute("aria-label", (on ? "Remove " : "Add ") + name + (on ? " from" : " to") + " your shortlist");
    const n = GS.shortlist.get().length;
    $("sl-count").textContent = `${n} school${n === 1 ? "" : "s"} on your shortlist${home ? ` · distances from ${home.postcode}` : ""}`;
  }
  function undoToast(st) {
    let t = document.getElementById("sl-undo");
    if (!t) { t = document.createElement("div"); t.id = "sl-undo"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = `Removed ${esc(bySlug[st.dataset.slug].name)} <button type="button" class="linkbtn">Undo</button>`;
    t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 6000);
    t.querySelector("button").onclick = () => { GS.shortlist.toggle(st.dataset.slug); setStar(st, true); t.classList.remove("show"); };
  }
  document.addEventListener("click", e => {
    const st = e.target.closest(".star[data-slug]");
    if (!st) return;
    const on = GS.shortlist.toggle(st.dataset.slug);
    setStar(st, on);
    if (!on) undoToast(st); else { const t = document.getElementById("sl-undo"); if (t) t.classList.remove("show"); }
  });
  window.addEventListener("storage", e => { if (e.key === "gs-shortlist" && !document.querySelector("tr.removed")) render(); });

  // Share: copy the link and show it in a small box, in case someone wants to copy it themselves
  async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (x) { return false; } }
  function sharePanel(url, copied) {
    let p = document.getElementById("sl-sharebox");
    if (!p) {
      p = document.createElement("div"); p.id = "sl-sharebox"; p.className = "sharebox"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Share your shortlist");
      $("sl-share").insertAdjacentElement("afterend", p);
      document.addEventListener("click", e => { if (!e.target.closest("#sl-sharebox, #sl-share")) p.hidden = true; });
      document.addEventListener("keydown", e => { if (e.key === "Escape") p.hidden = true; });
    }
    p.innerHTML = `<p class="small"><b>${copied ? "✓ Link copied to your clipboard." : "Copy this link:"}</b> Anyone who opens it sees this shortlist and can add it to theirs.</p>
      <div class="sharebox-row"><input type="text" readonly value="${esc(url)}" aria-label="Shortlist link"><button type="button" class="slbtn">Copy${copied ? " again" : ""}</button></div>`;
    p.hidden = false;
    const inp = p.querySelector("input");
    inp.focus(); inp.select();
    inp.addEventListener("focus", () => inp.select());
    p.querySelector("button").onclick = async () => { const ok = await copy(url); if (!ok) { inp.select(); try { document.execCommand("copy"); } catch (x) {} } p.querySelector("button").textContent = "Copied"; };
  }
  $("sl-share").addEventListener("click", async () => {
    const u = new URL(location.href); u.search = ""; u.hash = "";
    u.searchParams.set("sl", list().filter(s => shared.length || GS.shortlist.has(s.slug)).map(s => s.slug).join(","));
    const url = u.toString().replace(/%2C/gi, ",");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { try { await navigator.share({ title: "My grammar school shortlist", url }); return; } catch (x) { if (x && x.name === "AbortError") return; } }
    // don't wait forever if the browser is slow to answer a clipboard request
    sharePanel(url, await Promise.race([copy(url), new Promise(r => setTimeout(() => r(false), 800))]));
  });

  $("sl-ics").addEventListener("click", () => {
    const evs = window._slEvents || [];
    const e = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//11plusroute//shortlist//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:My grammar school shortlist"];
    evs.forEach((x, i) => {
      const [y, m, d] = x.d.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${x.s.slug}-${x.d}-${i}@11plusroute`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${x.d.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${next}`,
        `SUMMARY:${e(x.s.name + ": " + x.t)}`, `DESCRIPTION:${e("Admissions details: " + new URL("schools/" + x.s.slug + ".html", location.href).href)}`, `URL:${new URL("schools/" + x.s.slug + ".html", location.href).href}`, "TRANSP:TRANSPARENT", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar" }));
    a.download = "my-shortlist-dates.ics"; document.body.appendChild(a); a.click(); a.remove();
  });

  render();
})();
