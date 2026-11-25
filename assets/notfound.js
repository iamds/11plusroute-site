(function () {
  const d = JSON.parse(document.getElementById("nf-data").textContent);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const words = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(w => w.length > 2 && !["html", "schools", "school", "grammar", "the", "site"].includes(w));
  const link = s => `<li><a href="${d.base}schools/${s.s}.html">${esc(s.n)}</a> <span class="muted">· ${esc(s.t)}</span></li>`;
  // Guess from the address someone typed
  const asked = words(decodeURIComponent(location.pathname.split("/").pop() || ""));
  if (asked.length) {
    const scored = d.schools.map(s => ({ s, n: asked.filter(w => (s.s + " " + s.t.toLowerCase()).includes(w)).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    if (scored.length) document.getElementById("nf-guess").innerHTML = `Were you looking for <a href="${d.base}schools/${scored[0].s.s}.html">${esc(scored[0].s.n)}</a>?`;
  }
  const q = document.getElementById("nf-q"), list = document.getElementById("nf-list");
  q.addEventListener("input", () => {
    const t = q.value.trim().toLowerCase();
    list.innerHTML = t.length < 2 ? "" : d.schools.filter(s => (s.n + " " + s.t).toLowerCase().includes(t)).slice(0, 12).map(link).join("") || '<li class="muted">No matches</li>';
  });
})();
