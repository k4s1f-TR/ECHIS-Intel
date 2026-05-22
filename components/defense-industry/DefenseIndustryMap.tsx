"use client";

import { SharedWorldMap2D } from "@/components/map/SharedWorldMap2D";
import { defenseMapMarkers } from "@/data/defenseIndustryMockData";

export function DefenseIndustryMap() {
  return (
    <SharedWorldMap2D
      ariaLabel="Defense Industry world map"
      markerLayer={(project) => (
        <>
          <style>
            {`
              .defense-map-marker-core {
                animation: defenseMapMarkerBreath 3200ms ease-in-out infinite;
                fill: rgba(255, 210, 31, 0.98);
                stroke: rgba(255, 236, 140, 0.72);
                stroke-width: 0.55;
                vector-effect: non-scaling-stroke;
                filter: drop-shadow(0 0 6px rgba(255, 210, 31, 0.38));
              }

              .defense-map-marker-inner {
                fill: rgba(255, 236, 140, 0.95);
                stroke: none;
              }

              @keyframes defenseMapMarkerBreath {
                0%,
                100% {
                  opacity: 0.86;
                }

                50% {
                  opacity: 1;
                }
              }
            `}
          </style>
          {defenseMapMarkers.map((marker, index) => {
            const { x, y } = project(marker.lng, marker.lat);

            return (
              <g key={marker.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
                <circle
                  className="defense-map-marker-core"
                  r="2.8"
                  style={{ animationDelay: `${(index * 0.18).toFixed(2)}s` }}
                />
                <circle className="defense-map-marker-inner" r="1" />
              </g>
            );
          })}
        </>
      )}
    />
  );
}
