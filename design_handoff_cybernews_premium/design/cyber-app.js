/* ───────────────────────── ECHIS · Cyber News ─────────────────────────
   Vanilla dashboard logic: animated d3 globe threat map, live clock, ticker,
   clickable news → context + globe focus, count-up + bar animations.
──────────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  /* ─────────────── DATA ─────────────── */
  const NEWS = [
    { id:"cn-1", headline:"Zero-Day Vulnerability Actively Exploited in Fortinet VPN Devices", source:"CISA", time:"45 min ago", summary:"CISA confirms active exploitation of CVE-2024-55591 affecting Fortinet FortiOS.", cat:"Vulnerability", sev:"CRITICAL", sevLvl:"crit", focus:[ -97, 38 ],
      ctx:{ country:"United States", entity:"Enterprise VPN Operators", incident:"Fortinet FortiOS Zero-Day Exploitation", vector:"VPN Exploitation / Initial Access", actor:"Unknown / Multiple Actors", asset:"Fortinet VPN Appliances", sector:"Enterprise Infrastructure", summary:"Active exploitation of Fortinet FortiOS is being reported across exposed enterprise VPN appliances. The activity may enable unauthorized access and follow-on intrusion attempts against vulnerable network edge systems.", first:"May 12, 2025 · 08:15 UTC", last:"May 12, 2025 · 21:45 UTC", conf:4, impact:4, confL:"High", impactL:"High" } },
    { id:"cn-2", headline:"RansomHub Claims Attack on Major European Manufacturing Firm", source:"BleepingComputer", time:"1 h ago", summary:"RansomHub adds new victim to leak site, claims data exfiltration and encryption.", cat:"Ransomware", sev:"HIGH", sevLvl:"high", focus:[ 10, 51 ],
      ctx:{ country:"Germany", entity:"European Manufacturing Firm", incident:"RansomHub Data Exfiltration Claim", vector:"Ransomware / Data Exfiltration", actor:"RansomHub", asset:"Corporate File Systems / Business Data", sector:"Manufacturing", summary:"RansomHub has claimed responsibility for an intrusion affecting a European manufacturing organization. The claim references data exfiltration and encryption pressure, suggesting a double-extortion ransomware pattern.", first:"May 12, 2025 · 09:40 UTC", last:"May 12, 2025 · 22:10 UTC", conf:3, impact:4, confL:"Medium", impactL:"High" } },
    { id:"cn-3", headline:"APT41 Expands Targeting to Global Telecommunications Sector", source:"Recorded Future", time:"2 h ago", summary:"New campaign observed targeting telecom providers in Asia and the Middle East.", cat:"APT", sev:"HIGH", sevLvl:"high", focus:[ 110, 5 ],
      ctx:{ country:"Southeast Asia", entity:"Regional Telecom Providers", incident:"APT41 Telecom Targeting Expansion", vector:"Espionage / Long-Term Access", actor:"APT41", asset:"Telecom Infrastructure / Partner Networks", sector:"Telecommunications", summary:"Reporting indicates expanded APT41 targeting of telecom providers and partner ecosystems across Asia and the Middle East. The activity suggests long-term access objectives and infrastructure mapping.", first:"May 12, 2025 · 11:10 UTC", last:"May 12, 2025 · 20:30 UTC", conf:4, impact:3, confL:"High", impactL:"Medium" } },
    { id:"cn-4", headline:"Malicious NPM Packages Targeting Crypto Developers Discovered", source:"Sekoia", time:"3 h ago", summary:"Multiple malicious packages found stealing wallet credentials and API keys.", cat:"Malware", sev:"MEDIUM", sevLvl:"med", focus:[ 8, 25 ],
      ctx:{ country:"Global", entity:"Crypto Developer Community", incident:"Malicious NPM Package Campaign", vector:"Supply Chain / Malicious Package", actor:"Unknown", asset:"Developer Workstations / Wallet Credentials", sector:"Software / Crypto", summary:"Malicious NPM packages were observed targeting crypto developers with credential and wallet theft behavior. The activity highlights ongoing supply-chain risk in open-source package ecosystems.", first:"May 12, 2025 · 13:25 UTC", last:"May 12, 2025 · 19:05 UTC", conf:3, impact:3, confL:"Medium", impactL:"Medium" } },
    { id:"cn-5", headline:"Microsoft Patches Actively Exploited Windows Privilege Escalation Flaw", source:"Microsoft MSRC", time:"4 h ago", summary:"Patch addresses an elevation-of-privilege vulnerability in Windows Win32k.", cat:"Vulnerability", sev:"HIGH", sevLvl:"high", focus:[ -100, 40 ],
      ctx:{ country:"Global", entity:"Windows Enterprise Environments", incident:"Windows Privilege Escalation Patch Advisory", vector:"Privilege Escalation", actor:"Unknown / Opportunistic Actors", asset:"Windows Endpoints / Win32k Component", sector:"Enterprise IT", summary:"Microsoft has issued a patch for an actively exploited Windows privilege escalation vulnerability. Successful exploitation may support post-compromise elevation and persistence activity.", first:"May 12, 2025 · 14:00 UTC", last:"May 12, 2025 · 18:45 UTC", conf:4, impact:3, confL:"High", impactL:"Medium" } },
  ];

  const HOTSPOTS = [
    { lng:13.40,lat:52.52,sev:"crit",sz:5 },{ lng:2.35,lat:48.86,sev:"high",sz:5 },{ lng:37.62,lat:55.75,sev:"med",sz:4 },
    { lng:116.40,lat:39.90,sev:"high",sz:4 },{ lng:32.85,lat:39.92,sev:"low",sz:4 },{ lng:55.30,lat:25.27,sev:"low",sz:3 },
    { lng:103.82,lat:1.35,sev:"high",sz:3 },{ lng:-0.13,lat:51.51,sev:"low",sz:3 },{ lng:-74.01,lat:40.71,sev:"med",sz:3 },
    { lng:51.39,lat:35.68,sev:"high",sz:3 },{ lng:126.98,lat:37.57,sev:"low",sz:3 },{ lng:46.68,lat:24.71,sev:"crit",sz:3 },
    { lng:151.21,lat:-33.87,sev:"high",sz:3 },{ lng:-46.63,lat:-23.55,sev:"crit",sz:3 },{ lng:3.38,lat:6.52,sev:"high",sz:3 },
    { lng:139.69,lat:35.68,sev:"med",sz:4 },{ lng:100.50,lat:13.76,sev:"low",sz:3 },{ lng:77.21,lat:28.61,sev:"high",sz:4 },
  ];

  const ARCS = [
    [55.75,37.62, 52.52,13.40,"crit"],[39.90,116.40, 1.35,103.82,"high"],[35.68,51.39, 39.92,32.85,"med"],
    [55.75,37.62, 48.86,2.35,"crit"],[39.90,116.40, 25.27,55.30,"med"],[40.71,-74.01, 51.51,-0.13,"low"],
    [39.90,116.40, -33.87,151.21,"high"],[55.75,37.62, -23.55,-46.63,"crit"],[35.68,51.39, 6.52,3.38,"high"],
    [40.71,-74.01, 35.68,139.69,"med"],[39.90,116.40, 13.76,100.50,"low"],[55.75,37.62, 28.61,77.21,"high"],
    [39.90,116.40, 37.57,126.98,"med"],[35.68,51.39, 24.71,46.68,"high"],
  ];

  const REGIONS = [
    { region:"Europe", count:1235, change:18.6 },{ region:"Southeast Asia", count:987, change:12.4 },
    { region:"Middle East", count:754, change:9.7 },{ region:"North America", count:642, change:-2.1 },
    { region:"East Asia", count:531, change:6.3 },{ region:"South Asia", count:412, change:3.3 },
  ];

  const SECTORS = [
    { label:"Energy", pct:92, tag:"Critical", cls:"crit" },{ label:"Telecommunications", pct:84, tag:"High", cls:"high" },
    { label:"Finance", pct:76, tag:"High", cls:"high" },{ label:"Government", pct:63, tag:"Elevated", cls:"elev" },
    { label:"Manufacturing", pct:58, tag:"Elevated", cls:"elev" },
  ];

  /* ─────────────── THEME (reads CSS vars, updated by tweaks) ─────────────── */
  const THEME = { glow:true };
  function refreshTheme() {
    const cs = getComputedStyle(document.documentElement);
    THEME.accent  = cs.getPropertyValue("--accent").trim() || "#ff2b3d";
    THEME.accent2 = cs.getPropertyValue("--accent-2").trim() || "#b3121f";
    THEME.glow = document.documentElement.getAttribute("data-glow") !== "off";
  }
  window.__cyberRefreshTheme = refreshTheme;

  // Severity heat ramp — clearly stepped hues so tiers never blur together
  const SEV = {
    crit: { col: "#ff3b42", core: "#ffd2d4", glow: "rgba(255,59,66,0.9)" },
    high: { col: "#ff7a2f", core: "#ffd9b8", glow: "rgba(255,122,47,0.8)" },
    med:  { col: "#f1c24f", core: "#fff0c2", glow: "rgba(241,194,79,0.7)" },
    low:  { col: "#9aa3b2", core: "#e6e9ee", glow: "rgba(154,163,178,0.5)" },
  };

  /* ─────────────── helpers ─────────────── */
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  function countUp(node, target, dur, fmt) {
    const start = performance.now(); const from = 0;
    fmt = fmt || ((v) => Math.round(v).toLocaleString("en-US"));
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      node.textContent = fmt(from + (target - from) * e);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ─────────────── CLOCK ─────────────── */
  const clock = $("#clock");
  function tick() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clock.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  tick(); setInterval(tick, 1000);

  /* ─────────────── THREAT BARS (header) ─────────────── */
  const bars = $("#threatBars");
  const heights = [6, 9, 13, 8, 11];
  heights.forEach((h) => { const i = el("i"); i.style.height = h + "px"; i.style.opacity = 0.55 + (h / 13) * 0.45; bars.appendChild(i); });

  /* ─────────────── TICKER ─────────────── */
  const tickerTrack = $("#tickerTrack");
  const tickItems = NEWS.concat(NEWS).map((n) =>
    `<span class="ticker-item"><span class="tk-sev" style="background:${SEV[n.sevLvl].col};box-shadow:0 0 6px ${SEV[n.sevLvl].glow}"></span><b>${n.source}</b> ${n.summary} <span class="tk-time">${n.time}</span></span>`
  ).join('<span style="color:var(--t-6)">•</span>');
  tickerTrack.innerHTML = tickItems;

  /* ─────────────── REGIONS ─────────────── */
  const regionList = $("#regionList");
  const max = Math.max(...REGIONS.map((r) => r.count));
  REGIONS.forEach((r, i) => {
    const row = el("div", "rankrow");
    row.innerHTML =
      `<span class="rank-n">${i + 1}</span>` +
      `<div class="rank-mid"><div class="rank-label">${r.region}</div>` +
      `<div class="rank-track"><div class="rank-fill" style="width:${(r.count / max * 100).toFixed(1)}%"></div></div></div>` +
      `<div class="rank-right"><span class="rank-val">${r.count.toLocaleString("en-US")}</span>` +
      `<span class="rank-delta ${r.change >= 0 ? "delta-up" : "delta-down"}">${r.change >= 0 ? "+" : "−"}${Math.abs(r.change)}%</span></div>`;
    regionList.appendChild(row);
    setTimeout(() => countUp(row.querySelector(".rank-val"), r.count, 1000), 120 + i * 70);
  });

  /* ─────────────── SECTORS ─────────────── */
  const sectorList = $("#sectorList");
  SECTORS.forEach((s, i) => {
    const sec = el("div", "sector");
    sec.innerHTML =
      `<div class="sec-top"><span class="sec-label">${s.label}</span>` +
      `<div class="sec-right"><span class="sec-tag tag-${s.cls}">${s.tag}</span><span class="sec-pct">${s.pct}%</span></div></div>` +
      `<div class="sec-track"><div class="sec-fill fill-${s.cls}" style="width:${s.pct}%"></div></div>`;
    sectorList.appendChild(sec);
  });

  /* ─────────────── NEWS FEED ─────────────── */
  const feed = $("#feed");
  const catClass = { Vulnerability:"b-vuln", Ransomware:"b-ransom", APT:"b-apt", Malware:"b-malw", Patch:"b-elev" };
  let selected = NEWS[0].id;
  NEWS.forEach((n) => {
    const card = el("div", "newscard" + (n.id === selected ? " sel" : ""));
    card.dataset.id = n.id;
    card.innerHTML =
      `<div class="nc-title">${n.headline}</div>` +
      `<div class="nc-meta"><span class="nc-src">${n.source}</span><span class="nc-dot"></span><span class="nc-time">${n.time}</span></div>` +
      `<div class="nc-sum">${n.summary}</div>` +
      `<div class="nc-badges"><span class="badge ${catClass[n.cat] || "b-elev"}">${n.cat}</span><span class="badge b-${n.sevLvl}">${n.sev}</span></div>`;
    card.addEventListener("click", () => select(n.id));
    feed.appendChild(card);
  });

  /* ─────────────── CONTEXT ─────────────── */
  const context = $("#context");
  const ICON = {
    country:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/>',
    entity:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    incident:'<path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7Z"/>',
    vector:'<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>',
    actor:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    asset:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sector:'<path d="M3 21h18M5 21V8l7-5 7 5v13"/>',
    summary:'<path d="M4 4h16v16H4ZM8 8h8M8 12h8M8 16h5"/>',
  };
  function ctxRow(icon, label, val, body) {
    return `<div class="ctx-row"><div class="ctx-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg>${label}</div><div class="ctx-val${body ? " body" : ""}">${val}</div></div>`;
  }
  function pips(level, kind) {
    let row = "";
    for (let i = 0; i < 5; i++) row += `<span class="pip${i < level ? " on-" + kind : ""}"></span>`;
    return `<div class="pip-row">${row}</div>`;
  }
  function renderContext(n) {
    const c = n.ctx;
    context.innerHTML =
      ctxRow("country", "Country / Region", c.country) +
      ctxRow("entity", "Affected Entity", c.entity) +
      ctxRow("incident", "Hack Incident", c.incident) +
      ctxRow("vector", "Attack Type / Vector", c.vector) +
      ctxRow("actor", "Threat Actor / Group", c.actor) +
      ctxRow("asset", "Target / Asset", c.asset) +
      ctxRow("sector", "Target Sector", c.sector) +
      ctxRow("summary", "Summary", c.summary, true) +
      `<div class="ctx-foot">` +
        `<div class="ctx-pair"><span class="ctx-k">First Seen</span><span class="ctx-v">${c.first}</span></div>` +
        `<div class="ctx-pair"><span class="ctx-k">Last Update</span><span class="ctx-v">${c.last}</span></div>` +
        `<div class="ctx-pair"><span class="ctx-k">Confidence</span><div class="pips">${pips(c.conf, "silver")}<span class="pip-lbl" style="color:var(--silver)">${c.confL}</span></div></div>` +
        `<div class="ctx-pair"><span class="ctx-k">Impact</span><div class="pips">${pips(c.impact, "crit")}<span class="pip-lbl" style="color:var(--crit)">${c.impactL}</span></div></div>` +
      `</div>`;
    context.classList.remove("ctx-fade"); void context.offsetWidth; context.classList.add("ctx-fade");
    $("#ctxSrc").textContent = n.source;
  }

  function select(id) {
    if (id === selected) return;
    selected = id;
    document.querySelectorAll(".newscard").forEach((c) => c.classList.toggle("sel", c.dataset.id === id));
    const n = NEWS.find((x) => x.id === id);
    renderContext(n);
    focusGlobe(n.focus[0], n.focus[1]);
  }
  renderContext(NEWS[0]);

  /* ═══════════════════════ FLAT WORLD MAP ═══════════════════════ */
  const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  const canvas = $("#globe");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const projection = d3.geoNaturalEarth1();
  // visible band — drops Antarctica (lat < -56) so the map reads cleaner
  const MAP_CLIP = { type: "Polygon", coordinates: [[[-180, 83], [180, 83], [180, -56], [-180, -56], [-180, 83]]] };
  const path = d3.geoPath(projection, ctx);
  const graticule = d3.geoGraticule10();
  let land = null, borders = null;

  // Each arc keeps its endpoints + a travelling phase. Drawn as a screen-space
  // quadratic bezier so it never breaks across the antimeridian.
  const arcState = ARCS.map((a) => ({
    fromLng: a[1], fromLat: a[0], toLng: a[3], toLat: a[2],
    sev: a[4], p: Math.random(), speed: 0.0013 + Math.random() * 0.0012,
  }));

  let focusState = null;   // { lng, lat, start }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit the Antarctica-trimmed world into the panel, centred and proportional.
    projection.clipExtent(null);
    projection.fitExtent([[14, 12], [W - 14, H - 12]], MAP_CLIP);
    const b = path.bounds(MAP_CLIP);
    projection.clipExtent([[b[0][0] - 1, b[0][1] - 1], [b[1][0] + 1, b[1][1] + 1]]);
  }
  new ResizeObserver(() => { resize(); renderFrame(); }).observe(canvas);
  resize();

  fetch(WORLD_URL).then((r) => r.json()).then((topo) => {
    const c = topo.objects.countries;
    land = topojson.merge(topo, c.geometries);
    borders = topojson.mesh(topo, c);
    renderFrame();
  }).catch(() => {});

  function focusGlobe(lng, lat) {                 // highlight target on the flat map
    focusState = { lng, lat, start: performance.now() };
  }

  function bez(p0, c, p1, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
  }

  function drawArc(a) {
    const t = a.p;
    if (t < 0 || t > 1) return;          // render only in flight — no pre-drawn track
    const p0 = projection([a.fromLng, a.fromLat]);
    const p1 = projection([a.toLng, a.toLat]);
    if (!p0 || !p1) return;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    // perpendicular, biased upward → graceful overhead arc
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const lift = Math.min(len * 0.32, 130);
    const c = [(p0[0] + p1[0]) / 2 + nx * lift, (p0[1] + p1[1]) / 2 + ny * lift];
    const s = SEV[a.sev];

    // comet trail — a self-drawing streak whose tail fades to nothing
    const trail = 0.24;
    const tStart = Math.max(0, t - trail);
    const SEG = 20;
    ctx.lineCap = "round";
    let prev = bez(p0, c, p1, tStart);
    for (let i = 1; i <= SEG; i++) {
      const tt = tStart + (t - tStart) * (i / SEG);
      const pt = bez(p0, c, p1, tt);
      const f = i / SEG;                 // 0 = tail, 1 = head
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]);
      ctx.strokeStyle = s.col;
      ctx.globalAlpha = Math.pow(f, 1.7) * 0.92;
      ctx.lineWidth = 0.5 + f * 1.7;
      ctx.stroke();
      prev = pt;
    }
    ctx.globalAlpha = 1;

    // glowing comet head
    const hp = bez(p0, c, p1, t);
    if (THEME.glow) { ctx.shadowBlur = 11; ctx.shadowColor = s.glow; }
    ctx.beginPath(); ctx.arc(hp[0], hp[1], 1.7, 0, 7); ctx.fillStyle = s.core; ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* Refined marker spec — size + hue both step with severity so the hierarchy is
     unmistakable. Only the high-priority tiers emit a radar ping. */
  const MK = {
    crit: { ...SEV.crit, r: 3.0, ping: true,  spec: true },
    high: { ...SEV.high, r: 2.5, ping: true,  spec: true },
    med:  { ...SEV.med,  r: 2.1, ping: false, spec: true },
    low:  { ...SEV.low,  r: 1.8, ping: false, spec: false },
  };

  function drawHotspot(h, now) {
    const xy = projection([h.lng, h.lat]); if (!xy) return;
    const m = MK[h.sev] || MK.low;
    const x = xy[0], y = xy[1];
    const r = m.r + (h.sz - 3) * 0.18;   // gentle per-spot variance, still tier-consistent

    // radar ping — staggered, smooth, crit/high only
    if (m.ping) {
      const seed = (h.lng * 0.013 + h.lat * 0.019 + 10) % 1;
      for (let k = 0; k < 2; k++) {
        const t = ((now / 2800) + seed + k * 0.5) % 1;
        const ease = 1 - Math.pow(1 - t, 2);
        ctx.beginPath(); ctx.arc(x, y, r + 1 + ease * 15, 0, 7);
        ctx.strokeStyle = m.col; ctx.globalAlpha = 0.45 * (1 - t); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // soft glow halo (radial — softer & more luxe than a hard shadow)
    if (THEME.glow) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
      g.addColorStop(0, m.glow); g.addColorStop(0.6, m.glow.replace(/[\d.]+\)$/, "0.10)")); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
    }

    // gem core — lit from top-left
    const cg = ctx.createRadialGradient(x - r * 0.38, y - r * 0.38, r * 0.1, x, y, r);
    cg.addColorStop(0, m.core); cg.addColorStop(1, m.col);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = cg; ctx.fill();

    // crisp bezel ring
    ctx.beginPath(); ctx.arc(x, y, r + 0.6, 0, 7);
    ctx.lineWidth = 0.6; ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.stroke();

    // specular highlight
    if (m.spec) {
      ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.34, r * 0.26, 0, 7);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fill();
    }
  }

  let pulse = 0;

  function step() {
    for (const a of arcState) { a.p += a.speed; if (a.p > 1.14) a.p = -0.14; }
    pulse += 0.045;
  }

  function renderFrame() {
    ctx.clearRect(0, 0, W, H);

    // graticule (very faint)
    ctx.beginPath(); path(graticule);
    ctx.lineWidth = 0.5; ctx.strokeStyle = "rgba(255,72,84,0.04)"; ctx.stroke();

    // land + borders
    if (land) { ctx.beginPath(); path(land); ctx.fillStyle = "#221a1e"; ctx.fill(); }
    if (borders) { ctx.beginPath(); path(borders); ctx.lineWidth = 0.55; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(255,72,84,0.40)"; ctx.stroke(); }

    // arcs
    for (const a of arcState) drawArc(a);

    // hotspots
    const now = performance.now();
    for (const h of HOTSPOTS) drawHotspot(h, now);

    // focus marker (selected news location)
    if (focusState) {
      const el = (performance.now() - focusState.start) / 1700;
      if (el >= 1) { focusState = null; }
      else {
        const xy = projection([focusState.lng, focusState.lat]);
        if (xy) {
          const ease = 1 - Math.pow(1 - el, 3);
          const rad = 6 + ease * 22;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], rad, 0, 7);
          ctx.strokeStyle = THEME.accent || "#ff2b3d"; ctx.globalAlpha = 0.7 * (1 - el); ctx.lineWidth = 1.4; ctx.stroke();
          // crosshair
          ctx.globalAlpha = 0.85 * (1 - el * 0.6); ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xy[0] - 11, xy[1]); ctx.lineTo(xy[0] + 11, xy[1]);
          ctx.moveTo(xy[0], xy[1] - 11); ctx.lineTo(xy[0], xy[1] + 11);
          ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    }
  }

  function loop() {
    step();
    renderFrame();
    requestAnimationFrame(loop);
  }

  refreshTheme();
  $("#statArcs").textContent = ARCS.length;
  $("#statHot").textContent = HOTSPOTS.length;
  renderFrame();                 // static first frame (visible even when rAF is paused)
  requestAnimationFrame(loop);   // continuous animation when foregrounded

  // expose for tweaks
  window.CYBER = { refreshTheme, focusGlobe };
})();
