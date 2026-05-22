"use client";

import { SharedWorldMap2D } from "@/components/map/SharedWorldMap2D";
import { cyberHotspots } from "@/data/cyberMockData";

function markerRadius(size: "small" | "medium" | "large") {
  if (size === "large") return 3.2;
  if (size === "medium") return 2.6;
  return 2.1;
}

export function CyberMap() {
  return (
    <SharedWorldMap2D
      ariaLabel="Cyber Threat world map"
      markerLayer={(project) => (
        <>
          <style>
            {`
              .cyber-map-marker-pulse {
                animation: cyberMapMarkerPulse 2800ms ease-out infinite;
                fill: none;
                stroke: rgba(24, 255, 138, 0.5);
                stroke-width: 1.15;
                transform-box: fill-box;
                transform-origin: center;
              }

              .cyber-map-marker-halo {
                fill: rgba(24, 255, 138, 0.18);
                filter: drop-shadow(0 0 5px rgba(24, 255, 138, 0.28));
              }

              .cyber-map-marker-core {
                animation: cyberMapMarkerBreath 3000ms ease-in-out infinite;
                fill: rgba(24, 255, 138, 0.98);
                stroke: rgba(210, 255, 232, 0.58);
                stroke-width: 0.45;
                vector-effect: non-scaling-stroke;
              }

              @keyframes cyberMapMarkerPulse {
                0% {
                  transform: scale(0.74);
                  opacity: 0.38;
                }

                70% {
                  transform: scale(1.7);
                  opacity: 0.08;
                }

                100% {
                  transform: scale(1.9);
                  opacity: 0;
                }
              }

              @keyframes cyberMapMarkerBreath {
                0%,
                100% {
                  opacity: 0.88;
                }

                50% {
                  opacity: 1;
                }
              }
            `}
          </style>
          {cyberHotspots.map((hotspot, index) => {
            const { x, y } = project(hotspot.lng, hotspot.lat);
            const radius = markerRadius(hotspot.size);
            const delay = `${(index * 0.14).toFixed(2)}s`;

            return (
              <g key={hotspot.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
                <circle
                  className="cyber-map-marker-pulse"
                  r={radius + 2.2}
                  style={{ animationDelay: delay }}
                />
                <circle className="cyber-map-marker-halo" r={radius + 1.1} />
                <circle
                  className="cyber-map-marker-core"
                  r={radius}
                  style={{ animationDelay: delay }}
                />
              </g>
            );
          })}
        </>
      )}
    />
  );
}
