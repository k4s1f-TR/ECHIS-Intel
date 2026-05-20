"use client";
import { useEffect, useRef } from "react";
import { feature, mesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import { defenseMapMarkers } from "@/data/defenseIndustryMockData";

const topology = countriesAtlas as unknown as TopoJSON.Topology;
const countriesGeo = feature(topology, topology.objects.countries as TopoJSON.GeometryCollection);
function gn(o: { properties?: unknown } | null | undefined) {
  return ((o?.properties as { name?: string } | undefined)?.name ?? "").toLowerCase();
}
const filteredFeatures = countriesGeo.features.filter((f) => {
  const n = gn(f);
  return n !== "antarctica" && n !== "fr. s. antarctic lands";
});
const bordersMesh = mesh(topology, topology.objects.countries as TopoJSON.GeometryCollection, (a, b) => a !== b);
const coastMesh = mesh(
  topology,
  topology.objects.countries as TopoJSON.GeometryCollection,
  (a, b) => a === b && gn(a) !== "antarctica" && gn(a) !== "fr. s. antarctic lands",
);

const LAT_MAX = 84, LAT_MIN = -56, LAT_SPAN = LAT_MAX - LAT_MIN;
const PAD_X = 0.04, PAD_Y = 0.04, ASPECT = 2.26;
const PI2 = Math.PI * 2;

function px(lng: number, pL: number, iW: number) {
  return pL + ((lng + 180) / 360) * iW;
}
function py(lat: number, pT: number, iH: number) {
  return pT + ((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) / LAT_SPAN) * iH;
}
function traceRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  pL: number, pT: number, iW: number, iH: number,
  close: boolean,
) {
  let prev: number | null = null;
  ring.forEach(([lng, lat], i) => {
    const x = px(lng, pL, iW);
    const y = py(lat, pT, iH);
    if (i === 0 || (prev !== null && Math.abs(lng - prev) > 180)) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    prev = lng;
  });
  if (close) ctx.closePath();
}
function drawGeo(
  ctx: CanvasRenderingContext2D,
  geo: GeoJSON.Geometry,
  pL: number, pT: number, iW: number, iH: number,
  close: boolean,
) {
  if (geo.type === "Polygon") (geo.coordinates as number[][][]).forEach((r) => traceRing(ctx, r, pL, pT, iW, iH, close));
  else if (geo.type === "MultiPolygon")
    (geo.coordinates as number[][][][]).forEach((p) => p.forEach((r) => traceRing(ctx, r, pL, pT, iW, iH, close)));
  else if (geo.type === "LineString") traceRing(ctx, geo.coordinates as number[][], pL, pT, iW, iH, false);
  else if (geo.type === "MultiLineString")
    (geo.coordinates as number[][][]).forEach((r) => traceRing(ctx, r, pL, pT, iW, iH, false));
  else if (geo.type === "GeometryCollection")
    (geo as GeoJSON.GeometryCollection).geometries.forEach((g) => drawGeo(ctx, g, pL, pT, iW, iH, close));
}
function getVP(w: number, h: number) {
  const fX = w * PAD_X, fY = h * PAD_Y, fW = w - fX * 2, fH = h - fY * 2;
  let iW = fW, iH = fW / ASPECT;
  if (iH > fH) { iH = fH; iW = fH * ASPECT; }
  return { pL: fX + (fW - iW) / 2, pT: fY + (fH - iH) / 2, iW, iH };
}

/* Static base — neutral, restrained, no animation, no flow lines */
export function DefenseIndustryMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const { pL, pT, iW, iH } = getVP(W, H);

    // Background
    ctx.fillStyle = "#04070b";
    ctx.fillRect(0, 0, W, H);

    // Faint grid
    ctx.strokeStyle = "rgba(120,135,150,0.012)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 18; i++) {
      const x = pL + (iW / 18) * i;
      ctx.beginPath();
      ctx.moveTo(x, pT);
      ctx.lineTo(x, pT + iH);
      ctx.stroke();
    }
    for (let j = 0; j <= 9; j++) {
      const y = pT + (iH / 9) * j;
      ctx.beginPath();
      ctx.moveTo(pL, y);
      ctx.lineTo(pL + iW, y);
      ctx.stroke();
    }

    // Land
    ctx.beginPath();
    filteredFeatures.forEach((f) => {
      if (f.geometry) drawGeo(ctx, f.geometry, pL, pT, iW, iH, true);
    });
    ctx.fillStyle = "#0c1219";
    ctx.fill();

    // Coastlines
    ctx.beginPath();
    drawGeo(ctx, coastMesh, pL, pT, iW, iH, false);
    ctx.strokeStyle = "rgba(150,170,190,0.09)";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Borders
    ctx.beginPath();
    drawGeo(ctx, bordersMesh, pL, pT, iW, iH, false);
    ctx.strokeStyle = "rgba(130,150,170,0.045)";
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Static markers — restrained neutral
    defenseMapMarkers.forEach((m) => {
      const x = px(m.lng, pL, iW);
      const y = py(m.lat, pT, iH);

      // Soft outer ring
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, PI2);
      ctx.strokeStyle = "rgba(165,180,195,0.18)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Core dot
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, PI2);
      ctx.fillStyle = "rgba(195,210,220,0.78)";
      ctx.fill();
    });
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: "#04070b" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
