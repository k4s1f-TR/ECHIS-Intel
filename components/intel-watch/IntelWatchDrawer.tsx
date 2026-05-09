"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type IntelWatchDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function IntelWatchDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: IntelWatchDrawerProps) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus close button when drawer opens
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  // ESC key closes the drawer
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  return (
    // Absolute overlay fills the Live Feed container — no fixed/body manipulation
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        pointerEvents: open ? "auto" : "none",
        visibility: open ? "visible" : "hidden",
        // Delay hiding so the slide-out animation plays first
        transition: open ? "visibility 0ms" : "visibility 0ms 180ms",
      }}
    >
      {/* Backdrop — fades in/out */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8,12,20,0.55)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          transition: "opacity 200ms",
        }}
      />

      {/* Panel — curtain drops from the top */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
          transform: open ? "translateY(0)" : "translateY(-100%)",
          transition: open
            ? "transform 220ms ease-out"
            : "transform 180ms ease-in",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "0 20px",
            borderBottom: "1px solid rgba(51,65,85,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              id={titleId}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(195,208,225,0.95)",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
            {subtitle && (
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(110,125,145,0.75)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subtitle}
              </span>
            )}
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: 4,
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: "rgba(110,125,145,0.7)",
              transition: "color 120ms ease, border-color 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(195,208,225,0.9)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(110,125,145,0.7)";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div
          className="intel-watch-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 20px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
