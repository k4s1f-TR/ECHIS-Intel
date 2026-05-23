"use client";

import { SharedWorldMap2D } from "@/components/map/SharedWorldMap2D";
import { cyberHotspots } from "@/data/cyberMockData";

const cyberAttackRoutes = [
  { id: "route-china-singapore", from: { lng: 116.4, lat: 39.9 }, to: { lng: 103.82, lat: 1.35 } },
  { id: "route-russia-germany", from: { lng: 37.62, lat: 55.75 }, to: { lng: 13.4, lat: 52.52 } },
  { id: "route-iran-turkiye", from: { lng: 51.39, lat: 35.68 }, to: { lng: 32.85, lat: 39.92 } },
  { id: "route-us-japan", from: { lng: -74.01, lat: 40.71 }, to: { lng: 139.69, lat: 35.68 } },
  { id: "route-china-india", from: { lng: 116.4, lat: 39.9 }, to: { lng: 77.21, lat: 28.61 } },
];

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

              .cyber-attack-route-base {
                fill: none;
                opacity: 0;
                stroke: transparent;
                stroke-linecap: round;
                stroke-width: 1;
                vector-effect: non-scaling-stroke;
              }

              .cyber-attack-route-trail,
              .cyber-attack-route-head {
                animation: cyberAttackRouteSignal 2600ms linear infinite;
                fill: none;
                stroke-linecap: round;
                vector-effect: non-scaling-stroke;
              }

              .cyber-attack-route-trail {
                opacity: 0.34;
                stroke: rgba(24, 255, 138, 0.46);
                stroke-dasharray: 16 84;
                stroke-dashoffset: 106;
                stroke-width: 1.2;
                filter: drop-shadow(0 0 2px rgba(24, 255, 138, 0.18));
              }

              .cyber-attack-route-head {
                opacity: 0.78;
                stroke: rgba(139, 255, 197, 0.76);
                stroke-dasharray: 4 96;
                stroke-dashoffset: 100;
                stroke-width: 1.05;
                filter: drop-shadow(0 0 2.5px rgba(24, 255, 138, 0.28));
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

              @keyframes cyberAttackRouteSignal {
                to {
                  stroke-dashoffset: 0;
                }
              }

              @media (prefers-reduced-motion: reduce) {
                .cyber-attack-route-trail,
                .cyber-attack-route-head {
                  animation: none;
                  opacity: 0.22;
                }
              }
            `}
          </style>
          <g aria-hidden="true" className="cyber-attack-route-layer">
            {cyberAttackRoutes.map((route, index) => {
              const from = project(route.from.lng, route.from.lat);
              const to = project(route.to.lng, route.to.lat);
              const x1 = from.x.toFixed(2);
              const y1 = from.y.toFixed(2);
              const x2 = to.x.toFixed(2);
              const y2 = to.y.toFixed(2);
              const delay = `${(index * 0.34).toFixed(2)}s`;

              return (
                <g key={route.id}>
                  <line
                    className="cyber-attack-route-base"
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                  />
                  <line
                    className="cyber-attack-route-trail"
                    pathLength="100"
                    style={{ animationDelay: delay }}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                  />
                  <line
                    className="cyber-attack-route-head"
                    pathLength="100"
                    style={{ animationDelay: delay }}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                  />
                </g>
              );
            })}
          </g>
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
