import type { SignalTheme } from "@/types/intel-watch";

export const signalThemes: SignalTheme[] = [
  {
    label: "Diplomatic Activity",
    values: { na: 72, eu: 88, me: 91, eurasia: 64, apac: 78 },
  },
  {
    label: "Security Developments",
    values: { na: 55, eu: 76, me: 95, eurasia: 89, apac: 61 },
  },
  {
    label: "Influence Operations",
    values: { na: 68, eu: 74, me: 52, eurasia: 93, apac: 45 },
  },
  {
    label: "Border Tensions",
    values: { na: 34, eu: 58, me: 87, eurasia: 72, apac: 69 },
  },
  {
    label: "Covert Activity",
    values: { na: 48, eu: 61, me: 78, eurasia: 84, apac: 53 },
  },
  {
    label: "Policy Signals",
    values: { na: 82, eu: 79, me: 66, eurasia: 57, apac: 71 },
  },
];

export const regionLabels: Record<string, string> = {
  na: "NA",
  eu: "EU",
  me: "ME",
  eurasia: "Eurasia",
  apac: "APAC",
};

export const regionColors: Record<string, string> = {
  na: "rgba(59,130,246,0.85)",
  eu: "rgba(167,139,250,0.85)",
  me: "rgba(251,146,60,0.85)",
  eurasia: "rgba(248,113,113,0.85)",
  apac: "rgba(52,211,153,0.85)",
};
