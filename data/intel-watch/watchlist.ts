import type { WatchlistEntry } from "@/types/intel-watch";

export const watchlistEntries: WatchlistEntry[] = [
  {
    id: "wl-001",
    region: "Middle East",
    topic: "Iran Nuclear Programme",
    priority: "HIGH",
    confidence: 84,
    lastUpdate: "09:31 UTC",
  },
  {
    id: "wl-002",
    region: "Eurasia",
    topic: "Russia Information Operations",
    priority: "HIGH",
    confidence: 77,
    lastUpdate: "08:47 UTC",
  },
  {
    id: "wl-003",
    region: "Europe",
    topic: "Ukraine Frontline Developments",
    priority: "MEDIUM",
    confidence: 69,
    lastUpdate: "08:15 UTC",
  },
  {
    id: "wl-004",
    region: "Middle East",
    topic: "Israel–Hamas Ceasefire Talks",
    priority: "MEDIUM",
    confidence: 55,
    lastUpdate: "07:22 UTC",
  },
  {
    id: "wl-005",
    region: "Asia Pacific",
    topic: "South China Sea Patrols",
    priority: "LOW",
    confidence: 42,
    lastUpdate: "06:58 UTC",
  },
];
