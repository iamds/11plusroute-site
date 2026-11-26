(function () {
  const { CATEGORIES, SUBJECTS, esc, fmtDate, catBadge } = window.GS;
  const s = JSON.parse(document.getElementById("school-data").textContent);
  const y = s.year7 || {};
  const a = y.assessment || {};
  const areas = Object.fromEntries((y.areas || []).map(x => [x.id, x]));
  const stages = Object.fromEntries((a.stages || []).map(x => [x.id, x]));
  const out = document.getElementById("app");

  // ---------- describing rules / conditions in plain English ----------
  function stageName(ref) { return ref === "final" ? "the final score" : (stages[ref]?.name || ref); }
  function stageShort(ref) { return stageName(ref).replace(/\s*\(.*\)\s*$/, ""); }
  function rule(r) {
    if (!r) return "";
    if (r.description) return esc(r.description);
    switch (r.type) {
      case "none": return "No academic requirement";
      case "top_n": return `Ranked in the top ${r.n}${r.stage ? " in " + esc(stageName(r.stage)) : ""}`;
      case "score_at_least": return `Score of at least ${esc(r.value)}${r.stage ? " in " + esc(stageName(r.stage)) : ""}`;
      case "pass_mark": return `Reaches the pass mark${r.value ? " (" + esc(r.value) + ")" : ""}`;
      case "sat_stage": return `Sat ${esc(stageName(r.ref))}`;
      case "progressed_from": return `Got through ${esc(stageName(r.ref))}`;
      case "all_of": return (r.rules || []).map(rule).join(" <b>and</b> ");
      case "any_of": return (r.rules || []).map(rule).join(" <b>or</b> ");
      case "score_relative": {
        const b = r.base || {};
        const base = b.type === "rank_score" ? `the ${b.n}th-ranked score` : "the qualifying score";
        if (r.within_percent != null) return `Within ${r.within_percent}% of ${base}`;
        if (r.offset_points != null) return `${Math.abs(r.offset_points)} points ${r.offset_points < 0 ? "below" : "above"} ${base}`;
        return `Relative to ${base}`;
      }
      case "school_determined": return `Number set by the school${r.typical_n ? ` (typically about ${r.typical_n})` : ""}`;
      case "date_of_birth_range": return `Born ${fmtDate(r.from)} – ${fmtDate(r.to)}`;
      default: return esc(r.type);
    }
  }
  function cond(c) {
    switch (c.type) {
      case "looked_after": return "Is looked after, or was previously looked after?";
      case "pupil_premium": return `Eligible for Pupil Premium${c.basis && !/^eligible for pupil premium/i.test(c.basis) ?` <span class="muted">(${esc(c.basis)})</span>` : ""}?`;
      case "free_school_meals": return `Eligible for free school meals${c.basis ? ` <span class="muted">(${esc(c.basis)})</span>` : ""}?`;
      case "service_premium": return "Eligible for Service Premium?";
      case "medical_social": return `Exceptional medical or social need?${c.description ? ` <span class="muted">${esc(c.description)}</span>` : ""}`;
      case "sibling": return `Has a sibling at the school?${c.description ? ` <span class="muted">${esc(c.description)}</span>` : ""}`;
      case "staff_child": return `Child of a member of staff?${c.description ? ` <span class="muted">${esc(c.description)}</span>` : ""}`;
      case "faith": return `Meets the faith requirement?${c.requirement ? ` <span class="muted">${esc(c.faith ? c.faith + ": " : "")}${esc(c.requirement)}</span>` : ""}`;
      case "feeder_school": return `Attends a feeder school?${c.schools ? ` <span class="muted">${esc(c.schools.join(", "))}</span>` : ""}`;
      case "in_area": return `Lives in <a href="#area-${esc(c.ref)}">${esc(areas[c.ref]?.name || c.ref)}</a>? <span class="you" data-area="${esc(c.ref)}"></span>`;
      case "not_in_area": return `Lives outside <a href="#area-${esc(c.ref)}">${esc(areas[c.ref]?.name || c.ref)}</a>? <span class="you" data-area="${esc(c.ref)}" data-neg="1"></span>`;
      case "aptitude": return `Shows ${esc(c.subject || "")} aptitude${c.ref ? ` in the ${esc(stageName(c.ref))}` : ""}?${c.requirement ? ` <span class="muted">${esc(c.requirement)}</span>` : ""}`;
      case "any_of": return (c.conditions || []).map(x => cond(x).replace(/\?(?=(\s*<span[^>]*>[^<]*<\/span>)?\s*$)/, "")).join(` <b class="or">or</b> `) + "?";
      default: return esc(c.description || c.type) + (c.description?.endsWith("?") ? "" : "?");
    }
  }
  function ordering(o) {
    switch (o.type) {
      case "score": return "highest " + (o.component ? esc(SUBJECTS[o.component] || o.component) + " " : "test ") + "score" + (o.stage && o.stage !== "final" ? ` (${esc(stageName(o.stage))})` : "");
      case "distance": return (o.area_first ? `living in ${esc(areas[o.area_first]?.name || o.area_first)} first, then ` : "") + "nearest to the school";
      case "condition": return o.description ? esc(o.description) : "those meeting: " + cond(o.condition || {}).replace(/\?$/, "");
      case "random": return "random allocation";
      case "sub_criteria": return "sub-priorities (" + (o.criteria || []).map(c => esc(c.label)).join(" → ") + ")";
      default: return esc(o.description || o.type);
    }
  }
  function quotaSize(q) {
    if (q.places != null) return `${q.places} places`;
    if (q.percent != null) return `${q.percent}% of places`;
    if (q.max_places != null) return `Up to ${q.max_places} places`;
    if (q.min_places != null) return `At least ${q.min_places} places`;
    return "";
  }
  const joinList = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
  function groupAmount(g) {
    const n = g.places ?? g.max_places ?? g.min_places;
    const prefix = g.max_places != null ? "up to " : g.min_places != null ? "at least " : "";
    const amt = n != null ? `${n} places${g.percent != null ? ` (${g.percent}%)` : ""}` : g.percent != null ? `${g.percent}% of places` : "the rest of the places";
    return prefix + amt;
  }
  const critByP = () => Object.fromEntries((((y.oversubscription || {}).criteria) || []).map(c => [String(c.priority), c]));
  const shortLabel = t => String(t || "").trim();
  function pill(p) {
    const c = critByP()[String(p)]; const cat = CATEGORIES[c?.category] || CATEGORIES.other;
    return `<a class="ppill ${cat.cls}" href="#p-${String(p).replace(/[^\w-]/g, "_")}"><span class="pn">${esc(markText(p))}</span>${esc(shortLabel(c?.label || ("Priority " + p)))}</a>`;
  }
  function groupSentence(g) {
    const a = groupAmount(g); const ps = (g.priorities || []).map(String);
    return `${a.charAt(0).toUpperCase() + a.slice(1)} go to:<div class="pills">${ps.map(pill).join("")}</div>`;
  }
  function quota(q) {
    if (!q) return "";
    const size = quotaSize(q);
    const bits = [];
    if (q.unfilled_to && q.unfilled_to !== "next") bits.push(q.unfilled_to === "lost" ? "unused places are not reallocated" : `unused places go to criterion ${esc(q.unfilled_to)}`);
    if (q.ranking === "own_pool") bits.push("ranked only against others in this group");
    if (q.fallthrough === true) bits.push("anyone not placed here is still considered below");
    return `<div class="quota">${esc(size || "Quota")}</div>${q.description ? `<div class="desc">${esc(q.description)}</div>` : bits.length ? `<div class="desc">${bits.join("; ")}</div>` : ""}`;
  }

  // ---------- allocations lookup: latest year's offers per priority ----------
  const latestAlloc = (y.allocations || [])[0];
  function allocFor(priority) {
    if (!latestAlloc) return null;
    return (latestAlloc.by_criterion || []).find(r => r.priority != null && String(r.priority) === String(priority));
  }

  // Furthest offer for a distance-based priority: this priority's figure from the latest year that has one,
  // otherwise the school's overall furthest offer (for the last distance-ordered priority only).
  const byDistance = c => c.category === "distance" || (c.order_within || []).some(o => o.type === "distance");
  function furthestFor(c, isLastDistance) {
    if (!byDistance(c)) return null;
    const rowFor = a => (a.by_criterion || []).find(r => r.priority != null && String(r.priority) === String(c.priority));
    // no places went under this priority in the latest year: there's no furthest offer to show
    const latest = latestAlloc && rowFor(latestAlloc);
    if (latest && latest.offers === 0) return null;
    for (const a of y.allocations || []) {
      const r = rowFor(a);
      if (r && r.last_distance_miles != null && r.offers !== 0) return { mi: r.last_distance_miles, year: a.entry_year, own: true };
    }
    if (isLastDistance) for (const a of y.allocations || []) {
      const d = a.last_offered && a.last_offered.distance_miles;
      if (d) return { mi: d, year: a.entry_year, own: false };
    }
    return null;
  }

  // ---------- flowchart: a transit-map line. Each step is a station; branches leave to the right. ----------
  const LINK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0Zm-2.8 5.3a3.5 3.5 0 0 1-2.5-6l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a1.5 1.5 0 0 0 2.1 2.1l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a3.5 3.5 0 0 1-2.4 1Zm7.8-5.3a1 1 0 0 1-.7-1.7l2.1-2.1a1.5 1.5 0 0 0-2.1-2.1l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1a3.5 3.5 0 0 1 5 5l-2.1 2.1a1 1 0 0 1-.8.2Z"/></svg>';
  const linkBtn = id => `<button type="button" class="seclink" data-target="${esc(id)}" aria-label="Copy a link to this part of the page" title="Copy link">${LINK_SVG}</button>`;
  function stop(o) {
    return `<li class="stop ${o.cls || ""}${o.branch ? " has-branch" : ""}"${o.id ? ` id="${o.id}"` : ""}>
      <div class="rail"><span class="marker">${o.marker || ""}</span></div>
      <div class="main">${o.kicker ? `<div class="kicker">${o.kicker}${o.id ? linkBtn(o.id) : ""}</div>` : ""}${o.title ? `<div class="title">${o.title}</div>` : ""}${o.body || ""}</div>
      ${o.branch ? `<div class="branch ${o.branch.cls || ""}"><div class="bcard"><span class="blabel">${o.branch.label}</span>${o.branch.html}</div></div>` : ""}
    </li>`;
  }
  const critList = (((y.oversubscription || {}).criteria) || []);
  function markText(p) {
    const t = String(p);
    if (t.length <= 5) return t;
    const i = critList.findIndex(c => String(c.priority) === t);
    return i >= 0 ? String(i + 1) : t.slice(0, 3);
  }
  function aptSubject(c) {
    if (c.category !== "aptitude") return "";
    const found = []; const walk = cs => (cs || []).forEach(x => { if (x.type === "aptitude" && x.subject && x.subject !== "other") found.push(x.subject); if (x.type === "any_of") walk(x.conditions); });
    walk(c.conditions);
    const names = [...new Set(found)].map(t => String(t).replace(/_/g, " ")).map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return names.length ? " · " + esc(names.join(" / ")) : "";
  }
  function more(inner, label = "Details") {
    return inner && inner.replace(/<[^>]+>|\s/g, "") ? `<details class="more"><summary>${label}</summary><div class="more-body">${inner}</div></details>` : "";
  }
  function seg(label, cls = "") { return `<li class="seg ${cls}"><div class="rail"></div><div class="seglabel">${label || ""}</div></li>`; }
  function zone(n, label) { return `<li class="zone"><div class="rail"></div><div class="zlabel"><span>${n}</span>${label}</div></li>`; }
  const dur = d => d == null ? "" : typeof d === "object" ? (d.min != null && d.max != null ? `${d.min}–${d.max} min` : d.max != null ? `up to ${d.max} min` : `${d.min}+ min`) : `${d} min`;
  const range = d => !d ? "" : (d.from === d.to || !d.to ? fmtDate(d.from) : `${fmtDate(d.from)} – ${fmtDate(d.to)}`) + (d.approximate ? " (approx.)" : "");

  function registrationBlock() {
    const steps = y.registration || [];
    if (!steps.length) return "";
    return stop({ id: "register", cls: "reg", kicker: "Before the test", title: "Register and apply", body: `<div class="steps">${steps.map(st => `
      <div class="step${st.required === false ? " optional" : ""}">
        <div class="who">${st.required === false ? "If it applies · " : ""}${esc({ school: "to the school", home_la: "to your council", consortium: "to the consortium" }[st.submit_to] || st.submit_to || "")}</div>
        <div class="what">${esc(st.name)}</div>
        ${st.deadline ? `<div class="when">${fmtDate(st.deadline)}</div>` : ""}
        ${st.description ? more(`<div class="desc">${esc(st.description)}</div>`) : ""}
      </div>`).join("")}</div>` });
  }

  // ---------- subject chips: tap one to see what that part of the test is like ----------
  const SUBJECT_INFO = {
    english: "Usually reading comprehension plus vocabulary, spelling, punctuation and grammar questions. Some schools include a piece of writing.",
    comprehension: "Read one or more passages (fiction, non-fiction or poetry) and answer questions about meaning, vocabulary and the writer's choices.",
    creative_writing: "Write a story, description or other piece in a set time, often from a picture or opening line. Marked for content, organisation, vocabulary and accuracy.",
    maths: "Arithmetic and problem solving, usually based on the Key Stage 2 curriculum up to the end of Year 5: number, fractions, measures, shape, data and word problems.",
    verbal_reasoning: "Word and letter puzzles: codes, analogies, odd one out, hidden words, letter sequences and vocabulary. Tests reasoning with language rather than school knowledge.",
    non_verbal_reasoning: "Puzzles with shapes and patterns: spotting the next in a sequence, the odd one out, matrices and codes. No reading or maths needed.",
    spatial_reasoning: "Picturing shapes in your head: rotations, reflections, folding nets into cubes and fitting pieces together.",
    music: "Listening and response tasks to judge musical aptitude, such as comparing pitch, rhythm and melody. Some schools also hear a performance.",
    sport: "Physical tests of fitness, coordination and agility. Usually not about one particular sport.",
  };
  const FORMAT = { multiple_choice: "Multiple choice", written: "Written answers", standard_answer: "Write-in answers" };
  function subjectChips(st, i) {
    return (st.components || []).map((c, j) => {
      const name = esc(c.label && c.subject === "other" ? c.label : SUBJECTS[c.subject] || c.subject);
      const tag = [FORMAT[c.format] && FORMAT[c.format].replace("Multiple choice", "multiple choice").replace("Written answers", "written").replace("Write-in answers", "write-in"), c.duration_minutes != null ? dur(c.duration_minutes) : ""].filter(Boolean).join(" · ");
      const lines = [
        FORMAT[c.format] ? `<b>${FORMAT[c.format]}</b>${c.duration_minutes != null ? ` · ${dur(c.duration_minutes)}` : ""}` : c.duration_minutes != null ? `<b>${dur(c.duration_minutes)}</b>` : "",
        c.label && c.subject !== "other" ? esc(c.label) : "",
        c.description ? esc(c.description) : "",
        c.weight != null && +c.weight > 0 ? `Counts for ${+c.weight <= 1 ? Math.round(c.weight * 100) : esc(c.weight)}% of the score.` : "",
        SUBJECT_INFO[c.subject] ? `<span class="muted">What it usually means: ${SUBJECT_INFO[c.subject]}</span>` : "",
      ].filter(Boolean);
      if (!lines.length) return `<span class="subj">${name}</span>`;
      const id = `si-${i}-${j}`;
      return `<button type="button" class="subj subjbtn" aria-expanded="false" aria-controls="${id}">${name}${tag ? `<small>${tag}</small>` : ""}</button><div class="subjinfo" id="${id}" hidden>${lines.map(l => `<p>${l}</p>`).join("")}</div>`;
    }).join("");
  }

  function stagesBlock() {
    const all = a.stages || [];
    const list = all.filter(st => st.kind !== "aptitude");
    const apt = all.filter(st => st.kind === "aptitude");
    if (!all.length) return stop({ title: "No entrance test details recorded" });
    let h = "";
    list.forEach((st, i) => {
      let comps = subjectChips(st, i);
      const papersHaveSubjects = (st.papers || []).some(pp => (pp.subjects || []).filter(x => x !== "other").length);
      const nums = ["", "One", "Two", "Three", "Four", "Five", "Six"];
      const paperDesc = pp => esc(pp.name || "Paper") + (pp.duration_minutes != null ? `, ${dur(pp.duration_minutes)}` : "");
      const paperDescs = (st.papers || []).some(pp => pp.description);
      const paperLine = paperDescs
        ? `<ul class="paperlist">${st.papers.map(pp => `<li><b>${esc(pp.name || "Paper")}</b>${pp.duration_minutes != null ? ` · ${dur(pp.duration_minutes)}` : ""}${pp.description ? `: ${esc(pp.description)}` : ""}</li>`).join("")}</ul>`
        : (st.papers || []).length && !papersHaveSubjects
        ? `<div class="desc">${nums[st.papers.length] || st.papers.length} paper${st.papers.length > 1 ? "s" : ""}: ${st.papers.map(paperDesc).join("; ")}</div>` : "";
      if (papersHaveSubjects && !paperDescs) comps = st.papers.map(pp => `<span class="subj paper"><b>${esc(pp.name || "Paper")}</b>${pp.duration_minutes != null ? ` · ${dur(pp.duration_minutes)}` : ""}${(pp.subjects || []).filter(x => x !== "other").length ? ": " + pp.subjects.filter(x => x !== "other").map(x => esc(SUBJECTS[x] || x)).join(", ") : ""}</span>`).join("");
      const body = `${st.dates ? `<div class="when">${range(st.dates)}</div>` : ""}
        ${comps ? `<div class="subjects">${comps}</div>` : ""}${paperLine}
        ${more(`${st.location ? `<div class="desc">${esc(st.location)}</div>` : ""}
        ${(st.shared_with || []).length ? `<div class="desc">Shared with ${esc(st.shared_with.join(", "))}${st.pass_mark_set_by === "school" ? "; each school sets its own pass mark" : ""}</div>` : ""}
        ${(st.alternative_dates || []).map(ad => `<div class="desc">Alternative sitting${ad.who ? ` for ${esc(ad.who)}` : ""}${ad.dates?.from ? `: ${fmtDate(ad.dates.from)}` : ""}${ad.description ? ` (${esc(ad.description)})` : ""}</div>`).join("")}`)}`;
      const next = list[i + 1];
      h += stop({ id: list.length > 1 ? `test-${i + 1}` : "test-day", cls: "test", kicker: list.length > 1 ? `Test · stage ${i + 1} of ${list.length}` : "Entrance test", title: esc(st.name), body,
        branch: st.progression && next ? { label: "Not through", cls: "exit", html: `<div class="title">Not invited to ${esc(next.name)}</div>${st.progression.ties ? `<div class="desc">Ties: ${esc(st.progression.ties)}</div>` : ""}` } : null });
      if (st.progression && next) {
        const exc = (st.progression.exceptions || []).map(e => `<div class="exc">${esc(e.applies_to || "Some groups")}: ${rule(e.rule)}</div>`).join("");
        h += seg(`<span class="go">Goes on</span> ${rule(st.progression)}${exc ? more(exc, "Exceptions") : ""}`, "yes");
      }
    });
    if (apt.length) h += stop({ id: "aptitude", cls: "apt", kicker: "Optional, alongside", title: "Aptitude tests", body: `<div class="steps">${apt.map(st => `
      <div class="step"><div class="what">${esc(st.name)}</div>${st.dates?.from ? `<div class="when">${range(st.dates)}</div>` : ""}
      ${more(`${st.entry ? `<div class="desc">Who can sit it: ${rule(st.entry)}</div>` : ""}
      ${(st.used_for || []).length ? `<div class="desc">Counts only for criteria ${st.used_for.map(esc).join(", ")}</div>` : ""}`)}</div>`).join("")}</div>` });
    return h;
  }

  function qualificationBlock() {
    const q = a.qualification, fs = a.final_score;
    let h = "";
    if (fs) {
      const unit = fs.weights_unit === "percent" ? "%" : "";
      const w = (Array.isArray(fs.weights) ? fs.weights : []).map(x => `<span class="subj">${esc(stageShort(x.stage))}${x.subject ? " · " + esc(SUBJECTS[x.subject] || x.subject) : ""} <b>${esc(x.weight)}${unit}</b></span>`).join("");
      const adj = (fs.adjustments || []).map(x => esc(x.description || x.type)).join("; ");
      h += stop({ id: "final-score", cls: "minor", kicker: "Scoring", title: "Final score", body: more(`<div class="desc">${esc(fs.description || "")}</div>
        ${w ? `<div class="subjects">${fs.weights_unit === "ratio" ? '<span class="muted small">Ratio</span>' : ""}${w}</div>` : ""}
        ${adj ? `<div class="desc">Adjusted for: ${adj}</div>` : ""}`, "How it's worked out") });
    }
    if (q && q.type === "other") h += stop({ id: "pass-mark", cls: "decision passmark", kicker: "Pass mark", title: "Reach the qualifying standard?", body: `<div class="desc">${rule(q)}</div>` });
    else if (q && q.type !== "none") {
      h += stop({ id: "pass-mark", cls: "decision passmark", kicker: "Pass mark", title: rule(q), branch: { label: "No", cls: "exit", html: `<div class="title">Not eligible for a place</div>` } });
      h += seg(`<span class="go">Qualifies</span>`, "yes");
    }
    return h;
  }

  function ehcpBlock() {
    if (!y.ehcp) return "";
    return stop({ id: "ehcp", cls: "decision", kicker: "Checked first", title: "Does an EHCP name the school?",
      branch: { label: "Yes", cls: "in", html: `<div class="title">Admitted</div>${more(`<div class="desc">${esc(y.ehcp.description || "")}</div>`)}` } }) + seg("No", "no");
  }

  function criteriaBlock() {
    const crit = (y.oversubscription || {}).criteria || [];
    if (!crit.length) return stop({ cls: "end crit-missing", kicker: "Not available", title: "Priority order not available", body: `<div class="desc">Check the school's admissions policy for how places are given.</div>` });
    const ov = y.oversubscription || {};
    const groups = ov.quota_groups || [];
    const groupOf = p => groups.filter(g => (g.priorities || []).map(String).includes(String(p)));
    let h = "";
    const pos = p => crit.findIndex(c => String(c.priority) === String(p));
    const hasSize = g => g.places != null || g.max_places != null || g.min_places != null || g.percent != null;
    const sized = groups.filter(hasSize).slice().sort((a, b) => Math.min(...(a.priorities || []).map(pos)) - Math.min(...(b.priorities || []).map(pos)));
    const restExists = groups.some(g => !hasSize(g));
    const listOrder = crit.map(c => String(c.priority));
    const ao = (ov.allocation_order || []).map(String);
    const aoDiffers = ao.length && ao.join("|") !== listOrder.filter(p => ao.includes(p)).join("|");
    if (sized.length || aoDiffers) {
      h += stop({ id: "place-split", cls: "minor note", kicker: "Before you read the priorities", title: "How the places are split", body: `${sized.map(g => `<div class="pool">${groupSentence(g)}${g.description ? more(`<div class="desc">${esc(g.description)}</div>`) : ""}</div>`).join("")}
        ${sized.length && restExists ? `<div class="pool desc">All other places go through the remaining priorities, in the order shown below.</div>` : ""}
        ${aoDiffers ? `<div class="pool">Places are actually handed out in a different order from the list below:<div class="pills">${ao.map(pill).join('<span class="parrow">→</span>')}</div>${ov.allocation_order_description ? more(`<div class="desc">${esc(ov.allocation_order_description)}</div>`) : ""}</div>` : ""}` });
    }
    const SPECIAL = { looked_after: "looked-after children", disadvantaged: "Pupil Premium or free school meals", medical_social: "medical or social need", staff: "staff children" };
    const lastDistIdx = (() => { let k = -1; crit.forEach((c, i) => { if (byDistance(c)) k = i; }); return k; })();
    const built = crit.map((c, i) => {
      const cat = CATEGORIES[c.category] || CATEGORIES.other;
      const conds = (c.conditions || []).map(cond);
      const al = allocFor(c.priority);
      const subs = (c.order_within || []).filter(o => o.type === "sub_criteria").map(o =>
        `<ol class="subcrit">${(o.criteria || []).map(sc => `<li>${esc(sc.label)}${sc.description ? ` <span class="muted">· ${esc(sc.description)}</span>` : ""}</li>`).join("")}</ol>`).join("");
      const outcome = `<div class="title">${esc(c.label)}</div>
        ${c.quota && quotaSize(c.quota) ? `<div class="quota">${esc(quotaSize(c.quota))}</div>` : ""}
        ${al && al.offers != null ? `<div class="alloc"><b>${al.offers}</b> offered in ${esc(latestAlloc.entry_year)}${al.last_distance_miles != null ? ` · furthest ${al.last_distance_miles} mi` : ""}${al.last_score != null ? ` · lowest score ${al.last_score}` : ""}</div>` : ""}
        ${(() => { if (al && al.last_distance_miles != null) return ""; const f = furthestFor(c, i === lastDistIdx); return f ? `<div class="alloc">Furthest offer in ${esc(String(f.year).slice(0, 4))}: <b>${f.mi} mi</b></div>` : ""; })()}
        ${more(`${c.quota ? quota(c.quota).replace(/^<div class="quota">.*?<\/div>/, "") : ""}
        ${groupOf(c.priority).map(g => `<div class="desc">Counts towards the ${esc(groupAmount(g).replace(/^(up to|at least) /, ""))} shared with: ${(g.priorities || []).map(String).filter(x => x !== String(c.priority)).map(x => esc(shortLabel(critByP()[x]?.label || x))).join("; ") || "no other priority"}.</div>`).join("")}
        ${c.applies_at === "initial_allocation" ? `<div class="desc">Only applies when places are first offered on National Offer Day, not to later offers from the waiting list.</div>` : ""}
        ${c.description ? `<div class="desc">${esc(c.description)}</div>` : ""}
        ${subs}
        ${(c.order_within || []).length ? `<div class="desc"><b>If oversubscribed:</b> ${c.order_within.map(ordering).join(", then ")}</div>` : ""}
        ${c.evidence ? `<div class="desc"><b>Evidence:</b> ${esc(c.evidence)}${c.evidence_deadline ? ` by ${fmtDate(c.evidence_deadline)}` : ""}</div>` : ""}`)}`;
      const title = conds.length ? conds.join(`<span class="and">and</span>`) : (i < crit.length - 1 || (c.category === "score_rank" && s.selection && s.selection !== "grammar") ? "Took the test for these places?" : "Everyone else who qualifies");
      const acad = c.academic_requirement ? `<div class="acad"><span>Academic bar</span> ${rule(c.academic_requirement)}</div>` : "";
      const qs = c.quota ? quotaSize(c.quota).replace(/^Up to /, "").replace(/^At least /, "") : "";
      const noLabel = !conds.length ? "" : c.quota ? (qs ? `No, or its ${esc(qs)} have gone` : "No, or its share of places has gone") : "No";
      // small fixed map for stations that depend on where you live
      const refs = []; (function walk(cs) { (cs || []).forEach(k => { if (k.type === "in_area" && k.ref) refs.push(k.ref); if (k.type === "any_of") walk(k.conditions); }); })(c.conditions);
      const ids = [...new Set(refs.map(id => areaGroupOf[id] || id))].filter(id => drawable.some(x => x.id === id));
      const farAny = !ids.length ? furthestFor(c, i === lastDistIdx) : null;
      const far = farAny && farAny.own ? farAny : null;  // only map a priority's own furthest-offer figure
      const mini = G0.lat != null && (ids.length || far) ? `<div class="minimap linked" role="button" tabindex="0" data-areas="${esc(ids.join(","))}" data-last="${far ? far.mi : ""}" aria-label="Open a larger map"><span class="mm-hint" aria-hidden="true">⤢ Enlarge</span></div>` : "";
      return { c, cat, conds, outcome, title, acad: acad + mini, noLabel, id: "p-" + String(c.priority).replace(/[^\w-]/g, "_"), special: !!SPECIAL[c.category] };
    });
    let i = 0;
    while (i < built.length) {
      const b = built[i];
      if (b.special) {
        h += stop({ id: b.id, cls: `crit special ${b.cat.cls}`, marker: esc(markText(b.c.priority)),
          kicker: esc(b.cat.label) + (String(b.c.priority).length > 5 ? ` · <span class="plabel">${esc(b.c.priority)}</span>` : ""),
          title: `<span class="sg-short">${esc(b.c.label)} <button type="button" class="sg-toggle" aria-expanded="false">Show</button></span><span class="sg-full">${b.title}</span>`,
          body: `<div class="sg-full">${b.acad}<button type="button" class="sg-toggle sg-hide" aria-expanded="true">Hide</button></div>`,
          branch: { label: b.conds.length ? "Yes" : "In order", cls: "in", html: b.outcome } });
        if (i < built.length - 1) h += seg(built[i + 1].special ? "" : (b.noLabel || ""), "no");
        i++; continue;
      }
      h += stop({ id: b.id, cls: `crit ${b.cat.cls}`, marker: esc(markText(b.c.priority)), kicker: esc(b.cat.label) + aptSubject(b.c) + (String(b.c.priority).length > 5 ? ` · <span class="plabel">${esc(b.c.priority)}</span>` : ""),
        title: b.title, body: b.acad, branch: { label: b.conds.length ? "Yes" : "In order", cls: "in", html: b.outcome } });
      if (i < built.length - 1) h += seg(b.noLabel, "no");
      i++;
    }
    h += stop({ id: "no-place", cls: "end", kicker: "End of the line", title: "No place offered", body: `<div class="desc">You can join the waiting list or appeal. See <a href="#waiting">Waiting list and late applications</a> below.</div>` });
    return h;
  }

  // ---------- detail sections ----------
  function section(id, title, body) { return body ? `<section id="${id}" class="card"><h2>${title}</h2>${body}</section>` : ""; }
  function dl(pairs) { const p = pairs.filter(([, v]) => v); return p.length ? `<dl>${p.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""; }

  function timeline() {
    const kd = (y.key_dates || []).slice().sort((p, q) => p.date.localeCompare(q.date));
    if (!kd.length) return "";
    return `<ol class="timeline">${kd.map(k => `<li><time>${fmtDate(k.date)}${k.approximate ? "*" : ""}</time><span>${esc(k.event)}</span></li>`).join("")}</ol>
      ${kd.some(k => k.approximate) ? '<p class="muted small">* approximate</p>' : ""}`;
  }
  function list(xs, max = 60) {
    if (!xs || !xs.length) return "";
    const shown = xs.slice(0, max).map(esc).join(", ");
    return xs.length > max ? `${shown} … <span class="muted">(+${xs.length - max} more)</span>` : shown;
  }
  // Map of radius-based priority areas, the school and (if known) the visitor's home
  const G0 = s._geo || {};
  const SHAPES = s._shapes || {};
  // areas merged for display (one priority accepts any of them) are drawn as their group shape instead
  const GROUPS = (G0.groups || []).filter(g => SHAPES[g.id]);
  const areaGroupOf = {}; GROUPS.forEach(g => g.members.forEach(m => areaGroupOf[m] = g.id));
  const drawable = (G0.areas || []).filter(x => !areaGroupOf[x.id] && (SHAPES[x.id] || (x.radius != null && (x.centred_on_school || x.centre))))
    .concat(GROUPS.map(g => ({ id: g.id, name: g.name })));
  // a built shape wins (e.g. "3 miles plus named parishes"); otherwise a circle round the school or a landmark
  const areaFeature = x => SHAPES[x.id] ? { type: "Feature", geometry: SHAPES[x.id] }
    : x.centre ? window.GS.circleGeo(x.centre.lat, x.centre.lng, x.radius) : window.GS.circleGeo(G0.lat, G0.lng, x.radius);
  const eachCoord = (geom, fn) => { const walk = c => typeof c[0] === "number" ? fn(c) : c.forEach(walk); walk(geom.coordinates); };
  const AREA_COLOURS = ["#0f7b4f", "#0a58b8", "#c25a00", "#7a2ea0", "#c2186b"];
  function areaMapHolder() {
    if (G0.lat == null || !drawable.length) return "";
    const others = (G0.areas || []).length - drawable.length;
    return `<div class="areamap-wrap"><div id="areamap" class="areamap" role="img" aria-label="Map of ${esc(s.name)}'s priority areas"></div>
      <p class="small muted maplegend">${drawable.map((x, i) => `<span class="dot" style="background:${AREA_COLOURS[i % 5]}"></span>${esc(x.name)}${x.radius != null && !SHAPES[x.id] && !/mile/i.test(x.name) ? ` (${x.radius} mi)` : ""}`).join(" ")}
      <span class="dot sch"></span>School <span class="dot hm"></span>Your postcode${Object.keys(SHAPES).length ? `<br>Shapes are approximate: check the school's own map or the details below if you live near an edge.` : ""}${others ? `<br>Some areas can't be drawn: see the details below.` : ""}</p></div>`;
  }
  let areaMap = null, homeMk = null;
  async function drawAreaMap() {
    const el = document.getElementById("areamap");
    if (!el || areaMap || drawAreaMap.started) return;
    drawAreaMap.started = true;
    try { await window.GS.loadMapLib(); } catch (e) { el.innerHTML = '<p class="empty">The map couldn\'t load. Check your connection.</p>'; return; }
    areaMap = new maplibregl.Map({ container: el, style: window.GS.mapStyle(), center: [G0.lng, G0.lat], zoom: 11, cooperativeGestures: true, attributionControl: { compact: true } });
    areaMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    const sch = document.createElement("div"); sch.className = "mpin"; sch.style.background = "#1f4e79"; sch.title = s.name;
    new maplibregl.Marker({ element: sch }).setLngLat([G0.lng, G0.lat]).addTo(areaMap);
    const bounds = new maplibregl.LngLatBounds([G0.lng, G0.lat], [G0.lng, G0.lat]);
    const circles = drawable.map((x, i) => ({ x, i, f: areaFeature(x) }));
    circles.forEach(c => eachCoord(c.f.geometry, p => bounds.extend(p)));
    // draw bigger areas first so smaller ones (often inside them) stay visible on top
    const span = f => { let x0 = 180, x1 = -180, y0 = 90, y1 = -90; eachCoord(f.geometry, p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); return (x1 - x0) * (y1 - y0); };
    const add = () => circles.slice().sort((p, q) => span(q.f) - span(p.f)).forEach(c => {
      const id = "area-" + c.i;
      if (areaMap.getSource(id)) return;
      areaMap.addSource(id, { type: "geojson", data: c.f });
      areaMap.addLayer({ id: id + "-fill", type: "fill", source: id, paint: { "fill-color": AREA_COLOURS[c.i % 5], "fill-opacity": 0.08 } });
      areaMap.addLayer({ id: id + "-line", type: "line", source: id, paint: { "line-color": AREA_COLOURS[c.i % 5], "line-width": 2 } });
    });
    window.GS.onStyle(areaMap, add);
    areaMap.fitBounds(bounds, { padding: 30, duration: 0, maxZoom: 13 });
    setAreaMapHome(currentHome);
  }
  // ---------- small fixed maps inside the flowchart (built when scrolled into view) ----------
  const minis = [];
  function initMiniMaps() {
    const els = [...out.querySelectorAll(".minimap")];
    if (!els.length || G0.lat == null) return;
    const build = async el => {
      try { await window.GS.loadMapLib(); } catch (e) { el.remove(); return; }
      const feats = miniFeatures(el);
      const m = new maplibregl.Map({ container: el, style: window.GS.mapStyle(), center: [G0.lng, G0.lat], zoom: 10, interactive: false, attributionControl: false });
      m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      setTimeout(() => el.querySelectorAll(".maplibregl-compact-show").forEach(x => x.classList.remove("maplibregl-compact-show")), 600);
      const sch = document.createElement("div"); sch.className = "mpin"; sch.style.background = "#1f4e79";
      new maplibregl.Marker({ element: sch }).setLngLat([G0.lng, G0.lat]).addTo(m);
      const b = new maplibregl.LngLatBounds([G0.lng, G0.lat], [G0.lng, G0.lat]);
      feats.forEach(f => eachCoord(f.geometry, p => b.extend(p)));
      const rec = { m, home: null, b, homeLL: null };
      // include home when known and not too far away (otherwise the area shrinks to a dot)
      const fit = () => {
        const bb = new maplibregl.LngLatBounds(b.getSouthWest(), b.getNorthEast());
        if (rec.homeLL) bb.extend(rec.homeLL);
        m.resize(); m.fitBounds(bb, { padding: 16, duration: 0, maxZoom: 13 });
      };
      rec.fit = fit;
      fit(); m.once("load", fit); m.once("idle", fit); setTimeout(fit, 400);
      window.GS.onStyle(m, () => {
        if (m.getSource("mini")) return;
        m.addSource("mini", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
        m.addLayer({ id: "mini-fill", type: "fill", source: "mini", filter: ["==", ["get", "k"], "area"], paint: { "fill-color": "#0f7b4f", "fill-opacity": 0.12 } });
        m.addLayer({ id: "mini-line", type: "line", source: "mini", filter: ["==", ["get", "k"], "area"], paint: { "line-color": "#0f7b4f", "line-width": 2 } });
        m.addLayer({ id: "mini-dash", type: "line", source: "mini", filter: ["==", ["get", "k"], "last"], paint: { "line-color": "#c25a00", "line-width": 2, "line-dasharray": [2, 1.5] } });
      });
      minis.push(rec); setMiniHome(rec, currentHome);
    };
    const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); build(en.target); } }), { rootMargin: "200px" }) : null;
    els.forEach(el => {
      const go = () => openBigMap(el);
      el.addEventListener("click", go);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      io ? io.observe(el) : build(el);
    });
  }
  // Click a small map to open it large and zoomable in a dialog (one map instance, removed on close)
  function miniFeatures(el) {
    const ids = el.dataset.areas ? el.dataset.areas.split(",") : [];
    const feats = ids.map(id => drawable.find(x => x.id === id)).filter(Boolean).map(x => Object.assign(areaFeature(x), { properties: { k: "area" } }));
    if (el.dataset.last) feats.push(Object.assign(window.GS.circleGeo(G0.lat, G0.lng, +el.dataset.last), { properties: { k: "last" } }));
    return feats;
  }
  // ---------- sharing ----------
  function shareUrl(hash, withPc) {
    const u = new URL(location.href);
    u.search = ""; u.hash = hash ? "#" + hash : "";
    if (withPc && currentHome) u.searchParams.set("pc", currentHome.postcode);
    return u.toString().replace(/%20/g, "+");
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (x) {} ta.remove(); return ok; }
  }
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function initStar() {
    const b = out.querySelector(".headtools .star");
    if (!b) return;
    const paint = () => { const on = window.GS.shortlist.has(s.slug); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.innerHTML = `${window.GS.STAR(on)}${on ? "Shortlisted" : "Shortlist"}`; };
    b.addEventListener("click", () => {
      const on = window.GS.shortlist.toggle(s.slug); paint();
      if (!(on && window.GS.shortlistTip("../"))) toast(on ? "Added to your shortlist" : "Removed from your shortlist");
    });
    document.addEventListener("shortlist", paint);
    paint();
  }
  // Printing: open every fold and special station first, then put them back afterwards
  let printState = null;
  window.addEventListener("beforeprint", () => {
    printState = { folds: [...out.querySelectorAll("details")].map(d => [d, d.open]), stops: [...out.querySelectorAll("li.special")].map(l => [l, l.classList.contains("expanded")]) };
    printState.folds.forEach(([d]) => d.open = true); printState.stops.forEach(([l]) => l.classList.add("expanded"));
  });
  window.addEventListener("afterprint", () => {
    if (!printState) return;
    printState.folds.forEach(([d, o]) => d.open = o); printState.stops.forEach(([l, o]) => l.classList.toggle("expanded", o)); printState = null;
  });
  function initShare() {
    out.addEventListener("click", async e => {
      const b = e.target.closest(".seclink");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();  // handle the fold ourselves: open it, never close it
      const f = document.getElementById(b.dataset.target);
      if (f && f.tagName === "DETAILS") f.open = true;
      const url = shareUrl(b.dataset.target, false);
      // leave the address bar alone, so pasting the link into this tab still jumps and opens the section
      toast(await copyText(url) ? "Link copied" : url);
    });
    const btn = out.querySelector(".sharewrap .sharebtn"), menu = out.querySelector(".sharemenu");
    if (!btn) return;
    const pcBox = menu.querySelector(".share-pc");
    const title = `${s.name}: how to get a Year 7 place`;
    const refresh = () => {
      pcBox.disabled = !currentHome;
      const url = shareUrl("", pcBox.checked);
      menu.querySelector(".share-wa").href = "https://wa.me/?text=" + encodeURIComponent(title + " " + url);
      menu.querySelector(".share-mail").href = "mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(url);
    };
    pcBox.addEventListener("change", refresh);
    btn.addEventListener("click", async () => {
      // phones: the system share sheet (postcode left out)
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ title, url: shareUrl("", false) }); } catch (x) {}
        return;
      }
      const open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); refresh();
    });
    menu.querySelector(".share-print").addEventListener("click", () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); window.print(); });
    menu.querySelector(".share-copy").addEventListener("click", async () => { toast(await copyText(shareUrl("", pcBox.checked)) ? "Link copied" : shareUrl("", pcBox.checked)); menu.hidden = true; btn.setAttribute("aria-expanded", "false"); });
    document.addEventListener("click", e => { if (!e.target.closest(".sharewrap")) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); } });
  }
  function openBigMap(el) {
    const feats = miniFeatures(el);
    let dlg = document.getElementById("bigmap-dlg");
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "bigmap-dlg"; dlg.className = "bigmap-dlg";
      dlg.innerHTML = `<div class="bigmap-head"><b class="bigmap-title"></b><button type="button" class="bigmap-close" aria-label="Close map">×</button></div><div class="bigmap"></div><p class="small muted bigmap-note"></p>`;
      document.body.appendChild(dlg);
      dlg.querySelector(".bigmap-close").onclick = () => dlg.close();
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener("close", () => { if (dlg._map) { dlg._map.remove(); dlg._map = null; } });
    }
    const st = el.closest(".stop");
    const t = st && (st.querySelector(".branch .title") || st.querySelector(".main .title"));
    const title = t ? t.textContent : "";
    dlg.querySelector(".bigmap-title").textContent = (title || s.name).replace(/\s+/g, " ").trim().slice(0, 120);
    dlg.querySelector(".bigmap-note").textContent = feats.some(f => f.properties.k === "last") ? "Dashed circle: last year's furthest offer. Shapes are approximate." : "Shapes are approximate: check the school's own map if you live near an edge.";
    dlg.showModal();
    const holder = dlg.querySelector(".bigmap");
    window.GS.loadMapLib().then(() => {
      const m = dlg._map = new maplibregl.Map({ container: holder, style: window.GS.mapStyle(), center: [G0.lng, G0.lat], zoom: 10, attributionControl: { compact: true } });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      const sch = document.createElement("div"); sch.className = "mpin"; sch.style.background = "#1f4e79"; sch.title = s.name;
      new maplibregl.Marker({ element: sch }).setLngLat([G0.lng, G0.lat]).addTo(m);
      const b = new maplibregl.LngLatBounds([G0.lng, G0.lat], [G0.lng, G0.lat]);
      feats.forEach(f => eachCoord(f.geometry, p => b.extend(p)));
      if (currentHome) {
        new maplibregl.Marker({ element: window.GS.homeMarkerEl(currentHome.postcode) }).setLngLat([currentHome.lng, currentHome.lat]).addTo(m);
        if (window.GS.miles(currentHome, G0) <= 30) b.extend([currentHome.lng, currentHome.lat]);
      }
      const fit = () => { if (dlg._map !== m) return; m.resize(); m.fitBounds(b, { padding: 40, duration: 0, maxZoom: 14 }); };
      requestAnimationFrame(fit); m.once("load", fit); m.once("idle", fit); setTimeout(fit, 300);
      window.GS.onStyle(m, () => {
        if (m.getSource("big")) return;
        m.addSource("big", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
        m.addLayer({ id: "big-fill", type: "fill", source: "big", filter: ["==", ["get", "k"], "area"], paint: { "fill-color": "#0f7b4f", "fill-opacity": 0.12 } });
        m.addLayer({ id: "big-line", type: "line", source: "big", filter: ["==", ["get", "k"], "area"], paint: { "line-color": "#0f7b4f", "line-width": 2.5 } });
        m.addLayer({ id: "big-dash", type: "line", source: "big", filter: ["==", ["get", "k"], "last"], paint: { "line-color": "#c25a00", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
      });
    }).catch(() => { holder.innerHTML = '<p class="empty">The map couldn\'t load. Check your connection.</p>'; });
  }
  function setMiniHome(rec, home) {
    if (rec.home) { rec.home.remove(); rec.home = null; }
    rec.homeLL = null;
    if (home) {
      rec.home = new maplibregl.Marker({ element: window.GS.homeMarkerEl(home.postcode) }).setLngLat([home.lng, home.lat]).addTo(rec.m);
      if (window.GS.miles(home, G0) <= 30) rec.homeLL = [home.lng, home.lat];
    }
    if (rec.fit) rec.fit();
  }
  let currentHome = null;
  function setAreaMapHome(home) {
    currentHome = home;
    minis.forEach(rec => setMiniHome(rec, home));
    if (!areaMap) return;
    if (homeMk) { homeMk.remove(); homeMk = null; }
    if (!home) return;
    homeMk = new maplibregl.Marker({ element: window.GS.homeMarkerEl(home.postcode) }).setLngLat([home.lng, home.lat]).addTo(areaMap);
    const b = new maplibregl.LngLatBounds([G0.lng, G0.lat], [G0.lng, G0.lat]);
    drawable.forEach(x => eachCoord(areaFeature(x).geometry, p => b.extend(p)));
    b.extend([home.lng, home.lat]);
    areaMap.fitBounds(b, { padding: 40, duration: 0, maxZoom: 13 });
  }
  function areasHtml() {
    return (y.areas || []).map(ar => {
      const radius = ar.radius_km != null ? `${ar.radius_km} km${ar.radius_miles != null ? ` (${ar.radius_miles} miles)` : ""}` : ar.radius_miles != null ? `${ar.radius_miles} miles` : "";
      const measured = Array.isArray(ar.measured_at) ? ar.measured_at.map(m => `<b>${esc(m.purpose)}:</b> ${esc(m.when)}`).join("<br>") : esc(ar.measured_at || "");
      return `<div class="area" id="area-${esc(ar.id)}"><h3>${esc(ar.name)}</h3>
      ${dl([["Radius", radius], ["Measured from", esc(ar.from || "")],
           ["Postcode districts", list(ar.postcode_districts)], ["Postcode sectors", list(ar.postcode_sectors)],
           ["Postcodes", ar.postcodes_file ? `${ar.postcode_count ?? "Many"} full postcodes (listed in the policy appendix)` : list(ar.postcodes, 40)],
           ["Councils", list(ar.local_authorities)], ["Wards", list(ar.wards)], ["Parishes", list(ar.parishes)],
           ["Must live there by", ar.resident_by ? fmtDate(ar.resident_by) : ""],
           ["Residence rule", ar.residence ? `${ar.residence.continuous_from ? `Continuously since ${fmtDate(ar.residence.continuous_from)}. ` : ""}${esc(ar.residence.description || "")}` : ""],
           ["When measured", measured],
           ["Map", ar.map_url ? `<a href="${esc(ar.map_url)}" rel="noopener">View map</a>` : ""]])}
      ${ar.description ? `<p>${esc(ar.description)}</p>` : ""}</div>`;
    }).join("");
  }
  const critBy = Object.fromEntries(((y.oversubscription || {}).criteria || []).map(c => [String(c.priority), c]));
  function critLabel(b) {
    if (b.priority != null && critBy[String(b.priority)]) { const c = critBy[String(b.priority)]; return catBadge(c.category, b.priority) + " " + esc(b.label || c.label); }
    if ((b.priorities || []).length) return b.priorities.map(p => catBadge(critBy[String(p)]?.category, p)).join(" ") + " " + esc(b.label || "");
    return esc(b.label || "");
  }
  const num = v => v == null ? "" : typeof v === "number" ? v.toLocaleString("en-GB") : esc(v);
  function allocationsHtml() {
    const al = y.allocations || [];
    if (!al.length) return "";
    return al.map(r => {
      const tested = r.tested ? Object.entries(r.tested).map(([k, v]) => `${esc(stageName(k))}: <b>${num(v)}</b>`).join(" · ") : "";
      const facts = [
        r.applications?.total != null ? `<b>${num(r.applications.total)}</b> applications` : "",
        r.applications?.first_preference != null ? `<b>${num(r.applications.first_preference)}</b> first preferences` : "",
        r.applications?.all_preferences != null ? `<b>${num(r.applications.all_preferences)}</b> preferences (all ranks)` : "",
        tested ? `Tested: ${tested}` : "",
        r.offers != null ? `<b>${num(r.offers)}</b> offers` : "",
        r.cutoff_score != null ? `Cut-off score <b>${num(r.cutoff_score)}</b>` : "",
        r.disadvantaged_offers != null ? `<b>${num(r.disadvantaged_offers)}</b> disadvantaged offers` : "",
        r.lowest_priority_offered != null ? `Places ran out within criterion <b>${esc(r.lowest_priority_offered)}</b>${r.partially_filled ? " (only partly filled)" : ""}` : "",
      ].filter(Boolean).join(" · ");
      const rows = r.by_criterion || [];
      return `<h3>${esc(r.entry_year)} entry</h3>${facts ? `<p class="small">${facts}</p>` : ""}
      ${rows.length ? `<table class="alloc-table"><thead><tr><th>Criterion</th><th class="num">Offers</th><th class="num">Last distance</th><th class="num">Last score</th></tr></thead><tbody>
      ${rows.map(b => `<tr><td>${critLabel(b)}</td><td class="num">${num(b.offers)}</td><td class="num">${b.last_distance_miles != null ? b.last_distance_miles + " mi" : ""}</td><td class="num">${num(b.last_score)}</td></tr>`).join("")}
      </tbody></table>` : ""}
      ${r.last_offered?.description ? `<p class="small">${esc(r.last_offered.description)}</p>` : ""}

`;
    }).join("");
  }
  // ---------- trend charts: one measure per chart (no dual axes), thin line, markers, end labels, hover titles ----------
  function trendSeries() {
    const by = {};
    const put = (yr, k, v) => { if (v == null || v === "" || isNaN(+v)) return; const key = String(yr || "").slice(0, 4); if (!key) return; (by[key] = by[key] || {})[k] ??= +v; };
    (y.stats || []).forEach(r => put(r.entry_year, "score", r.lowest_offer_score));
    (y.allocations || []).forEach(a => { const lo = a.last_offered || {}; put(a.entry_year, "score", lo.score); put(a.entry_year, "dist", lo.distance_miles); });
    const yrs = Object.keys(by).sort();
    return { score: yrs.filter(k => by[k].score != null).map(k => [k, by[k].score]), dist: yrs.filter(k => by[k].dist != null).map(k => [k, by[k].dist]) };
  }
  function sparkChart(title, pts, unit, dp) {
    if (pts.length < 2) return "";
    const W = 300, H = 120, L = 34, R = 38, T = 14, B = 24;
    const vals = pts.map(p => p[1]); let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    const x = i => L + i * (W - L - R) / (pts.length - 1), yv = v => T + (hi - v) * (H - T - B) / (hi - lo);
    const f = v => dp ? v.toFixed(dp) : String(Math.round(v * 10) / 10);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yv(p[1]).toFixed(1)}`).join("");
    const last = pts[pts.length - 1], first = pts[0];
    return `<figure class="trend"><figcaption>${title}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${pts.map(p => `${p[0]} ${f(p[1])}${unit}`).join(", ")}">
        <line class="grid" x1="${L}" x2="${W - R}" y1="${yv(Math.max(...vals))}" y2="${yv(Math.max(...vals))}"/><line class="grid" x1="${L}" x2="${W - R}" y1="${yv(Math.min(...vals))}" y2="${yv(Math.min(...vals))}"/>
        <path class="ln" d="${line}"/>
        ${pts.map((p, i) => `<g class="pt"><circle class="hit" cx="${x(i)}" cy="${yv(p[1])}" r="12"/><circle class="dot" cx="${x(i)}" cy="${yv(p[1])}" r="4.5"/><title>${p[0]} entry: ${f(p[1])}${unit}</title></g>`).join("")}
        <text class="val" x="${x(pts.length - 1) + 8}" y="${yv(last[1]) + 4}">${f(last[1])}${unit}</text>
        <text class="val muted" x="${x(0) - 8}" y="${yv(first[1]) + 4}" text-anchor="end">${f(first[1])}</text>
        ${pts.map((p, i) => `<text class="yr" x="${x(i)}" y="${H - 6}" text-anchor="middle">${p[0]}</text>`).join("")}
      </svg></figure>`;
  }
  function trendHtml() {
    const t = trendSeries();
    const charts = sparkChart("Lowest score offered", t.score, "", 0) + sparkChart("Furthest distance offered", t.dist, " mi", 2);
    return charts ? `<div class="trends">${charts}</div><p class="small muted">By year of entry. Hover a point for the exact figure; the tables below have every number.</p>` : "";
  }
  function statsHtml() {
    const st = y.stats || [];
    if (!st.length) return "";
    const tested = r => r.tested ? Object.entries(r.tested).map(([k, v]) => `${esc(stageName(k))} ${num(v)}`).join("<br>") : "";
    const cols = [["Registered", r => num(r.registered)], ["Sat test", tested], ["Qualified", r => num(r.qualified)],
      ["Applied (CAF)", r => num(r.caf_applications)], ["Offers", r => num(r.offers ?? r.places)],
      ["Cut-off", r => num(r.cutoff_score ?? r.lowest_offer_score)], ["Appeals", r => r.appeals != null ? `${r.appeals}${r.appeals_upheld != null ? ` (${r.appeals_upheld} won)` : ""}` : ""]]
      .filter(([, f]) => st.some(r => f(r)));
    return `<div class="table-wrap"><table class="alloc-table"><thead><tr><th>Entry</th>${cols.map(([h]) => `<th class="num">${h}</th>`).join("")}</tr></thead><tbody>
      ${st.map(r => `<tr><td>${esc(r.entry_year || r.year)}</td>${cols.map(([, f]) => `<td class="num">${f(r)}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
      ${st.some(r => r.extra && Object.keys(r.extra).length) ? `<details class="small"><summary>More figures</summary>${st.filter(r => r.extra).map(r => `<p><b>${esc(r.entry_year || r.year)}:</b> ${Object.entries(r.extra).map(([k, v]) => `${esc(k.replace(/_/g, " "))}: ${esc(typeof v === "object" ? JSON.stringify(v) : v)}`).join(" · ")}</p>`).join("")}</details>` : ""}
`;
  }
  function routesHtml() {
    const r = y.additional_routes || [];
    return r.length ? r.map(x => `<p><b>${esc(x.name)}</b>${x.places != null ? ` · ${x.places} places` : ""}${x.within_pan === false ? " (on top of the PAN)" : ""}<br>${esc(x.description || "")}</p>`).join("") : "";
  }

  const p = s.policy || {};
  function checkedLine() {
    const m = /^(\d{4})/.exec(p.entry_year || "");
    const bits = [];
    if (m) bits.push(`For September ${m[1]} entry`);
    if (s.last_checked) {
      const [yy, mm, dd] = s.last_checked.split("-").map(Number);
      bits.push(`last checked ${new Date(yy, mm - 1, dd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
    }
    return bits.length ? `<p class="small muted checked">${bits.join(" · ")}</p>` : "";
  }
  // ---------- key facts strip ----------
  const reg = (y.registration || []);
  const testReg = reg.find(r => ["test_registration", "sif"].includes(r.kind) && r.deadline && r.required !== false) || reg.find(r => ["test_registration", "sif"].includes(r.kind) && r.deadline) || reg.find(r => r.submit_to !== "home_la" && r.deadline && r.required !== false);
  const caf = reg.find(r => r.kind === "caf" && r.deadline);
  const offerDay = (y.key_dates || []).find(k => /offer day/i.test(k.event));
  const firstTest = (a.stages || []).find(st => st.kind !== "aptitude" && st.dates?.from);
  const qv = (function find(o) {
    if (!o || typeof o !== "object") return null;
    if (Array.isArray(o)) { for (const x of o) { const v = find(x); if (v) return v; } return null; }
    if (o.year_values && o.year_values.length) return o.year_values[0];
    for (const k of ["rules", "rule", "then", "else"]) { const v = find(o[k]); if (v) return v; }
    return null;
  })(a.qualification);
  // Partially selective schools: how many places go by ability/aptitude, and of what kind
  const selFact = (() => {
    if (!s.selection || s.selection === "grammar") return "";
    const KIND = { music: "music", dance: "dance", sport: "sport", technology: "technology", art_and_design: "art", modern_foreign_languages: "languages", performing_arts: "performing arts" };
    const parts = []; let total = 0, unknown = false;
    critList.forEach(c => {
      const sel = c.category === "score_rank" || c.category === "aptitude" || /^selective\b/i.test(c.label || "");
      if (!sel) return;
      const q = c.quota || {};
      let n = q.places || q.max_places || null;
      if (!n) { const m = /(\d+(?:\.\d+)?)\s*%/.exec(c.label || ""); if (m && y.pan) n = Math.round(+m[1] * y.pan / 100); }
      const apt = (c.conditions || []).find(k => k.type === "aptitude");
      const kind = c.category === "aptitude" ? (KIND[apt && apt.subject] || (/language/i.test(c.label) ? "languages" : "aptitude")) : "test";
      if (n) { total += n; const p = parts.find(x => x.kind === kind); p ? p.n += n : parts.push({ kind, n }); } else unknown = true;
    });
    if (!parts.length) return "";
    parts.sort((a, b) => (b.kind === "test") - (a.kind === "test"));
    const showTotal = !y.pan || total <= y.pan;
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    return `${showTotal ? `<b>${total}${unknown ? "+" : ""}</b><span class="of"> of ${y.pan || "?"}</span>` : ""}
      <span class="selparts">${parts.map(p => `<span>${esc(cap(p.kind))}</span><span>${p.n}</span>`).join("")}${unknown ? `<span>More by test</span><span>?</span>` : ""}</span>`;
  })();
  const facts = [
    ["Year 7 places", y.pan ? `<b>${y.pan}</b>` : ""],
    ["Places by ability", selFact],
    ["Entrance test", a.short_name ? esc(a.short_name) + (firstTest ? `<small>${fmtDate(firstTest.dates.from)}</small>` : "") : ""],
    ["Pass mark", qv ? `<b>${esc(qv.value)}</b><small>${esc(qv.entry_year)} entry</small>` : ""],
    ["Register for test by", testReg ? `<b>${fmtDate(testReg.deadline)}</b>` : ""],
    ["Apply to council by", caf ? `<b>${fmtDate(caf.deadline)}</b>` : ""],
    ["Offers", offerDay ? `<b>${fmtDate(offerDay.date)}</b>` : ""],
  ].filter(([, v]) => v);
  const fold = (id, title, body, open = false) => body && body.replace(/<[^>]+>|\s/g, "") ? `<details class="fold card" id="${id}"${open ? " open" : ""}><summary><h2>${title}${linkBtn(id)}</h2></summary><div class="fold-body">${body}</div></details>` : "";
  const tie = (y.tie_breaks || []).length ? `<p><b>Tie-breaks:</b> ${(y.tie_breaks).map(t => esc(t.description || ordering(t))).join(" → ")}</p>` : "";

  out.innerHTML = `
    <header class="school-head">
      <div class="headrow"><p class="crumbs"><a href="../index.html">All schools</a></p>
        <div class="headtools">${s._ics ? window.GS.calMenu(window.GS.calItems(s._ics, s.name + " admissions", "../ics/" + s.slug + ".ics")) : ""}<button type="button" class="star sharebtn" data-slug="${esc(s.slug)}" aria-pressed="false"></button><div class="sharewrap"><button type="button" class="sharebtn" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1Z"/></svg>Share</button>
        <div class="sharemenu" hidden><label class="small"><input type="checkbox" class="share-pc"> Include my postcode</label>
          <button type="button" class="share-copy">Copy link</button><a class="share-wa" target="_blank" rel="noopener">Send on WhatsApp</a><a class="share-mail" target="_blank" rel="noopener">Email</a><button type="button" class="share-print">Print or save as PDF</button></div></div></div></div>
      <h1>${esc(s.name)}</h1>
      <p class="facts">
        <span>${esc(s.town)}</span><span class="g g-${s.gender}">${window.GS.GENDER[s.gender]}</span>
        ${s.selection && s.selection !== "grammar" ? `<span class="ptype">${s.selection === "aptitude_only" ? "Aptitude places" : "Partially selective"}</span>` : `<span>Grammar school</span>`}
        ${s.attainment8 != null ? `<span>Attainment 8: <b>${s.attainment8}</b></span>` : ""}
        ${s.religious_character ? `<span>${esc(s.religious_character)}</span>` : ""}
      </p>
      ${checkedLine()}
      ${y.summary ? `<p class="lede">${esc(y.summary)}</p>` : ""}
      ${s.selective_places && s.selection !== "grammar" ? `<p class="small"><b>Selective places:</b> ${esc(s.selective_places)}</p>` : ""}
    </header>

    ${facts.length ? `<dl class="keybar">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}

    <section class="flow">
      <h2>How to get a place</h2>
      <p class="muted small flow-intro">Follow the line from top to bottom. A child leaves the line at the first station where the answer is yes.</p>
      <ol class="line">
        ${zone("1", "Apply")}
        ${registrationBlock()}
        ${zone("2", "Entrance test")}
        ${stagesBlock()}
        ${qualificationBlock()}
        ${zone("3", "Who gets the places")}
        ${ehcpBlock()}
        ${criteriaBlock()}
      </ol>
    </section>

    <div class="folds">
      ${fold("dates", "Important dates", timeline() && timeline() + `<div class="calsub">${s._ics ? window.GS.calMenu(window.GS.calItems(s._ics, s.name + " admissions", "../ics/" + s.slug + ".ics"), "Add these dates to your calendar") : ""} <a class="small" href="../deadlines.html">Deadlines for all schools</a></div>`)}
      ${fold("test", "About the test", (s._test ? `<p class="sharedtest">This school uses the <a href="../tests/${esc(s._test.id)}.html"><b>${esc(s._test.name)}</b></a>. See every school that uses it.</p>` : "") + dl([["Overview", esc(a.description || "")], ["Set by", esc(a.provider || "")], ["Consortium", esc(a.consortium || "")],
        ["Attempts", esc(a.attempts || "")], ["Access arrangements", esc(a.access_arrangements || "")], ["Missing the test", esc(a.missed_test || "")],
        ["Results", (a.stages || []).filter(x => x.results).map(x => `<b>${esc(x.name)}:</b> ${esc(x.results)}`).join("<br>")],
        ["Before the council deadline", esc(y.outcomes_before_caf || "")]]))}
      ${fold("allocations", "How many got in", trendHtml() + allocationsHtml() + statsHtml())}
      ${fold("areas", "Priority areas", areasHtml() && areaMapHolder() + areasHtml())}
      ${fold("distance", "Distance and tie-breaks", tie + dl([["Method", esc(y.distance?.method?.replace("_", " ") || "")], ["From", esc(y.distance?.from || "")],
        ["To", esc(y.distance?.to || "")], ["Measured by", esc(y.distance?.system || "")], ["Home address", esc(y.distance?.home_address_rule || "")]]))}
      ${fold("waiting", "Waiting list and late applications", dl([["Waiting list", esc(y.waiting_list || "")], ["Late applications", esc(y.late_applications || "")]]))}
      ${fold("routes", "Other ways in", routesHtml())}
      ${fold("good", "Good to know", (y.good_to_know || []).length ? `<ul>${y.good_to_know.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : "")}
    </div>
    <p class="muted small disclaimer">${p.url ? `<a href="${esc(p.url)}" rel="noopener">Read the school's admissions policy</a> · ` : ""}${s.website ? `<a href="${esc(s.website)}" rel="noopener">School website</a> · ` : ""}This page is a summary: always check with the school before applying.${s._report ? ` · <a href="${esc(s._report)}" rel="noopener">Spotted a mistake? Tell us</a>` : ""}</p>
  `;

  // ---------- colour-code priority references in free text ----------
  (function linkPriorityRefs() {
    const crit = Object.fromEntries((((y.oversubscription || {}).criteria) || []).map(c => [String(c.priority).toLowerCase(), c]));
    if (!Object.keys(crit).length) return;
    const TOKEN = "[A-Za-z]?\\d+[a-z]{0,4}(?:\\([ivx]+\\))?";
    const RE = new RegExp(`\\b(criteri(?:on|a)|priorit(?:y|ies)|rules?)(\\s+)(${TOKEN}(?:\\s*(?:[-–]|,|and|or|to)\\s*${TOKEN})*)`, "gi");
    const TOK = new RegExp(TOKEN, "g");
    const keys = Object.keys(crit);
    const mini = t => {
      const tl = t.toLowerCase();
      const c = crit[tl] || crit[keys.find(k => k.startsWith(tl) && !/^\d/.test(k.slice(tl.length)))];
      if (!c) return null;
      const cat = CATEGORIES[c.category] || CATEGORIES.other;
      const a = document.createElement("a");
      a.className = `pmini ${cat.cls}`; a.href = "#p-" + String(c.priority).replace(/[^\w-]/g, "_");
      a.textContent = t; a.title = (String(c.priority) !== t ? `${c.priority}: ` : "") + (c.label || "");
      return a;
    };
    const walker = document.createTreeWalker(out, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest("a, .ppill, .marker, .pmini, script, style") ? NodeFilter.FILTER_REJECT : (RE.test(n.nodeValue) ? (RE.lastIndex = 0, NodeFilter.FILTER_ACCEPT) : NodeFilter.FILTER_SKIP),
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue; const frag = document.createDocumentFragment(); let last = 0; let changed = false;
      text.replace(RE, (m, word, sp, list, off) => {
        frag.append(text.slice(last, off) + word + sp);
        let l = 0;
        list.replace(TOK, (t, o) => {
          frag.append(list.slice(l, o));
          const el = mini(t);
          if (el) { frag.append(el); changed = true; } else frag.append(t);
          l = o + t.length; return t;
        });
        frag.append(list.slice(l)); last = off + m.length; return m;
      });
      frag.append(text.slice(last));
      if (changed) node.replaceWith(frag);
    });
  })();

  // ---------- jumping to a station opens its details ----------
  function openTarget() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    if (el.classList.contains("special")) el.classList.add("expanded");
    const grp = el.closest(".sg-list");
    if (grp && grp.hidden) { grp.hidden = false; const btn = out.querySelector(`[aria-controls="${grp.id}"]`); if (btn) { btn.setAttribute("aria-expanded", "true"); btn.textContent = "Hide"; } }
    if (el.tagName === "DETAILS") el.open = true;
    for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
    el.querySelectorAll("details").forEach(d => d.open = true);
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Links to a priority area land on the top of the "Priority areas" section so its map is in view
    const scrollTo = el.classList.contains("area") && document.getElementById("areamap") ? document.getElementById("areas") : el;
    if (scrollTo !== el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); }
    // opened from a fresh link: start at the top, then glide down once the page has settled
    if (!openTarget.ready && smooth) { window.scrollTo(0, 0); setTimeout(() => scrollTo.scrollIntoView({ block: "start", behavior: "smooth" }), 400); return; }
    requestAnimationFrame(() => scrollTo.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" }));
  }
  window.addEventListener("hashchange", openTarget);
  out.addEventListener("click", e => {
    const t = e.target.closest(".sg-toggle"); if (!t) return;
    const li = t.closest("li.special"); if (!li) return;
    const open = !li.classList.contains("expanded");
    li.classList.toggle("expanded", open);
    li.querySelectorAll(".sg-toggle").forEach(x => x.setAttribute("aria-expanded", String(open)));
  });
  out.addEventListener("click", e => {
    const b = e.target.closest(".subjbtn"); if (!b) return;
    const box = b.closest(".subjects"), info = document.getElementById(b.getAttribute("aria-controls"));
    const open = b.getAttribute("aria-expanded") !== "true";
    box.querySelectorAll(".subjbtn").forEach(x => { x.setAttribute("aria-expanded", "false"); document.getElementById(x.getAttribute("aria-controls")).hidden = true; });
    if (open) { b.setAttribute("aria-expanded", "true"); info.hidden = false; box.appendChild(info); }
  });
  out.addEventListener("click", e => { const a = e.target.closest('a[href^="#"]'); if (a && a.getAttribute("href") === location.hash) { e.preventDefault(); openTarget(); } });
  // remember this school for "Recently viewed" on the home page (this device only)
  try { const k = "gs-recent", l = JSON.parse(localStorage.getItem(k) || "[]").filter(x => x !== s.slug); l.unshift(s.slug); localStorage.setItem(k, JSON.stringify(l.slice(0, 8))); } catch (e) {}
  openTarget();
  window.GS.glossarize(out);
  initMiniMaps();
  initShare();
  initStar();
  openTarget.ready = true;  // later in-page jumps animate straight away
  const areasFold = document.getElementById("areas");
  if (areasFold) { areasFold.addEventListener("toggle", () => { if (areasFold.open) drawAreaMap(); }); if (areasFold.open) drawAreaMap(); }

  // ---------- distance from the visitor's postcode ----------
  (function nearMe() {
    const G = window.GS;
    const holder = document.createElement("div"); holder.className = "nearme";
    const bar = out.querySelector(".keybar");
    (bar || out.querySelector("section.flow")).insertAdjacentElement(bar ? "afterend" : "beforebegin", holder);
    function markStations(r) {
      const byId = {};
      (r ? r.areas : []).forEach(a => { if (a.id) byId[a.id] = a; });
      out.querySelectorAll(".you").forEach(el => {
        const a = byId[el.dataset.area];
        el.className = "you"; el.textContent = ""; el.title = "";
        if (!r || !a) return;
        let st = a.status;
        if (st !== "unknown" && el.dataset.neg) st = st === "in" ? "out" : "in";
        const away = a.radius != null && a.centred_on_school ? ` (${r.miles.toFixed(1)} mi away, limit ${a.radius} mi)` : "";
        if (st === "in") { el.classList.add("yes"); el.textContent = `✓ Yes, from ${home_pc}${away}`; }
        else if (st === "out") { el.classList.add("no"); el.textContent = `✗ No, from ${home_pc}${away}`; }
        // unknown: say nothing (the map and area details are on the page)
      });
    }
    let home_pc = "";
    function show(home) {
      const r = home ? G.assess(s._geo, home) : null;
      home_pc = home ? home.postcode : "";
      markStations(r);
      setAreaMapHome(home);
      const pcq = home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
      history.replaceState(null, "", location.pathname + pcq + location.hash);
      const back = out.querySelector(".crumbs a"); if (back) back.href = "../index.html" + pcq;
      if (r) {
        holder.innerHTML = `<div class="nm-res"><span class="nm-dist"><b>${r.miles.toFixed(1)} miles</b> from ${esc(home.postcode)} <span class="muted small">(straight line)</span></span>
          <span class="gchips">${G.statusChips(r, esc)}</span> <button type="button" class="linkbtn small" id="nm-change">Change postcode</button></div>`;
        holder.querySelector("#nm-change").onclick = () => show(null);
      } else {
        holder.innerHTML = `<form class="nm-form"><label for="nm-pc">How far are you from this school?</label>
          <input id="nm-pc" autocomplete="postal-code" placeholder="Your postcode" value="${home ? esc(home.postcode) : ""}"><button class="btn-primary" type="submit">Check</button>
          <span class="small err" role="alert"></span></form>`;
        G.addLocateButton(holder.querySelector("#nm-pc"), holder.querySelector("form"), holder.querySelector(".err"));
        holder.querySelector("form").onsubmit = async e => {
          e.preventDefault(); const err = holder.querySelector(".err"); err.textContent = "";
          try { const h = await G.lookupPostcode(holder.querySelector("#nm-pc").value); G.saveHome(h); show(h); } catch (x) { err.textContent = x.message; }
        };
      }
    }
    const pcParam = (new URLSearchParams(location.search).get("pc") || "").trim();
    const saved = G.loadHome();
    const same = (x, y) => String(x || "").replace(/\s/g, "").toUpperCase() === String(y || "").replace(/\s/g, "").toUpperCase();
    if (pcParam && !(saved && same(saved.postcode, pcParam))) {
      holder.innerHTML = `<div class="nm-res muted">Looking up ${esc(pcParam)}…</div>`;
      G.lookupPostcode(pcParam).then(h => { G.saveHome(h); show(h); }).catch(() => show(null));
    } else show(saved);
  })();
})();
