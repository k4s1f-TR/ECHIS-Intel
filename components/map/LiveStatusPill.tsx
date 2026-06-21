"use client";

interface LiveStatusPillProps {
  panelOffset?: number;
}

export function LiveStatusPill({ panelOffset = 0 }: LiveStatusPillProps) {
  return (
    <div
      className="absolute bottom-3 right-4 flex items-center gap-2.5 rounded-lg z-10"
      style={{
        padding: "5px 10px",
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        boxShadow: "var(--shadow-inset-highlight)",
        backdropFilter: "blur(10px)",
        transform: `translateX(-${panelOffset}px)`,
        transition: "transform 220ms ease",
        willChange: "transform",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="tracking-widest uppercase"
          style={{ fontSize: "8.5px", color: "var(--c-t6)", fontWeight: 600 }}
        >
          Last Updated
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: "10.5px", color: "var(--c-t4)" }}
        >
          03:42 UTC
        </span>
      </div>
    </div>
  );
}
