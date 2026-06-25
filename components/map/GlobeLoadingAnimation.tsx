"use client";

import { useEffect, useState } from "react";

const DISPLAY_SIZE = 176;
const EXIT_DURATION_MS = 520;

export function GlobeLoadingAnimation({ visible = true }: { visible?: boolean }) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) return;

    const timeoutId = window.setTimeout(
      () => setMounted(false),
      EXIT_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-label="Globe loading"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: `opacity ${EXIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          transform: visible ? "scale(1)" : "scale(0.965)",
          transition: `transform ${EXIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/globe-loader-poster.png"
          disablePictureInPicture
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: DISPLAY_SIZE,
            height: DISPLAY_SIZE,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        >
          <source src="/globe-loader.webm" type="video/webm" />
        </video>
      </div>
    </div>
  );
}
