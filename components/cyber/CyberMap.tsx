"use client";
import { useEffect, useRef } from "react";
import { feature, mesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import { cyberAttackIndicators, cyberHotspots } from "@/data/cyberMockData";

const topology = countriesAtlas as unknown as TopoJSON.Topology;
const countriesGeo = feature(topology, topology.objects.countries as TopoJSON.GeometryCollection);
function gn(o: { properties?: unknown } | null | undefined) {
  return ((o?.properties as { name?: string } | undefined)?.name ?? "").toLowerCase();
}
const filteredFeatures = countriesGeo.features.filter(f => {
  const n = gn(f); return n !== "antarctica" && n !== "fr. s. antarctic lands";
});
const bordersMesh = mesh(topology, topology.objects.countries as TopoJSON.GeometryCollection, (a, b) => a !== b);
const coastMesh = mesh(topology, topology.objects.countries as TopoJSON.GeometryCollection, (a, b) => a === b && gn(a) !== "antarctica" && gn(a) !== "fr. s. antarctic lands");

const LAT_MAX = 84, LAT_MIN = -56, LAT_SPAN = LAT_MAX - LAT_MIN;
const PAD_X = 0.04, PAD_Y = 0.04, ASPECT = 2.26;
const PI2 = Math.PI * 2;

function px(lng: number, pL: number, iW: number) { return pL + ((lng + 180) / 360) * iW; }
function py(lat: number, pT: number, iH: number) { return pT + ((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) / LAT_SPAN) * iH; }

function traceRing(ctx: CanvasRenderingContext2D, ring: number[][], pL: number, pT: number, iW: number, iH: number, close: boolean) {
  let prev: number | null = null;
  ring.forEach(([lng, lat], i) => {
    const x = px(lng, pL, iW), y = py(lat, pT, iH);
    if (i === 0 || (prev !== null && Math.abs(lng - prev) > 180)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    prev = lng;
  });
  if (close) ctx.closePath();
}
function drawGeo(ctx: CanvasRenderingContext2D, geo: GeoJSON.Geometry, pL: number, pT: number, iW: number, iH: number, close: boolean) {
  if (geo.type === "Polygon") (geo.coordinates as number[][][]).forEach(r => traceRing(ctx, r, pL, pT, iW, iH, close));
  else if (geo.type === "MultiPolygon") (geo.coordinates as number[][][][]).forEach(p => p.forEach(r => traceRing(ctx, r, pL, pT, iW, iH, close)));
  else if (geo.type === "LineString") traceRing(ctx, geo.coordinates as number[][], pL, pT, iW, iH, false);
  else if (geo.type === "MultiLineString") (geo.coordinates as number[][][]).forEach(r => traceRing(ctx, r, pL, pT, iW, iH, false));
  else if (geo.type === "GeometryCollection") (geo as GeoJSON.GeometryCollection).geometries.forEach(g => drawGeo(ctx, g, pL, pT, iW, iH, close));
}
function getVP(w: number, h: number) {
  const fX = w * PAD_X, fY = h * PAD_Y, fW = w - fX * 2, fH = h - fY * 2;
  let iW = fW, iH = fW / ASPECT;
  if (iH > fH) { iH = fH; iW = fH * ASPECT; }
  return { pL: fX + (fW - iW) / 2, pT: fY + (fH - iH) / 2, iW, iH };
}

/* ─── Static base map ─────────────────────────────────────────── */
function renderStatic(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const { pL, pT, iW, iH } = getVP(w, h);

  // Deep black background
  ctx.fillStyle = "#020406"; ctx.fillRect(0, 0, w, h);

  // Faint grid
  ctx.strokeStyle = "rgba(100,120,140,0.013)"; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 18; i++) { const x = pL + (iW / 18) * i; ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pT + iH); ctx.stroke(); }
  for (let j = 0; j <= 9; j++) { const y = pT + (iH / 9) * j; ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + iW, y); ctx.stroke(); }

  // Land — dark but readable
  ctx.beginPath();
  filteredFeatures.forEach(f => { if (f.geometry) drawGeo(ctx, f.geometry, pL, pT, iW, iH, true); });
  ctx.fillStyle = "#0b1018"; ctx.fill();

  // Coastlines
  ctx.beginPath(); drawGeo(ctx, coastMesh, pL, pT, iW, iH, false);
  ctx.strokeStyle = "rgba(140,160,180,0.08)"; ctx.lineWidth = 0.6; ctx.stroke();

  // Borders
  ctx.beginPath(); drawGeo(ctx, bordersMesh, pL, pT, iW, iH, false);
  ctx.strokeStyle = "rgba(120,140,160,0.04)"; ctx.lineWidth = 0.3; ctx.stroke();

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

  return c;
}

