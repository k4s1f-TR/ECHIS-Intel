'use client';

/**
 * IntelMapLoader — ECHIS Intel Watch map loading overlay (MapLibre GL ready)
 * --------------------------------------------------------------------------
 * Drop this over your MapLibre container. The bar fills on its own toward ~90%
 * and waits; when `ready` flips to true (you got map.on('load')/'idle'), it
 * finishes to 100%, holds briefly, then fades/blurs out and calls onDone.
 *
 * USAGE (App Router / client component):
 *
 *   'use client';
 *   import { useEffect, useRef, useState } from 'react';
 *   import maplibregl from 'maplibre-gl';
 *   import IntelMapLoader from '@/components/IntelMapLoader';
 *
 *   export default function MapView() {
 *     const mapEl = useRef<HTMLDivElement>(null);
 *     const [ready, setReady] = useState(false);   // map says "I'm ready"
 *     const [gone, setGone] = useState(false);      // overlay finished closing
 *
 *     useEffect(() => {
 *       const map = new maplibregl.Map({ container: mapEl.current!, style: '...' });
 *       map.on('load', () => setReady(true));       // <-- the only trigger you need
 *       // (or: map.once('idle', () => setReady(true)) to wait for first full render)
 *       return () => map.remove();
 *     }, []);
 *
 *     return (
 *       <div style={{ position: 'relative', width: '100%', height: '100%' }}>
 *         <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
 *         {!gone && <IntelMapLoader ready={ready} onDone={() => setGone(true)} />}
 *       </div>
 *     );
 *   }
 *
 * The parent MUST be position:relative (or absolute/fixed) — the overlay is inset:0.
 */

import { useEffect, useRef } from 'react';

type Props = {
  /** Set true once the map has loaded (e.g. inside map.on('load')). */
  ready: boolean;
  /** Accent color. Default ECHIS red. */
  accent?: string;
  /** Number of ruler bars. Default 41. */
  bars?: number;
  /** Called after the close animation finishes — unmount the overlay here. */
  onDone?: () => void;
};

function hex2rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function IntelMapLoader({ ready, accent = '#e6303c', bars = 41, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const root = rootRef.current;
    const ruler = rulerRef.current;
    const pctEl = pctRef.current;
    const coordEl = coordRef.current;
    if (!root || !ruler || !pctEl || !coordEl) return;

    const N = Math.max(20, Math.min(60, bars));
    const [ar, ag, ab] = hex2rgb(accent);
    const rgba = (o: number | string) => `rgba(${ar},${ag},${ab},${o})`;

    // build bars once
    ruler.innerHTML = '';
    const barEls: HTMLDivElement[] = [];
    for (let i = 0; i < N; i++) {
      const b = document.createElement('div');
      b.style.cssText = `width:4px;height:30px;border-radius:1.5px;background:${rgba(0.13)};`;
      ruler.appendChild(b);
      barEls.push(b);
    }

    let display = 0;
    let exiting = false;
    let raf = 0;
    let frame = 0;
    const startT = performance.now();
    let readyT: number | null = null;
    let baseAtReady = 0;
    const baseMs = 4200;
    const rand = (min: number, max: number) => (min + Math.random() * (max - min)).toFixed(3);

    const tick = (now: number) => {
      frame++;
      if (readyRef.current && readyT === null) { readyT = now; baseAtReady = display; }
      if (readyT !== null) {
        const f = Math.min(1, (now - readyT) / 480);
        display = baseAtReady + (1 - baseAtReady) * (1 - Math.pow(1 - f, 2));
      } else {
        display = Math.min(0.95, (now - startT) / baseMs); // slow, continuous creep
      }
      let pct = Math.round(display * 100);
      if (readyT === null) pct = Math.min(99, pct); // never show 100% until the map is ready
      pctEl.textContent = String(pct);
      if (frame % 5 === 0) coordEl.textContent = `${rand(35, 43)}°N · ${rand(24, 46)}°E`;

      const active = Math.round(display * (N - 1));
      for (let i = 0; i < N; i++) {
        const b = barEls[i];
        let bg: string;
        let sh = 'none';
        if (i < active) {
          const d = active - 1 - i;
          bg = rgba((0.2 + 0.45 * Math.max(0, 1 - d / 16)).toFixed(2));
        } else if (i === active) {
          bg = accent;
          sh = `0 0 12px 3px ${rgba(0.5)}`;
        } else if (i <= active + 2) {
          bg = rgba(Math.max(0.05, 0.16 - (i - active - 1) * 0.05).toFixed(2));
        } else {
          bg = 'rgba(150,170,200,.13)';
        }
        b.style.background = bg;
        b.style.boxShadow = sh;
      }

      if (readyT !== null && !exiting && display > 0.999) {
        exiting = true;
        window.setTimeout(() => {
          root.style.opacity = '0';
          root.style.filter = 'blur(7px)';
          root.style.transform = 'scale(1.035)';
          window.setTimeout(() => {
            cancelAnimationFrame(raf);
            onDone?.();
          }, 640);
        }, 260);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // build/animation depends only on look params; `ready` is read via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, bars]);

  const [ar, ag, ab] = hex2rgb(accent);
  const rgba = (o: number) => `rgba(${ar},${ag},${ab},${o})`;

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        overflow: 'hidden',
        transformOrigin: 'center',
        background: '#0a0b0e',
        backgroundImage:
          'linear-gradient(rgba(140,160,190,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(140,160,190,.03) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
        fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
        transition: 'opacity .6s ease, filter .6s ease, transform .6s ease',
      }}
    >
      <style>{`@keyframes iml-glow{0%,100%{opacity:.6}50%{opacity:1}}`}</style>

      {/* vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 620px 360px at 50% 50%, ${rgba(0.025)}, transparent 72%), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)`,
        }}
      />

      {/* centered group */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 660,
          maxWidth: '84%',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30 }}>
          <div style={{ font: '600 11px/1.3 ui-monospace,monospace', letterSpacing: '.3em', color: '#e8eaed' }}>
            INTEL WATCH MAP
          </div>
          <span ref={coordRef} style={{ font: '400 12px/1 ui-monospace,monospace', letterSpacing: '.08em', color: '#9aa3b0' }}>
            —
          </span>
        </div>

        {/* ruler */}
        <div ref={rulerRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 38 }} />
        <div
          style={{
            height: 1,
            background:
              'linear-gradient(90deg,transparent,rgba(150,170,200,.16) 12%,rgba(150,170,200,.16) 88%,transparent)',
            marginTop: 9,
          }}
        />

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: accent,
                boxShadow: `0 0 9px 2px ${rgba(0.5)}`,
                animation: 'iml-glow 1.6s ease-in-out infinite',
              }}
            />
            <span
              style={{
                font: '500 10px/1 ui-monospace,monospace',
                letterSpacing: '.32em',
                color: '#9aa3b0',
                textTransform: 'uppercase',
              }}
            >
              Loading Map
            </span>
          </div>
          <div style={{ lineHeight: 1 }}>
            <span ref={pctRef} style={{ font: '200 34px/1 ui-monospace,monospace', color: '#e8eaed', fontVariantNumeric: 'tabular-nums' }}>
              0
            </span>
            <span style={{ font: '400 15px/1 ui-monospace,monospace', color: '#6b7280', marginLeft: 3 }}>%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
