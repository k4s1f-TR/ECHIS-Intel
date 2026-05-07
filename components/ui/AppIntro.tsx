"use client";

import { useEffect, useState } from "react";

/**
 * AppIntro – full-screen operational boot overlay.
 *
 * Renders once on initial load / hard refresh, auto-dismisses after
 * ~1.5 s, then unmounts itself completely so it never blocks
 * interaction or route transitions.
 *
 * Visual language: dark near-black, restrained green accent (#34d399),
 * subtle grid + scan-line, centered TAIPANMONITOR wordmark.
 */
export function AppIntro() {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    // Hold the overlay visible, then start fade-out
    const holdTimer = setTimeout(() => setPhase("fading"), 2400);
    // After the fade transition ends, unmount
    const removeTimer = setTimeout(() => setPhase("done"), 3200);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 800ms cubic-bezier(.4,0,.2,1)",
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      {/* ── background ─────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ background: "#060606" }}
      />

      {/* ── subtle grid ────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── centre content ─────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Hardware-accelerated glow instead of text-shadow */}
        <div
          className="absolute"
          style={{
            width: "300px",
            height: "120px",
            background: "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 60%)",
            animation: "introFade 1600ms cubic-bezier(.4,0,.2,1) both",
          }}
        />

        {/* wordmark */}
        <h1
          className="relative select-none font-semibold tracking-[0.26em] uppercase"
          style={{
            fontSize: "28px",
            color: "rgba(235,235,235,0.92)",
            animation: "introFade 1600ms cubic-bezier(.4,0,.2,1) both",
          }}
        >
          TaipanMonitor
        </h1>
      </div>

      {/* ── corner accents removed ──────────────────────────── */}

      {/* ── keyframes (scoped via style tag) ───────────────── */}
      <style>{`
        @keyframes introFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