/* ─── Pre-compute source/target roles ─────────────────────────── */
const SRC_SET = new Set(cyberAttackIndicators.map(a => `${a.fromLat},${a.fromLng}`));
const TGT_SET = new Set(cyberAttackIndicators.map(a => `${a.toLat},${a.toLng}`));
const NODE_ROLES = cyberHotspots.map(hs => {
  const k = `${hs.lat},${hs.lng}`;
  const s = SRC_SET.has(k), t = TGT_SET.has(k);
  return s && t ? "both" : s ? "source" : t ? "target" : "standalone";
});

/* ─── Per-arc staggered timing ────────────────────────────────── */
const ARC_CFG = cyberAttackIndicators.map((_, i) => ({
  offset: i * 2.5,
  cycle: 10 + (i % 3) * 3,
}));

/* ─── Quadratic bezier point ──────────────────────────────────── */
function bezPt(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number): [number, number] {
  const i = 1 - t;
  return [i * i * x1 + 2 * i * t * cx + t * t * x2, i * i * y1 + 2 * i * t * cy + t * t * y2];
}

/* ─── Overlay color — phosphorescent green ────────────────────── */
const O = "50,240,120"; // hacker-green for all overlay strokes

export function CyberMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);
  const staticRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
    const { pL, pT, iW, iH } = getVP(W, H);
    if (!staticRef.current || staticRef.current.width !== Math.round(W * dpr))
      staticRef.current = renderStatic(Math.round(W * dpr), Math.round(H * dpr));

    /* ═══════════════════════════════════════════════════════════
       ARC RENDERING — elegant signal-travel comet effect
    ═══════════════════════════════════════════════════════════ */
    function drawArcs(sec: number) {
      if (!ctx) return;

      cyberAttackIndicators.forEach((atk, idx) => {
        const x1 = px(atk.fromLng, pL, iW), y1 = py(atk.fromLat, pT, iH);
        const x2 = px(atk.toLng, pL, iW), y2 = py(atk.toLat, pT, iH);
        const cpx = (x1 + x2) / 2, dy = Math.abs(y2 - y1);
        const cpy = Math.min(y1, y2) - Math.max(20, dy * 0.28);
        const cfg = ARC_CFG[idx];

        // 1. Faint continuous baseline path
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.strokeStyle = `rgba(${O},0.025)`; ctx.lineWidth = 0.5; ctx.stroke();

        const rawP = ((sec + cfg.offset) % cfg.cycle) / cfg.cycle;
        const activePhase = 0.5; // active travel phase takes 50% of cycle

        if (rawP < activePhase) {
          const headT = rawP / activePhase; // 0→1
          const trailLen = 0.25; // longer, smoother tail
          const tailT = Math.max(0, headT - trailLen);
          
          const SEGS = 24; // more segments for smoother curve
          for (let s = 0; s < SEGS; s++) {
            const t0 = tailT + (headT - tailT) * (s / SEGS);
            const t1 = tailT + (headT - tailT) * ((s + 1) / SEGS);
            const [sx, sy] = bezPt(x1, y1, cpx, cpy, x2, y2, t0);
            const [ex, ey] = bezPt(x1, y1, cpx, cpy, x2, y2, t1);
            
            // Cubic ease-in for tail opacity
            const prog = (s + 1) / SEGS; 
            const segAlpha = prog * prog * prog * 0.55;
            
            // Outer glow line
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            ctx.strokeStyle = `rgba(${O},${(segAlpha * 0.3).toFixed(3)})`;
            ctx.lineWidth = 1.8; ctx.stroke();
            
            // Inner core line
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            ctx.strokeStyle = `rgba(${O},${segAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }

          // Origin Activity Feedback (when signal just leaves)
          if (headT < 0.1) {
            const origP = headT / 0.1;
            const origR = 2 + origP * 6;
            const origA = (1 - origP) * 0.3;
            ctx.beginPath(); ctx.arc(x1, y1, origR, 0, PI2);
            ctx.strokeStyle = `rgba(${O},${origA.toFixed(3)})`;
            ctx.lineWidth = 0.4; ctx.stroke();
          }

          // Leading edge element (compact data head)
          const [hx, hy] = bezPt(x1, y1, cpx, cpy, x2, y2, headT);
          const lg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 2.5);
          lg.addColorStop(0, `rgba(${O},0.7)`);
          lg.addColorStop(1, `rgba(${O},0)`);
          ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, PI2); ctx.fillStyle = lg; ctx.fill();
          
          ctx.beginPath(); ctx.arc(hx, hy, 0.8, 0, PI2);
          ctx.fillStyle = `rgba(${O},0.95)`; ctx.fill();

          // Refined Impact Activity Feedback (when signal arrives)
          if (headT > 0.85) {
            const impP = (headT - 0.85) / 0.15; // 0→1
            
            // Inner impact ring
            const impR1 = 1 + impP * 4;
            const impA1 = (1 - impP) * 0.5;
            ctx.beginPath(); ctx.arc(x2, y2, impR1, 0, PI2);
            ctx.strokeStyle = `rgba(${O},${impA1.toFixed(3)})`;
            ctx.lineWidth = 0.6; ctx.stroke();

            // Outer dissipation ring
            const impR2 = 3 + impP * 8;
            const impA2 = (1 - impP) * 0.2;
            ctx.beginPath(); ctx.arc(x2, y2, impR2, 0, PI2);
            ctx.strokeStyle = `rgba(${O},${impA2.toFixed(3)})`;
            ctx.lineWidth = 0.3; ctx.stroke();
          }
        }
      });
    }

    /* ═══════════════════════════════════════════════════════════
       NODE / MARKER RENDERING — reference-style markers
       Source = outlined square □   Target = circle⊙
       Labels in small uppercase
    ═══════════════════════════════════════════════════════════ */
    function drawNodes(sec: number) {
      if (!ctx) return;

      ctx.textBaseline = "middle";

      cyberHotspots.forEach((hs, idx) => {
        const x = px(hs.lng, pL, iW), y = py(hs.lat, pT, iH);
        const role = NODE_ROLES[idx];

        // Elegant breathing halo for all nodes
        const phaseOffset = idx * 1.7;
        const pulseCycle = ((sec * 0.12 + phaseOffset) % 1); // very slow
        const pulseR = 1.5 + pulseCycle * 4.5;
        const pulseA = (1 - pulseCycle) * 0.18;
        
        ctx.beginPath(); ctx.arc(x, y, pulseR, 0, PI2);
        ctx.strokeStyle = `rgba(${O},${pulseA.toFixed(3)})`;
        ctx.lineWidth = 0.3; ctx.stroke();

        const s = hs.size === "large" ? 3 : hs.size === "medium" ? 2.2 : 1.5;

        if (role === "source") {
          // ── Source: Precision crosshair bracket ──
          ctx.beginPath();
          // Top left
          ctx.moveTo(x - s, y - s + 1); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + 1, y - s);
          // Top right
          ctx.moveTo(x + s - 1, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + 1);
          // Bottom left
          ctx.moveTo(x - s, y + s - 1); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s + 1, y + s);
          // Bottom right
          ctx.moveTo(x + s - 1, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + s - 1);
          ctx.strokeStyle = `rgba(${O},0.65)`; ctx.lineWidth = 0.45; ctx.stroke();
          
          // Inner dot
          ctx.beginPath(); ctx.arc(x, y, 0.6, 0, PI2);
          ctx.fillStyle = `rgba(${O},0.8)`; ctx.fill();

        } else if (role === "target" || role === "both") {
          // ── Target: Segmented reticle ──
          ctx.strokeStyle = `rgba(${O},0.55)`;
          ctx.lineWidth = 0.4;
          
          // 4-segment dashed ring
          for (let i = 0; i < 4; i++) {
            ctx.beginPath(); 
            ctx.arc(x, y, s, i * PI2 / 4 + 0.1, (i + 1) * PI2 / 4 - 0.1); 
            ctx.stroke();
          }
          
          // Inner core dot
          ctx.beginPath(); ctx.arc(x, y, 0.8, 0, PI2);
          ctx.fillStyle = `rgba(${O},0.85)`; ctx.fill();

        } else {
          // ── Standalone: Minimal locator point ──
          ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, PI2);
          ctx.strokeStyle = `rgba(${O},0.4)`; ctx.lineWidth = 0.35; ctx.stroke();
          
          ctx.beginPath(); ctx.arc(x, y, 0.5, 0, PI2);
          ctx.fillStyle = `rgba(${O},0.6)`; ctx.fill();
        }

      });
    }

    /* ── Render loop ───────────────────────────────────────────── */
    function frame() {
      tickRef.current++;
      const sec = tickRef.current / 60;
      if (!ctx || !canvas) return;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (staticRef.current) ctx.drawImage(staticRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      drawArcs(sec); drawNodes(sec);
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: "#020406" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
