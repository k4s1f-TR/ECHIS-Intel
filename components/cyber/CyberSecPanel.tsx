"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Shield, ExternalLink, TrendingUp, TrendingDown, Activity, AlertTriangle, Globe } from "lucide-react";
import { feature, mesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import {
  cyberFeedItems,
  cyberIntelItems,
  cyberAttackIndicators,
  cyberHotspots,
  cyberRegionMentions,
  type CyberFeedItem,
  type CyberIntelItem,
  type CyberRegionMention,
} from "@/data/cyberMockData";

/* ─── Disciplined color system ───────────────────────────────── */
const GREEN = {
  accent: "rgba(34,197,94,0.9)",
  dim: "rgba(34,197,94,0.45)",
  glow: "rgba(34,197,94,0.12)",
  text: "rgba(74,222,128,0.95)",
  muted: "rgba(34,197,94,0.35)",
  border: "rgba(34,197,94,0.18)",
};

/* Tier-based palette: green → amber → restrained red */
const TIER = {
  low:      { core: "#1a6b3a", ring: "rgba(34,197,94,0.12)", arc: "rgba(34,197,94,0.08)" },
  active:   { core: "#22c55e", ring: "rgba(34,197,94,0.22)", arc: "rgba(34,197,94,0.14)" },
  critical: { core: "#d4a053", ring: "rgba(212,160,83,0.18)", arc: "rgba(212,160,83,0.12)" },
} as const;

const SEV_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "rgba(239,68,68,0.95)", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.35)" },
  high: { text: "rgba(249,115,22,0.95)", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.35)" },
  medium: { text: "rgba(234,179,8,0.95)", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.35)" },
  low: { text: "rgba(140,140,140,0.9)", bg: "rgba(100,100,100,0.08)", border: "rgba(100,100,100,0.25)" },
};

/* ─── TopoJSON world map ─────────────────────────────────────── */
const topology = countriesAtlas as unknown as TopoJSON.Topology;
const countriesGeo = feature(topology, topology.objects.countries as TopoJSON.GeometryCollection);
const bordersMesh = mesh(topology, topology.objects.countries as TopoJSON.GeometryCollection, (a, b) => a !== b);
const coastlineMesh = mesh(topology, topology.objects.countries as TopoJSON.GeometryCollection, (a, b) => a === b);

function projX(lng: number, w: number) { return ((lng + 180) / 360) * w; }
function projY(lat: number, h: number) { return ((90 - lat) / 180) * h; }

function traceRing(ctx: CanvasRenderingContext2D, ring: number[][], w: number, h: number, close: boolean) {
  let prevLng: number | null = null;
  ring.forEach(([lng, lat], i) => {
    const x = projX(lng, w);
    const y = projY(lat, h);
    const wrap = prevLng !== null && Math.abs(lng - prevLng) > 180;
    if (i === 0 || wrap) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    prevLng = lng;
  });
  if (close) ctx.closePath();
}

function drawGeo(ctx: CanvasRenderingContext2D, geo: GeoJSON.Geometry, w: number, h: number, close: boolean) {
  switch (geo.type) {
    case "Polygon":
      (geo.coordinates as number[][][]).forEach(r => traceRing(ctx, r, w, h, close));
      break;
    case "MultiPolygon":
      (geo.coordinates as number[][][][]).forEach(p => p.forEach(r => traceRing(ctx, r, w, h, close)));
      break;
    case "LineString":
      traceRing(ctx, geo.coordinates as number[][], w, h, false);
      break;
    case "MultiLineString":
      (geo.coordinates as number[][][]).forEach(r => traceRing(ctx, r, w, h, false));
      break;
    case "GeometryCollection":
      (geo as GeoJSON.GeometryCollection).geometries.forEach(g => drawGeo(ctx, g, w, h, close));
      break;
    default: break;
  }
}

function renderStaticMap(w: number, h: number): HTMLCanvasElement {
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d")!;

  ctx.fillStyle = "#060a0f";
  ctx.fillRect(0, 0, w, h);

  // Very faint coordinate grid
  ctx.strokeStyle = "rgba(34,197,94,0.02)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += w / 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += h / 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Country fills
  ctx.beginPath();
  countriesGeo.features.forEach(f => { if (f.geometry) drawGeo(ctx, f.geometry, w, h, true); });
  ctx.fillStyle = "#181e24";
  ctx.fill();

  // Coastline
  ctx.beginPath();
  drawGeo(ctx, coastlineMesh, w, h, false);
  ctx.strokeStyle = "rgba(200,210,200,0.12)";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Country borders
  ctx.beginPath();
  drawGeo(ctx, bordersMesh, w, h, false);
  ctx.strokeStyle = "rgba(180,195,185,0.09)";
  ctx.lineWidth = 0.4;
  ctx.stroke();

  return offscreen;
}

function CyberMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);
  const staticMapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    if (!staticMapRef.current || staticMapRef.current.width !== Math.round(W * dpr)) {
      staticMapRef.current = renderStaticMap(Math.round(W * dpr), Math.round(H * dpr));
    }

    /* ── Hotspot markers (3-tier hierarchy) ─────────────────── */
    function drawHotspots(tick: number) {
      if (!ctx) return;
      const t = tick * 0.012; // slow time factor

      cyberHotspots.forEach((hs) => {
        const x = projX(hs.lng, W);
        const y = projY(hs.lat, H);
        const tier = TIER[hs.tier];

        if (hs.tier === "low") {
          // Tier A: tiny dim point, no animation
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = tier.core + "88";
          ctx.fill();
        } else if (hs.tier === "active") {
          // Tier B: core dot + subtle static ring
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = tier.core;
          ctx.fill();
          // Thin ring
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = tier.ring;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        } else {
          // Tier C (critical): core dot + inner ring + slow expanding pulse ring
          const pulse = 0.5 + 0.5 * Math.sin(t + parseInt(hs.id.split("-")[1]) * 1.7);

          // Outer expanding ring (very slow, very subtle)
          const outerR = 7 + pulse * 5;
          ctx.beginPath();
          ctx.arc(x, y, outerR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212,160,83,${0.06 + pulse * 0.06})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Inner ring
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(212,160,83,0.25)";
          ctx.lineWidth = 0.7;
          ctx.stroke();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = tier.core;
          ctx.fill();
        }
      });
    }

    /* ── Arcs (restrained signal routes) ────────────────────── */
    function drawArcs(tick: number) {
      if (!ctx) return;
      const t = tick * 0.004; // very slow travel speed

      cyberAttackIndicators.forEach((atk, idx) => {
        const x1 = projX(atk.fromLng, W);
        const y1 = projY(atk.fromLat, H);
        const x2 = projX(atk.toLng, W);
        const y2 = projY(atk.toLat, H);
        const tier = TIER[atk.tier];

        // Arc path
        const cpx = (x1 + x2) / 2;
        const dy = Math.abs(y2 - y1);
        const cpy = Math.min(y1, y2) - Math.max(18, dy * 0.25);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.strokeStyle = tier.arc;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Slow traveling signal dot (one per arc, not fast)
        const progress = ((t + idx * 0.37) % 1);
        const tt = progress;
        const invT = 1 - tt;
        const sx = invT * invT * x1 + 2 * invT * tt * cpx + tt * tt * x2;
        const sy = invT * invT * y1 + 2 * invT * tt * cpy + tt * tt * y2;

        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = atk.tier === "critical" ? "rgba(212,160,83,0.7)" : "rgba(34,197,94,0.55)";
        ctx.fill();
      });
    }

    function frame() {
      tickRef.current++;
      if (!ctx || !canvas) return;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (staticMapRef.current) {
        ctx.drawImage(staticMapRef.current, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();

      drawArcs(tickRef.current);
      drawHotspots(tickRef.current);
      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const activeCount = cyberHotspots.filter(h => h.tier === "active" || h.tier === "critical").length;
  const criticalCount = cyberHotspots.filter(h => h.tier === "critical").length;

  return (
    <div className="relative w-full h-full" style={{ background: "#060a0f" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Title */}
      <div className="absolute top-3 left-4 flex items-center gap-2" style={{ pointerEvents: "none" }}>
        <Globe size={12} style={{ color: "rgba(34,197,94,0.3)" }} />
        <span style={{ fontSize: "9px", fontWeight: 600, color: "rgba(34,197,94,0.28)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Threat Map
        </span>
      </div>
      {/* Compact stats */}
      <div className="absolute top-3 right-4 flex items-center gap-4" style={{ pointerEvents: "none" }}>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(34,197,94,0.6)" }} />
          <span style={{ fontSize: "9px", color: "rgba(160,175,165,0.6)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {activeCount} nodes
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(212,160,83,0.6)" }} />
          <span style={{ fontSize: "9px", color: "rgba(160,175,165,0.6)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {criticalCount} elevated
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Severity Badge ─────────────────────────────────────────── */
function SevBadge({ severity }: { severity: string }) {
  const s = SEV_COLORS[severity] ?? SEV_COLORS.low;
  return (
    <span
      className="px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ fontSize: "8px", fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, flexShrink: 0 }}
    >
      {severity}
    </span>
  );
}

/* ─── Left Feed Panel ────────────────────────────────────────── */
function LeftFeedPanel() {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "rgba(8,10,14,0.98)",
        border: `1px solid ${GREEN.border}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid rgba(34,197,94,0.08)` }}
      >
        <div className="flex items-center gap-2">
          <Shield size={12} style={{ color: GREEN.dim }} />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(155,170,180,0.88)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Cyber Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN.accent, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "9px", color: GREEN.muted, fontWeight: 600 }}>LIVE</span>
        </div>
      </div>
      {/* Feed list */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: `${GREEN.muted} transparent` }}
      >
        {cyberFeedItems.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: CyberFeedItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.015)",
        border: hovered ? `1px solid rgba(34,197,94,0.15)` : "1px solid rgba(255,255,255,0.04)",
        borderRadius: "6px",
        padding: "8px 10px 8px 12px",
        marginBottom: "4px",
        transition: "all 120ms ease",
      }}
    >
      {/* Severity accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{ background: SEV_COLORS[item.severity]?.text ?? "#555", opacity: 0.5, borderRadius: "6px 0 0 6px" }}
      />
      {/* Title */}
      <p className="line-clamp-2 leading-snug mb-1.5"
        style={{ fontSize: "11px", fontWeight: 500, color: hovered ? "rgba(210,230,220,0.95)" : "rgba(180,200,210,0.82)" }}
      >
        {item.title}
      </p>
      {/* Meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "9px", color: "rgba(90,100,110,0.85)" }}>{item.time}</span>
          <span style={{ fontSize: "9px", color: "rgba(70,80,90,0.7)" }}>·</span>
          <span style={{ fontSize: "9px", color: "rgba(100,110,120,0.8)" }}>{item.source}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontSize: "8px", fontWeight: 600, color: GREEN.text, background: GREEN.glow, border: `1px solid ${GREEN.border}` }}
          >
            {item.tag}
          </span>
          <SevBadge severity={item.severity} />
        </div>
      </div>
    </div>
  );
}

/* ─── Right Intel Panel ──────────────────────────────────────── */
function RightIntelPanel() {
  const [expandedId, setExpandedId] = useState<string | null>("ci-1");
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "rgba(8,10,14,0.98)",
        border: `1px solid ${GREEN.border}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid rgba(34,197,94,0.08)` }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={12} style={{ color: GREEN.dim }} />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(155,170,180,0.88)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Intel Brief
          </span>
        </div>
        <span style={{ fontSize: "9px", color: "rgba(80,90,100,0.7)" }}>
          {cyberIntelItems.length} briefs
        </span>
      </div>
      {/* Intel cards */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: `${GREEN.muted} transparent` }}
      >
        {cyberIntelItems.map((item) => (
          <IntelCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function IntelCard({ item, expanded, onToggle }: { item: CyberIntelItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="cursor-pointer"
      onClick={onToggle}
      style={{
        background: expanded ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.015)",
        border: expanded ? `1px solid rgba(34,197,94,0.18)` : "1px solid rgba(255,255,255,0.04)",
        borderRadius: "7px",
        padding: "10px 12px",
        marginBottom: "6px",
        transition: "all 150ms ease",
      }}
    >
      {/* Category + Region */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="px-1.5 py-0.5 rounded"
          style={{ fontSize: "8px", fontWeight: 600, color: GREEN.text, background: GREEN.glow, border: `1px solid ${GREEN.border}` }}
        >
          {item.category}
        </span>
        <span style={{ fontSize: "9px", color: "rgba(90,100,110,0.75)" }}>{item.region}</span>
      </div>
      {/* Title */}
      <p
        className="leading-snug mb-1"
        style={{
          fontSize: "11.5px",
          fontWeight: 600,
          color: expanded ? "rgba(210,235,220,0.97)" : "rgba(175,195,205,0.85)",
        }}
      >
        {item.title}
      </p>
      {/* Meta */}
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: "9px", color: "rgba(80,90,100,0.75)" }}>{item.source}</span>
        <span style={{ fontSize: "9px", color: "rgba(60,70,80,0.6)" }}>·</span>
        <span style={{ fontSize: "9px", color: "rgba(80,90,100,0.75)" }}>{item.time}</span>
      </div>
      {/* Summary (expanded) */}
      {expanded && (
        <div
          className="mt-2 pt-2"
          style={{ borderTop: `1px solid rgba(34,197,94,0.08)` }}
        >
          <p style={{ fontSize: "10.5px", color: "rgba(150,165,175,0.85)", lineHeight: 1.6 }}>
            {item.summary}
          </p>
          <button
            className="flex items-center gap-1 mt-2 transition-colors duration-150"
            style={{ fontSize: "9.5px", color: GREEN.dim }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GREEN.accent)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = GREEN.dim)}
          >
            Full Report <ExternalLink size={9} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Most Mentioned Regions Panel ───────────────────────────── */
function MostMentionedRegionsPanel() {
  const maxCount = useMemo(() => Math.max(...cyberRegionMentions.map(r => r.count)), []);
  return (
    <div
      style={{
        background: "rgba(8,10,14,0.98)",
        border: `1px solid ${GREEN.border}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2"
        style={{ borderBottom: `1px solid rgba(34,197,94,0.08)` }}
      >
        <div className="flex items-center gap-2">
          <Globe size={11} style={{ color: GREEN.dim }} />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(155,170,180,0.88)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Most Mentioned Regions
          </span>
        </div>
        <span style={{ fontSize: "9px", color: "rgba(70,80,90,0.65)" }}>24h</span>
      </div>
      {/* Rows */}
      <div className="px-3 py-1.5">
        {cyberRegionMentions.map((r) => (
          <RegionRow key={r.region} item={r} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}

function RegionRow({ item, maxCount }: { item: CyberRegionMention; maxCount: number }) {
  const pct = (item.count / maxCount) * 100;
  const positive = item.change >= 0;
  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}
    >
      <span className="flex-shrink-0" style={{ width: 80, fontSize: "10px", color: "rgba(145,155,165,0.85)", fontWeight: 500 }}>
        {item.region}
      </span>
      {/* Bar */}
      <div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(34,197,94,0.06)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: item.trending
              ? "linear-gradient(90deg, rgba(34,197,94,0.4), rgba(34,197,94,0.7))"
              : "rgba(100,110,120,0.3)",
            transition: "width 300ms ease",
          }}
        />
      </div>
      {/* Count */}
      <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(195,205,215,0.85)", fontVariantNumeric: "tabular-nums", width: 32, textAlign: "right" }}>
        {item.count}
      </span>
      {/* Change */}
      <div className="flex items-center gap-0.5 flex-shrink-0" style={{ width: 48 }}>
        {positive ? <TrendingUp size={9} style={{ color: GREEN.text }} /> : <TrendingDown size={9} style={{ color: "rgba(239,68,68,0.75)" }} />}
        <span style={{ fontSize: "9px", fontWeight: 600, color: positive ? GREEN.text : "rgba(239,68,68,0.75)" }}>
          {positive ? "+" : ""}{item.change}%
        </span>
      </div>
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────────── */
export function CyberSecPanel() {
  return (
    <main
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ background: "rgba(6,8,12,0.98)" }}
    >
      {/* ── Left Column ─────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 py-3 pl-3 pr-2 gap-2"
        style={{ width: "280px" }}
      >
        {/* Left Feed Panel — grows to align bottom with map */}
        <div className="flex-1 min-h-0">
          <LeftFeedPanel />
        </div>
        {/* Most Mentioned Regions — fixed below */}
        <MostMentionedRegionsPanel />
      </div>

      {/* ── Center Map Panel ────────────────────── */}
      <div className="flex-1 min-h-0 py-3 px-1">
        <div
          className="w-full h-full"
          style={{
            border: `1px solid ${GREEN.border}`,
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <CyberMap />
        </div>
      </div>

      {/* ── Right Column ────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 py-3 pl-2 pr-3"
        style={{ width: "300px" }}
      >
        <RightIntelPanel />
      </div>
    </main>
  );
}
