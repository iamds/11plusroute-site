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
  // short version of a rule for headlines: ignore the long description where the type says it all
  // One short, predictable line for the pass mark step; the full rule is under "How it's set"
  function passTitle(q) {
    const flat = []; (function w(r) { if (!r) return; if (r.type === "all_of" || r.type === "any_of") (r.rules || []).forEach(w); else flat.push(r); })(q);
    const setBySchool = t => /set (each|every) year|set after|governors|decided|varies|not a fixed|required standard|qualifying standard/i.test(t || "");
    const val = flat.find(r => (r.type === "score_at_least" || r.type === "pass_mark") && r.value != null);
    const top = flat.find(r => r.type === "top_n");
    const review = q.type === "any_of" && flat.some(r => r.type === "other" && /review|headteacher|panel|appeal|refer/i.test(r.description || ""));
    let t;
    if (q.type === "sat_stage") t = `No fixed pass mark: must sit ${esc(stageShort(q.ref))}`;
    else if (val) t = `Score at least ${esc(val.value)}${val.stage ? ` in the ${esc(stageShort(val.stage))}` : ""}`;
    else if (top) t = `Rank in the top ${esc(top.n)}${top.stage ? ` in the ${esc(stageShort(top.stage))}` : ""}`;
    else if (setBySchool(q.description) || flat.some(r => setBySchool(r.description))) t = "Reach a pass mark the school sets";
    else t = "Reach the pass mark";
    return review ? t + ", or be selected on review" : t;
  }
  function shortRule(r) {
    if (!r) return "";
    const known = ["none", "top_n", "score_at_least", "pass_mark", "sat_stage", "progressed_from", "score_relative"];
    if (known.includes(r.type)) {
      if (r.type === "pass_mark") {
        const where = [r.component ? esc(SUBJECTS[r.component] || r.component) : "", r.stage ? esc(stageShort(r.stage)) : ""].filter(Boolean).join(", ");
        if (r.value) return `Reach the pass mark${where ? ` in ${where}` : ""} (${esc(r.value)})`;
        if (where) return `Reach the pass mark in ${where}`;
        return /set (each|every) year|set after|governors|decided|varies|not a fixed/i.test(r.description || "") ? "Reach a pass mark the school sets" : "Reach the pass mark";
      }
      if (r.type === "top_n") return `Rank in the top ${esc(r.n)}${r.stage ? ` in ${esc(stageShort(r.stage))}` : ""}`;
      if (r.type === "score_at_least") return `Score at least ${esc(r.value)}${r.stage ? ` in ${esc(stageShort(r.stage))}` : ""}`;
      if (r.type === "none") return "No minimum score";
      return rule({ ...r, description: undefined });
    }
    if (r.type === "all_of" || r.type === "any_of") {
      const parts = [...new Set((r.rules || []).map(shortRule).filter(Boolean))];
      // "Reach the pass mark in A", "...in B" -> "Reach the pass mark in A and B"
      const pm = parts.filter(p => /^Reach the pass mark in /.test(p) && !/\(/.test(p)), rest = parts.filter(p => !pm.includes(p));
      const merged = pm.length > 1 ? [`Reach the pass mark in ${pm.map(p => p.replace(/^Reach the pass mark in /, "")).join(r.type === "all_of" ? " and " : " or ")}`] : pm;
      let all = [...merged, ...rest];
      // "within 20 points of the pass mark OR reach the pass mark" is just "within 20 points of the pass mark"
      if (r.type === "any_of" && all.some(p => /below the pass mark|of the pass mark/.test(p))) all = all.filter(p => !/^Reach the pass mark$/.test(p));
      if (r.type === "any_of") {
        // "Score at least 115 in X or Score at least 110 in X" -> the lower one
        const sc = all.map(p => /^Score at least (\d+) in (.+)$/.exec(p));
        if (sc.every(Boolean) && new Set(sc.map(m => m[2])).size === 1) all = [`Score at least ${Math.min(...sc.map(m => +m[1]))} in ${sc[0][2]}`];
        if (all.length > 1 && all.includes("Meet the school's score requirement")) all = [all.filter(p => p !== "Meet the school's score requirement")[0] + " (or another route)"];
      }
      const out = all.join(r.type === "all_of" ? " <b>and</b> " : " <b>or</b> ");
      return out.replace(/<[^>]+>/g, "").length > 110 ? `${all[0]} ${r.type === "all_of" ? "(and other conditions)" : "(or another route)"}` : out;
    }
    if (r.type === "school_determined") return "Be one of those invited (the school invites at least enough to fill its places)";
    const t = String(r.description || r.type).split(/(?<=[.;])\s/)[0].replace(/[.;]$/, "");
    return t.length > 90 ? "Meet the school's score requirement" : esc(t);
  }
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
        const base = b.type === "rank_score" ? `the ${b.n}th-ranked score` : "the pass mark";
        if (r.within_percent != null) return `Within ${r.within_percent}% of ${base}`;
        if (r.offset_points != null) return r.offset_points < 0 ? `Up to ${Math.abs(r.offset_points)} points below ${base}` : `At least ${r.offset_points} points above ${base}`;
        return `At or above ${base}`;
      }
      case "school_determined": return `Number set by the school${r.typical_n ? ` (typically about ${r.typical_n})` : ""}`;
      case "date_of_birth_range": return `Born ${fmtDate(r.from)} – ${fmtDate(r.to)}`;
      default: return esc(r.type);
    }
  }
  // "Lives in <area>?" reads badly for names like "Within 3 miles" or "The 22 nearest applicants"
  function areaQ(ref, neg) {
    const name = String(areas[ref]?.name || ref).replace(/^lives (in|within)\s+/i, "");
    const link = t => `<a href="#area-${esc(ref)}">${esc(t)}</a>`;
    let m;
    if ((m = /^within\s+(.*)$/i.exec(name))) return neg ? `Doesn't live within ${link(m[1])}?` : `Lives within ${link(m[1])}?`;
    if (/^\d+(\.\d+)?\s*(miles?|km)\b/i.test(name)) return neg ? `Lives outside ${link(name)}?` : `Lives within ${link(name)}?`;
    if (/^anywhere\b/i.test(name)) return neg ? `Lives outside ${link(name.replace(/^anywhere\s+/i, ""))}?` : `Lives ${link(name.charAt(0).toLowerCase() + name.slice(1))}?`;
    if ((m = /^the\s+(\d+\s+nearest.*)$/i.exec(name))) return neg ? `Not one of ${link("the " + m[1])}?` : `One of ${link("the " + m[1])}?`;
    return neg ? `Lives outside ${link(name)}?` : `Lives in ${link(name)}?`;
  }
  function cond(c) {
    switch (c.type) {
      case "looked_after": return "Is looked after, or was previously looked after?";
      case "pupil_premium": return `Eligible for Pupil Premium${c.basis && !/^eligible for pupil premium/i.test(c.basis) ?` <span class="cdesc">(${esc(c.basis)})</span>` : ""}?`;
      case "free_school_meals": return `Eligible for free school meals${c.basis ? ` <span class="cdesc">(${esc(c.basis)})</span>` : ""}?`;
      case "service_premium": return "Eligible for Service Premium?";
      case "medical_social": return `Exceptional medical or social need?${c.description ? ` <span class="cdesc">${esc(c.description)}</span>` : ""}`;
      case "sibling": return `Has a sibling at the school?${c.description ? ` <span class="cdesc">${esc(c.description)}</span>` : ""}`;
      case "staff_child": return `Child of a member of staff?${c.description ? ` <span class="cdesc">${esc(c.description)}</span>` : ""}`;
      case "faith": return `Meets the faith requirement?${c.requirement ? ` <span class="cdesc">${esc(c.faith ? c.faith + ": " : "")}${esc(c.requirement)}</span>` : ""}`;
      case "feeder_school": {
        const l = c.schools || [];
        if (l.length <= 1) return `Attends ${l.length ? esc(l[0]) : "a feeder school"}?`;
        return `Attends one of ${l.length} feeder schools? <details class="feeders"><summary>Show the list</summary><span class="muted">${esc(l.join(", "))}</span></details>`;
      }
      case "in_area": return `${areaQ(c.ref, false)} <span class="you" data-area="${esc(c.ref)}"></span>`;
      case "not_in_area": return `${areaQ(c.ref, true)} <span class="you" data-area="${esc(c.ref)}" data-neg="1"></span>`;
      // the test details (who goes on, how it's marked) live in the test section; keep the question short
      case "aptitude": return `Shows ${esc(c.subject || "")} aptitude?${c.requirement && !/test|score|mark|assess|audition|round|stage/i.test(c.requirement) ? ` <span class="cdesc">${esc(c.requirement)}</span>` : ""}`;
      case "any_of": return (c.conditions || []).map(x => cond(x).replace(/\?(?=(\s*<span[^>]*>[^<]*<\/span>)*\s*$)/, "").replace(/\?\s*(<details)/, " $1")).join(` <b class="or">or</b> `).replace(/\?\s*$/, "") + "?";
      default: {
        // long free-text conditions: keep the first sentence without brackets as the question, the rest goes in the details
        const full = String(c.description || c.type), first = full.replace(/\s*\([^)]*\)/g, "").split(/(?<=[a-z0-9]{2}\.)\s+(?=[A-Z])/)[0].replace(/[.?\s]+$/, "");
        return esc(first) + "?" + (first.length < full.replace(/[.?\s]+$/, "").length ? ` <span class="cdesc">${esc(full)}</span>` : "");
      }
    }
  }
  // the explanation of each condition (who counts as a sibling, what Pupil Premium means here...) goes in the details
  function condNotes(list) {
    const out = [];
    (function w(cs) { (cs || []).forEach(c => {
      if (c.type === "any_of") return w(c.conditions);
      const longOther = !["looked_after", "pupil_premium", "free_school_meals", "service_premium", "medical_social", "sibling", "staff_child", "faith", "feeder_school", "in_area", "not_in_area", "aptitude"].includes(c.type) && c.description && c.description.replace(/\s*\([^)]*\)/g, "").split(/(?<=[a-z0-9]{2}\.)\s+(?=[A-Z])/)[0].length < c.description.length - 2 ? c.description : "";
      const t = longOther || c.basis || (c.type === "faith" ? (c.faith ? c.faith + ": " : "") + (c.requirement || "") : "") || (["sibling", "staff_child", "medical_social"].includes(c.type) ? c.description : "") || (c.type === "aptitude" ? c.requirement : "");
      if (t) out.push(esc(t));
    }); })(list);
    return out.length ? `<div class="desc"><b>Who counts:</b> ${out.join(" ")}</div>` : "";
  }
  function ordering(o) {
    switch (o.type) {
      case "score": return "highest " + (o.component ? esc(SUBJECTS[o.component] || o.component) + " " : "test ") + "score" + (o.stage && o.stage !== "final" ? ` (${esc(stageShort(o.stage))})` : "");
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
  // which home address counts, and on what date: shown on every step that depends on where you live
  const usesAddress = c => c.category === "distance" || c.category === "area" || JSON.stringify(c.conditions || []).match(/"(in_area|not_in_area)"/);
  // Does this step need a test result as well as the address, or is the address enough?
  // How places are decided inside a priority: shown on the left with the question, because it decides who gets in.
  const SHORT_ORDER = o => {
    switch (o.type) {
      case "score": return "Test score" + (o.component ? ` (${esc(SUBJECTS[o.component] || o.component)})` : "");
      case "distance": return o.area_first ? `Living in ${esc(areas[o.area_first]?.name || o.area_first)} first, then distance` : "Distance";
      case "random": return "Random draw";
      case "sub_criteria": return "Sub-priorities in order";
      default: { const t = String(o.description || (o.type === "condition" ? cond(o.condition || {}).replace(/<[^>]+>/g, "").replace(/\?.*$/, "") : o.type)).replace(/[.\s]+$/, ""); return t.length > 45 || /^(equal|tie|if |ties|identical|rule \()/i.test(t) ? "" : esc(t); }
    }
  };
  function reqFor(c) {
    const q = a.qualification || {};
    const scoreOrder = (c.order_within || []).some(o => o.type === "score") || c.category === "score_rank";
    const tested = scoreOrder || c.category === "aptitude";
    let req = "";
    let reqFull = "";
    if (c.academic_requirement && c.academic_requirement.type === "none") req = tested ? "Must sit the test (no minimum score)" : "";
    else if (c.academic_requirement) { req = shortRule(c.academic_requirement); reqFull = rule(c.academic_requirement); if (reqFull === req) reqFull = ""; }
    else if (s.selection === "grammar" && q.type && q.type !== "none") req = q.type === "sat_stage" ? `Must have sat ${esc(stageShort(q.ref))}` : "Must reach the pass mark";
    // "sat Stage Two" / "got through Part I" just repeats the test stages; when places go by score it adds nothing
    const stageOnly = r => r && (["sat_stage", "progressed_from"].includes(r.type) || (r.type === "all_of" && (r.rules || []).every(x => ["sat_stage", "progressed_from", "top_n"].includes(x.type))));
    if (scoreOrder && (stageOnly(c.academic_requirement) || (!c.academic_requirement && q.type === "sat_stage"))) req = "";
    // a mark needed to get through an earlier test stage is a test rule (shown in the test section), not a priority rule
    const gateStages = new Set((a.stages || []).filter(st => st.progression).map(st => st.id));
    const isGate = r => r && ((r.stage && gateStages.has(r.stage)) || (r.ref && gateStages.has(r.ref)) || (["all_of", "any_of"].includes(r.type) && (r.rules || []).length && r.rules.every(x => isGate(x) || stageOnly(x))));
    if (isGate(c.academic_requirement)) req = "";
    // when places go by score, the pass mark only matters if fewer children qualify than there are places
    const qs = (y.stats || []).filter(r => r.qualified).sort((p1, p2) => String(p2.entry_year).localeCompare(String(p1.entry_year)))[0];
    const tight = qs && y.pan && qs.qualified <= y.pan * 1.1;
    if (scoreOrder && !tight && ((!c.academic_requirement && /pass mark/.test(req)) || (c.academic_requirement && c.academic_requirement.type === "pass_mark"))) req = "";
    req = req.replace(/[.\s]+$/, "");
    return { req, reqFull, tested, scoreOrder };
  }
  // the score a priority needs, as one more "and" question in its title
  function reqQ(req) {
    const one = (t, k) => {
      let x = t.replace(/^Must reach /, "Reaches ").replace(/^Must have sat /, "Sat ").replace(/^Must sit /, "Sat ")
        .replace(/^Reach /, "Reaches ").replace(/^Score at least /, "Scores at least ").replace(/^Rank in /, "Ranks in ").replace(/^Meet /, "Meets ").replace(/^Be one of /, "Is one of ")
        .replace(/^(Up to|At least|At or above|Within) /, m => "Scores " + m.toLowerCase()).replace(/^A score /, "Has a score ");
      return k ? x.replace(/^(Scores|Reaches|Ranks|Meets|Is|Has|Not|Sat)\b/, m => m.toLowerCase()) : x;
    };
    let tail = ""; const m = /\s*\((or another route|and other conditions|no minimum score)\)$/.exec(req);
    if (m) { tail = ` <span class="muted">(${m[1]})</span>`; req = req.slice(0, m.index); }
    const parts = req.split(/ (or|and) (?=[A-Z])/);
    let out = ""; for (let k = 0; k < parts.length; k += 2) out += (k ? ` ${parts[k - 1]} ` : "") + one(parts[k], k);
    return out.trim().replace(/^./, x => x.toUpperCase()) + "?" + tail;
  }
  function needsLine(c, saysOrder, inTitle, noMin) {
    const { req: req0, reqFull, tested } = reqFor(c);
    const req = inTitle ? "" : req0;
    const chain = (c.order_within || []).length ? c.order_within : (y.tie_breaks || []);
    // "Test score → Test score (VR) → Test score (English)..." is just the total with sub-score tie-breaks: say it once
    const slim = []; chain.forEach(o => { const prev = slim[slim.length - 1]; if (o.type === "score" && prev && prev.type === "score") return; slim.push(o); });
    // the title already says "highest test scores first" / "nearest first": only the tie-breaks are left to show
    let rkLabel = "Ranked by";
    { const k = saysOrder ? slim.findIndex(o => o.type === saysOrder) : -1;
      if (k >= 0 && slim.slice(0, k).every(o => o.type !== "sub_criteria" && !SHORT_ORDER(o))) { slim.splice(0, k + 1); rkLabel = "Ties broken by"; } }
    const tidy = t => { let x = t, prev; do { prev = x; x = x.replace(/^(\(?[ivx]+\)|\d+(st|nd|rd|th)\s*(\([^)]*\))?:|then)\s*/i, ""); } while (x !== prev); return x.replace(/^./, m => m.toUpperCase()); };
    // sub-priorities: name each group in turn, and say once how each group is ordered when they all share it
    let sfx = "";
    const order = slim.flatMap(o => {
      if (o.type === "sub_criteria") {
        const sc = o.criteria || [];
        const t0 = sc.map(x => ((x.order_within || [])[0] || {}).type);
        if (t0.length && t0.every(t => t && t === t0[0]) && ["score", "distance", "random"].includes(t0[0])) sfx = { score: "each by test score", distance: "each by distance", random: "each by random draw" }[t0[0]];
        return sc.map(x => esc(String(x.label).replace(/\s*\([^)]*\)/g, "").trim()));
      }
      return [o.type === "score" && !o.component && chain.filter(x => x.type === "score").length > 1 ? "Total test score" : SHORT_ORDER(o)];
    }).filter(Boolean).map(tidy);
    const gate = req ? `<div class="gate need"><span class="rk-l">Needs</span><span class="rk-v">${req.replace(/^./, m => m.toUpperCase())}</span>${reqFull ? `<details class="feeders"><summary>more</summary><span class="muted">${reqFull}</span></details>` : ""}</div>`
      : noMin ? `<div class="gate free"><span class="rk-l">Test score</span><span class="rk-v">No minimum score</span></div>` : (!tested && !req0 ? `<div class="gate free"><span class="rk-l">Test score</span><span class="rk-v">Not needed</span></div>` : "");
    const rank = order.length ? `<div class="rank"><span class="rk-l">${rkLabel}</span>${order.map((o, k) => `<span class="rk-v${k ? " tb" : ""}">${o}</span>`).join('<span class="rk-arrow">→</span>')}${sfx ? `<span class="rk-sfx">· ${sfx}</span>` : ""}</div>` : "";
    return gate || rank ? `<div class="decides">${gate}${rank}</div>` : "";
  }
  // full rule once at the top of "Who gets the places"; each address-based step just repeats the date
  function addressShort() {
    const ad = y.address_date;
    return `<div class="addr"><b>Address date:</b> ${ad && ad.date ? fmtDate(ad.date) + " " : ""}<a href="#addr-rule">(see above)</a></div>`;
  }
  function addressLine() {
    const ad = y.address_date;
    if (ad && ad.rule) return `<div class="addr"><b>Address date:</b> ${esc(ad.rule)}${ad.after_move ? ` <span class="muted">${esc(ad.after_move)}</span>` : ""}</div>`;
    if (!ad || (!ad.date && !ad.when)) return `<div class="addr"><b>Address date:</b> the policy doesn't say which date your address is taken on. Ask the school or council.${ad && ad.after_move ? ` <span class="muted">${esc(ad.after_move)}</span>` : ""}</div>`;
    const w = ad.when ? (/^(the|when|a|an)\b/i.test(ad.when) || /^[\dA-Z]/.test(ad.when) ? ad.when : "the " + ad.when) : "";
    if (/^the address/i.test(w) && !ad.date) return `<div class="addr"><b>Address date:</b> ${esc(w)}.${ad.after_move ? ` <span class="muted">${esc(ad.after_move)}</span>` : ""}</div>`;
    const when = ad.date ? `${fmtDate(ad.date)}${w && !/^\d/.test(w) ? `, ${esc(w)}` : ""}` : esc(w);
    return `<div class="addr"><b>Address date:</b> where you live on ${when}${ad.continuous_from && !/since/i.test(w) ? (ad.continuous_from === ad.date ? ", and keep living there until your child starts" : `, having lived there since ${fmtDate(ad.continuous_from)}`) : ""}.${ad.after_move ? ` <span class="muted">${esc(ad.after_move)}</span>` : ""}</div>`;
  }
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
    return `<li class="stop ${o.cls || ""}${o.branch ? " has-branch" : ""}"${o.id ? ` id="${o.id}"` : ""}${o.attrs || ""}>
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

  // ---------- subject chips: tap one to see this school's details for that part of the test ----------
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
      ].filter(Boolean);
      // every subject opens the same way; add the glossary definition of the term, if there is one
      const gl = (window.GLOSSARY || []).find(g => { try { return new RegExp(`^(?:${g.match})$`, "i").test(SUBJECTS[c.subject] || ""); } catch (e) { return false; } });
      if (gl) lines.push(`<span class="muted">${esc(gl.term)}: ${esc(gl.def)}</span>`);
      if (!lines.length) lines.push(`<span class="muted">The school hasn't published more detail about this part of the test.</span>`);
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
        branch: null });
      if (st.progression && next) {
        // say who goes through to the next round, rather than a "not invited" exit off to the side
        const exc = (st.progression.exceptions || []).map(e => `<div class="exc">${esc(e.applies_to || "Some groups")}: ${rule(e.rule)}</div>`).join("");
        const ties = st.progression.ties ? `<div class="exc">Ties: ${esc(st.progression.ties)}</div>` : "";
        const full = st.progression.description && shortRule(st.progression) !== esc(st.progression.description) ? `<div class="exc">${esc(st.progression.description)}</div>` : "";
        h += seg(`<span class="go">To reach ${esc(stageShort(next.id) || next.name)}:</span> ${shortRule(st.progression).replace(/^./, m => m.toLowerCase())}${full || exc || ties ? more(full + exc + ties, "More") : ""}`, "yes");
      }
    });
    // aptitude tests: one station each, like the academic test, with "To reach …" between rounds
    apt.forEach((st, i) => {
      // rounds of the same test (music1, music2) go one after the other; different tests (sport, music) stand alone
      const stem = x => String(x.id || "").replace(/_?r?\d+$/, "");
      const grp = apt.filter(x => stem(x) === stem(st)), gi = grp.indexOf(st);
      const next = grp[gi + 1];
      const comps = subjectChips(st, 50 + i);
      h += stop({ id: i ? `aptitude-${i + 1}` : "aptitude", cls: "test apt", kicker: `Aptitude test · optional${grp.length > 1 ? ` · round ${gi + 1} of ${grp.length}` : ""}`, title: esc(st.name),
        body: `${st.dates?.from ? `<div class="when">${range(st.dates)}</div>` : ""}${comps ? `<div class="subjects">${comps}</div>` : ""}
        ${more(`${st.entry ? `<div class="desc">Who can sit it: ${rule(st.entry)}</div>` : ""}
        ${(st.used_for || []).length ? `<div class="desc">Counts only for criteria ${st.used_for.map(esc).join(", ")}</div>` : ""}`)}` });
      if (st.progression) {
        const full = st.progression.description && shortRule(st.progression) !== esc(st.progression.description) ? `<div class="exc">${esc(st.progression.description)}</div>` : "";
        const label = next ? `To reach ${esc(stageShort(next.id) || next.name)}:` : "To go on:";
        h += seg(`<span class="go">${label}</span> ${shortRule(st.progression).replace(/^./, m => m.toLowerCase())}${full ? more(full, "More") : ""}`, "yes");
      }
    });
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
    if (q && q.type !== "none") {
      const short = passTitle(q);
      const full = rule(q);
      h += stop({ id: "pass-mark", cls: "decision passmark", kicker: "Pass mark", title: short.replace(/^./, m => m.toUpperCase()), body: full && full !== short ? more(`<div class="desc">${full}</div>`, "How it's set") : "" });
    }
    return h;
  }

  function ehcpBlock() {
    if (!y.ehcp) return "";
    return stop({ id: "ehcp", cls: "crit c-other", marker: "E", kicker: "EHCP · before all other priorities", title: "Has an EHCP that names the school",
      branch: { label: "Yes", cls: "in", html: `<div class="title">Admitted</div>${more(`<div class="desc">${esc(y.ehcp.description || "")}</div>`)}` } }) + seg("No", "no");
  }

  function criteriaBlock() {
    const ov = y.oversubscription || {};
    let crit = ov.criteria || [];
    if (!crit.length) return stop({ cls: "end crit-missing", kicker: "Not available", title: "Priority order not available", body: `<div class="desc">Check the school's admissions policy for how places are given.</div>` });
    // Some schools hand out places in a different order from their numbered list: draw the line in the real order
    const ao = (ov.allocation_order || []).map(String);
    const byP = Object.fromEntries(crit.map(c => [String(c.priority), c]));
    const reordered = ao.length === crit.length && ao.every(p => byP[p]) && ao.join("|") !== crit.map(c => String(c.priority)).join("|");
    if (reordered) crit = ao.map(p => byP[p]);
    const groups = ov.quota_groups || [];
    const groupOf = p => groups.filter(g => (g.priorities || []).map(String).includes(String(p)));
    const addrTop = crit.some(c => usesAddress(c)) ? `<li class="seg" id="addr-rule"><div class="rail"></div><div class="seglabel addrtop">${addressLine().replace(/<b>Address date:<\/b>/, '<b>Address date</b> <span class="muted">(for every step below that depends on where you live)</span><br>')}</div></li>` : "";
    let h = addrTop + (reordered ? `<li class="seg"><div class="rail"></div><div class="seglabel muted small">Shown in the order places are given out, which differs from the school's numbering.</div></li>` : "");
    const hasSize = g => g.places != null || g.max_places != null || g.min_places != null || g.percent != null;
    const SPECIAL = { looked_after: "looked-after children", disadvantaged: "Pupil Premium or free school meals", medical_social: "medical or social need", staff: "staff children" };
    const pos = p => crit.findIndex(x => String(x.priority) === String(p));
    const together = g => { const idx = (g.priorities || []).map(p => crit.findIndex(x => String(x.priority) === String(p))).filter(k => k >= 0).sort((x, y2) => x - y2); return idx.length >= 2 && idx[idx.length - 1] - idx[0] === idx.length - 1; };
    // the school-wide "furthest offer" belongs to the last priority that is decided by distance, not one that only uses it to break ties
    const lastDistIdx = (() => { let k = -1; crit.forEach((c, i) => { if (c.category === "distance" || ((c.order_within || [])[0] || {}).type === "distance") k = i; }); return k; })();
    const built = crit.map((c, i) => {
      const cat = CATEGORIES[c.category] || CATEGORIES.other;
      const rq = reqFor(c);
      // a score the priority needs is just another "and" condition: put it in the title with the others
      const conds0 = (c.conditions || []).map(k => ["in_area", "not_in_area"].includes(k.type) ? cond(k).replace('<span class="you"', '<span class="you" data-top="1"') : k.type === "any_of" ? cond(k).replace(/<span class="you"/g, '<span class="you" data-or="1"') : cond(k));
      const noMin = /no minimum score/.test(rq.req);
      const conds = conds0.length && rq.req && !noMin ? conds0.concat(reqQ(rq.req)) : conds0;
      const al = allocFor(c.priority);
      const subs = (c.order_within || []).filter(o => o.type === "sub_criteria").map(o =>
        `<ol class="subcrit">${(o.criteria || []).map(sc => `<li>${esc(sc.label)}${sc.description ? ` <span class="muted">· ${esc(sc.description)}</span>` : ""}</li>`).join("")}</ol>`).join("");
      const qchip = c.quota && quotaSize(c.quota) ? `<span class="quota">${esc(quotaSize(c.quota))}</span>` : "";
      const facts = usesAddress(c) ? addressShort() : "";
      const det = more(`<div class="desc"><b>The policy calls this:</b> ${esc(c.label)}</div>
        ${rq.reqFull ? `<div class="desc"><b>Score needed:</b> ${rq.reqFull}</div>` : ""}
        ${c.quota ? quota(c.quota).replace(/^<div class="quota">.*?<\/div>/, "") : ""}
        ${groupOf(c.priority).filter(hasSize).map(g => g.description ? `<div class="desc">${esc(g.description)}</div>` : "").join("")}
        ${c.applies_at === "initial_allocation" ? `<div class="desc">Only applies when places are first offered on National Offer Day, not to later offers from the waiting list.</div>` : ""}
        ${condNotes(c.conditions)}
        ${c.description ? `<div class="desc">${esc(c.description)}</div>` : ""}
        ${subs}
        ${(c.order_within || []).length ? `<div class="desc"><b>If oversubscribed:</b> ${c.order_within.map(ordering).join(", then ")}</div>` : ""}
        ${c.evidence ? `<div class="desc"><b>Evidence:</b> ${esc(c.evidence)}${c.evidence_deadline ? ` by ${fmtDate(c.evidence_deadline)}` : ""}</div>` : ""}`);
      // in a shared pot after other priorities: these places are what's left of the pot, not a fixed number
      const shG = groupOf(c.priority).find(g => hasSize(g) && together(g) && String((g.priorities || [])[0]) !== String(c.priority) && pos(c.priority) > Math.min(...(g.priorities || []).map(pos)));
      const sharedRest = shG ? (shG.places ?? shG.max_places ?? "") + "" : "";
      // 1. WHO: every condition, the minimum score included, joined with "and"
      let title;
      if (conds0.length) title = conds.join(`<span class="and">and</span>`);
      else {
        const base = i < crit.length - 1 ? (s.selection === "grammar" ? "Anyone" : "Any applicant") : "Everyone else";
        const who = base === "Any applicant" ? "Anyone" : base;
        const r = rq.req, topN = /^Rank in the top (\d+)\b/.exec(r || ""), cap = c.quota ? (c.quota.places || c.quota.max_places) : null;
        if (noMin) title = `${who} who sat the test`;
        else if (r && !(topN && cap && +topN[1] === +cap)) title = /^(Must reach|Reach) the pass mark$/.test(r) ? `${who} who reaches the pass mark`
          : `${who} who ${reqQ(r).replace(/\?.*$/, "").replace(/^./, x => x.toLowerCase()).replace(/^(assessed|ranked)/, "is $1")}`;
        else if (rq.tested) title = `${who} who ${s.selection === "grammar" ? "qualifies" : "sat the test"}`;
        else title = base;
      }
      const acad = needsLine(c, "", true, noMin);
      // 3. PLACES: the cap if there is one; otherwise how many got in this way last time
      const capTxt = sharedRest ? `The rest of the ${sharedRest}` : c.quota && quotaSize(c.quota) ? quotaSize(c.quota)
        : groupOf(c.priority).filter(hasSize).filter(g => !together(g)).map(g => { const others = (g.priorities || []).map(String).filter(x => x !== String(c.priority)); return others.length ? `Shares ${groupAmount(g)} with ${others.map(x => shortLabel(critByP()[x]?.label || x)).join(" and ")}` : ""; }).filter(Boolean)[0] || "";
      // with a hard cap, last year's count only matters when it fell short of the cap
      const capN = sharedRest ? null : c.quota ? (c.quota.places ?? null) : null;
      const showCount = al && al.offers != null && !(capN != null && +al.offers === +capN);
      const fAny = furthestFor(c, i === lastDistIdx);
      const farMi = al && al.last_distance_miles != null ? al.last_distance_miles : fAny ? fAny.mi : null;
      const farYr = al && al.last_distance_miles != null ? latestAlloc.entry_year : fAny ? String(fAny.year).slice(0, 4) : "";
      const lastYr = [showCount ? `<b>${al.offers}</b> got a place this way in ${esc(latestAlloc.entry_year)}` : "",
        farMi != null ? `furthest offer in ${esc(farYr)}: <b>${farMi} mi</b>` : "",
        al && al.last_score != null ? `lowest score ${al.last_score}` : ""].filter(Boolean).join(" · ").replace(/^./, x => x.toUpperCase());
      const placesRow = `<div class="placesrow"><span class="rk-l">Places</span><span class="rk-v${capTxt ? " cap" : " nocap"}">${capTxt ? esc(capTxt) : "No set number"}</span>${lastYr ? `<span class="lastyr">${lastYr}</span>` : ""}</div>`;
      const qs = c.quota ? quotaSize(c.quota).replace(/^Up to /, "").replace(/^At least /, "") : "";
      const noLabel = !conds.length ? "" : c.quota ? (qs ? `No, or its ${esc(qs)} have gone` : "No, or its share of places has gone") : "No";
      // small fixed map for stations that depend on where you live
      const refs = []; (function walk(cs) { (cs || []).forEach(k => { if (k.type === "in_area" && k.ref) refs.push(k.ref); if (k.type === "any_of") walk(k.conditions); }); })(c.conditions);
      const ids = [...new Set(refs.map(id => areaGroupOf[id] || id))].filter(id => drawable.some(x => x.id === id));
      const farAny = !ids.length ? furthestFor(c, i === lastDistIdx) : null;
      const far = farAny && farAny.own ? farAny : null;  // only map a priority's own furthest-offer figure
      const mini = G0.lat != null && (ids.length || far) ? `<div class="minimap linked" role="button" tabindex="0" data-areas="${esc(ids.join(","))}" data-last="${far ? far.mi : ""}" aria-label="Open a larger map"><span class="mm-hint" aria-hidden="true">⤢ Enlarge</span></div>` : "";
      const facthtml = facts.replace(/<[^>]+>|\s/g, "") ? `<div class="cfacts">${facts}</div>` : "";
      const rows = acad.replace(/<\/div>$/, placesRow + "</div>") || `<div class="decides">${placesRow}</div>`;
      const card = `<div class="cbody${mini ? " hasmap" : ""}"><div class="cmain">${acad ? rows : `<div class="decides">${placesRow}</div>`}${facthtml}${det}</div>${mini}</div>`;
      return { attrs: farMi != null && byDistance(c) ? ` data-far="${farMi}" data-faryr="${esc(farYr)}"` : "", c, cat, conds, qchip: "", card, title, noLabel, id: "p-" + String(c.priority).replace(/[^\w-]/g, "_"), special: !!SPECIAL[c.category] };
    });
    const gcls = () => "", gattr = () => "", gseg = () => "";
    let i = 0;
    while (i < built.length) {
      const b = built[i];
      if (b.special) {
        h += stop({ id: b.id, cls: `crit special ${b.cat.cls}${gcls(i)}`, attrs: b.attrs, marker: esc(markText(b.c.priority)),
          kicker: esc(b.cat.label) + (String(b.c.priority).length > 5 ? ` · <span class="plabel">${esc(b.c.priority)}</span>` : ""),
          title: `<span class="sg-short">${esc(b.c.label)} <button type="button" class="sg-toggle" aria-expanded="false">Show</button></span><span class="sg-full ctitle"><span>${b.title}</span>${b.qchip}</span>`,
          body: `<div class="sg-full">${b.card}<button type="button" class="sg-toggle sg-hide" aria-expanded="true">Hide</button></div>` });
        if (i < built.length - 1) h += seg("", "no" + gseg(i));
        i++; continue;
      }
      h += stop({ id: b.id, cls: `crit ${b.cat.cls}${gcls(i)}`, attrs: b.attrs, marker: esc(markText(b.c.priority)), kicker: esc(b.cat.label) + aptSubject(b.c) + (String(b.c.priority).length > 5 ? ` · <span class="plabel">${esc(b.c.priority)}</span>` : ""),
        title: `<span class="ctitle"><span>${b.title}</span>${b.qchip}</span>`, body: b.card });
      if (i < built.length - 1) h += seg("", "no" + gseg(i));
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
    areaMap = new maplibregl.Map({ container: el, style: window.GS.mapStyle(true), center: [G0.lng, G0.lat], zoom: 11, cooperativeGestures: true, attributionControl: { compact: true } });
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
      const m = new maplibregl.Map({ container: el, style: window.GS.mapStyle(true), center: [G0.lng, G0.lat], zoom: 10, interactive: false, attributionControl: false });
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
      if ("ResizeObserver" in window) { let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(fit, 120); }).observe(el); }
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
      const m = dlg._map = new maplibregl.Map({ container: holder, style: window.GS.mapStyle(true), center: [G0.lng, G0.lat], zoom: 10, attributionControl: { compact: true } });
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
  // offer day itself, not "last day to change your application in time for offer day"
  const isOfferDay = e => /offer day|national allocation day|offers? (are )?(sent|emailed|made|released)/i.test(e) && !/in time for|before|change|deadline|last day|by offer/i.test(e);
  const offerDay = (y.key_dates || []).find(k => /national offer day/i.test(k.event) && isOfferDay(k.event)) || (y.key_dates || []).find(k => isOfferDay(k.event));
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
        ["To", esc(y.distance?.to || "")], ["Measured by", esc(y.distance?.system || "")], ["Home address", esc(y.distance?.home_address_rule || "")], ["Address date", addressLine().replace(/^<div class="addr"><b>Address date:<\/b> /, "").replace(/<\/div>$/, "")]]))}
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
      // a card whose own area condition you meet (or don't) says so loudly
      out.querySelectorAll(".stop.crit").forEach(li => {
        li.classList.remove("for-you", "not-you");
        const old = li.querySelector(".youbanner"); if (old) old.remove();
        if (!r) return;
        const tops = [...li.querySelectorAll('.you[data-top]')];
        // an area that is one side of an "or" settles it when you're inside; outside, the other route may still apply
        const orYes = [...li.querySelectorAll('.you[data-or]')].some(t => t.classList.contains("yes"));
        const topsKnown = tops.length && tops.every(t => t.classList.contains("yes") || t.classList.contains("no"));
        const areaNo = topsKnown && tops.some(t => t.classList.contains("no"));
        const areaKnown = topsKnown || (orYes && !tops.length);
        const far = li.dataset.far ? +li.dataset.far : null;
        let cls = "", txt = "";
        if (areaNo) { cls = "not-you"; txt = `✗ Not for you: ${home_pc} is outside this area`; }
        else if (far != null && !home_place) {
          // a guess from last year's furthest offer (straight line from the school)
          const d = r.miles.toFixed(2) + " mi (straight line)";
          if (r.miles <= far) { cls = "for-you"; txt = `${areaKnown ? "✓ You're in this area, and" : "✓"} ${d} from ${home_pc}: closer than last year's furthest offer (${far} mi in ${li.dataset.faryr})`; }
          else { cls = "not-you"; txt = `${areaKnown ? "You're in this area, but" : "✗"} ${d} from ${home_pc}: further than last year's furthest offer (${far} mi in ${li.dataset.faryr})`; }
        } else if (areaKnown) { cls = "for-you"; txt = `✓ You're in this area (${home_pc})`; }
        if (!cls) return;
        li.classList.add(cls);
        const b = document.createElement("div"); b.className = "youbanner";
        b.textContent = txt;
        const main = li.querySelector(".main"); main.insertBefore(b, main.firstChild);
      });
    }
    let home_pc = "", home_place = false;
    function show(home) {
      const r = home ? G.assess(s._geo, home) : null;
      home_pc = home ? home.postcode : ""; home_place = !!(home && home.place);
      markStations(r);
      setAreaMapHome(home);
      const pcq = home ? "?pc=" + encodeURIComponent(home.postcode).replace(/%20/g, "+") : "";
      history.replaceState(null, "", location.pathname + pcq + location.hash);
      const back = out.querySelector(".crumbs a"); if (back) back.href = "../index.html" + pcq;
      if (r) {
        holder.innerHTML = `<div class="nm-res"><span class="nm-dist"><b>${r.miles.toFixed(1)} miles</b> from ${esc(home.postcode)}${home.place ? " town centre" : ""} <span class="muted small">(straight line${home.place ? "; enter a full postcode to check priority areas" : ""})</span></span>
          <span class="gchips">${G.statusChips(r, esc)}</span> <button type="button" class="linkbtn small" id="nm-change">Change postcode</button></div>`;
        holder.querySelector("#nm-change").onclick = () => show(null);
      } else {
        holder.innerHTML = `<form class="nm-form"><label for="nm-pc">How far are you from this school?</label>
          <input id="nm-pc" autocomplete="postal-code" placeholder="Postcode or town" value="${home ? esc(home.postcode) : ""}"><button class="btn-primary" type="submit">Check</button>
          <span class="small err" role="alert"></span></form>`;
        G.addLocateButton(holder.querySelector("#nm-pc"), holder.querySelector("form"), holder.querySelector(".err"));
        holder.querySelector("form").onsubmit = async e => {
          e.preventDefault(); const err = holder.querySelector(".err"); err.textContent = "";
          try { const h = await G.lookupPostcode(holder.querySelector("#nm-pc").value, [G0]); G.saveHome(h); show(h); } catch (x) { err.textContent = x.message; }
        };
      }
    }
    const pcParam = (new URLSearchParams(location.search).get("pc") || "").trim();
    const saved = G.loadHome();
    const same = (x, y) => String(x || "").replace(/\s/g, "").toUpperCase() === String(y || "").replace(/\s/g, "").toUpperCase();
    if (pcParam && !(saved && same(saved.postcode, pcParam))) {
      holder.innerHTML = `<div class="nm-res muted">Looking up ${esc(pcParam)}…</div>`;
      G.lookupPostcode(pcParam, [G0]).then(h => { G.saveHome(h); show(h); }).catch(() => show(null));
    } else show(saved);
  })();
})();
