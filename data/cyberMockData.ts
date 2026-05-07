/* ─── Cyber News mock data ────────────────────────────────────── */

export type CyberAttackIndicator = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  severity: "critical" | "high" | "medium" | "low";
  color: string;
  glowColor: string;
};

export type CyberHotspot = {
  id: string;
  lat: number;
  lng: number;
  size: "small" | "medium" | "large";
  severity: "critical" | "high" | "medium" | "low";
  color: string;
  pulseColor: string;
  ringColor: string;
  label?: string;
};

export type CyberNewsContext = {
  country: string;
  affectedEntity: string;
  hackIncident: string;
  attackTypeVector: string;
  threatActorGroup: string;
  targetAsset: string;
  targetSector: string;
  contextSummary: string;
  firstSeen: string;
  lastUpdate: string;
  confidence: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  confidenceLevel: number; // 1 to 5
  impactLevel: number; // 1 to 5
};

export type CyberNewsItem = {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
  summary: string;
  categoryTag: string;
  severityTag: string;
  severityLevel: "critical" | "high" | "medium" | "low";
  accentColor: string;
  context: CyberNewsContext;
};

export type CyberRegionMention = {
  rank: number;
  region: string;
  count: number;
  change: number;
};

/* ── Refined severity palette ─────────────────────────────────── */
// Critical : deep cherry-red     hsl(0, 78%, 54%)
// High     : warm amber          hsl(28, 90%, 52%)
// Medium   : rich golden-yellow  hsl(44, 88%, 52%)
// Low      : refined teal-green  hsl(152, 58%, 42%)
// Accent   : deep violet (kept for composition)

export const cyberAttackIndicators: CyberAttackIndicator[] = [
  { id: "ca-1",  fromLat: 55.75, fromLng: 37.62,   toLat: 52.52, toLng: 13.40,   severity: "critical", color: "rgba(220,50,47,0.28)", glowColor: "rgba(220,50,47,0.7)" },
  { id: "ca-2",  fromLat: 39.90, fromLng: 116.40,  toLat: 1.35,  toLng: 103.82,  severity: "high",     color: "rgba(228,120,18,0.22)", glowColor: "rgba(228,120,18,0.6)" },
  { id: "ca-3",  fromLat: 35.68, fromLng: 51.39,   toLat: 39.92, toLng: 32.85,   severity: "medium",   color: "rgba(218,175,22,0.22)", glowColor: "rgba(218,175,22,0.6)" },
  { id: "ca-4",  fromLat: 55.75, fromLng: 37.62,   toLat: 48.86, toLng: 2.35,    severity: "critical", color: "rgba(220,50,47,0.24)", glowColor: "rgba(220,50,47,0.65)" },
  { id: "ca-5",  fromLat: 39.90, fromLng: 116.40,  toLat: 25.27, toLng: 55.30,   severity: "medium",   color: "rgba(218,175,22,0.22)", glowColor: "rgba(218,175,22,0.6)" },
  { id: "ca-6",  fromLat: 40.71, fromLng: -74.01,  toLat: 51.51, toLng: -0.13,   severity: "low",      color: "rgba(56,168,105,0.2)",  glowColor: "rgba(56,168,105,0.55)" },
  { id: "ca-7",  fromLat: 39.90, fromLng: 116.40,  toLat: -33.87, toLng: 151.21, severity: "high",     color: "rgba(228,120,18,0.22)", glowColor: "rgba(228,120,18,0.6)" },
  { id: "ca-8",  fromLat: 55.75, fromLng: 37.62,   toLat: -23.55, toLng: -46.63, severity: "critical", color: "rgba(220,50,47,0.24)", glowColor: "rgba(220,50,47,0.65)" },
  { id: "ca-9",  fromLat: 35.68, fromLng: 51.39,   toLat: 6.52,  toLng: 3.38,    severity: "high",     color: "rgba(228,120,18,0.22)", glowColor: "rgba(228,120,18,0.6)" },
  { id: "ca-10", fromLat: 40.71, fromLng: -74.01,  toLat: 35.68, toLng: 139.69,  severity: "medium",   color: "rgba(218,175,22,0.22)", glowColor: "rgba(218,175,22,0.6)" },
  { id: "ca-11", fromLat: 39.90, fromLng: 116.40,  toLat: 13.76, toLng: 100.50,  severity: "low",      color: "rgba(56,168,105,0.2)",  glowColor: "rgba(56,168,105,0.55)" },
  { id: "ca-12", fromLat: 55.75, fromLng: 37.62,   toLat: 28.61, toLng: 77.21,   severity: "high",     color: "rgba(228,120,18,0.22)", glowColor: "rgba(228,120,18,0.6)" },
  { id: "ca-13", fromLat: 39.90, fromLng: 116.40,  toLat: 37.57, toLng: 126.98,  severity: "medium",   color: "rgba(218,175,22,0.22)", glowColor: "rgba(218,175,22,0.6)" },
  { id: "ca-14", fromLat: 35.68, fromLng: 51.39,   toLat: 24.71, toLng: 46.68,   severity: "high",     color: "rgba(228,120,18,0.22)", glowColor: "rgba(228,120,18,0.6)" },
];

export const cyberHotspots: CyberHotspot[] = [
  { id: "ch-1",  lat: 52.52, lng: 13.40,   size: "large",  severity: "critical", color: "#dc322f", pulseColor: "rgba(220,50,47,0.14)", ringColor: "rgba(220,50,47,0.35)", label: "GERMANY" },
  { id: "ch-2",  lat: 48.86, lng: 2.35,    size: "large",  severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.12)", ringColor: "rgba(228,120,18,0.28)", label: "FRANCE" },
  { id: "ch-3",  lat: 55.75, lng: 37.62,   size: "medium", severity: "medium",   color: "#daaf16", pulseColor: "rgba(218,175,22,0.10)", ringColor: "rgba(218,175,22,0.22)", label: "RUSSIA" },
  { id: "ch-4",  lat: 39.90, lng: 116.40,  size: "medium", severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.10)", ringColor: "rgba(228,120,18,0.22)", label: "CHINA" },
  { id: "ch-5",  lat: 39.92, lng: 32.85,   size: "medium", severity: "low",      color: "#38a869", pulseColor: "rgba(56,168,105,0.10)", ringColor: "rgba(56,168,105,0.22)", label: "TÜRKIYE" },
  { id: "ch-6",  lat: 25.27, lng: 55.30,   size: "small",  severity: "low",      color: "#38a869", pulseColor: "rgba(56,168,105,0.06)", ringColor: "rgba(56,168,105,0.14)", label: "UAE" },
  { id: "ch-7",  lat: 1.35,  lng: 103.82,  size: "small",  severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.06)", ringColor: "rgba(228,120,18,0.14)", label: "SINGAPORE" },
  { id: "ch-8",  lat: 51.51, lng: -0.13,   size: "small",  severity: "low",      color: "#38a869", pulseColor: "rgba(56,168,105,0.06)", ringColor: "rgba(56,168,105,0.14)", label: "UNITED KINGDOM" },
  { id: "ch-9",  lat: 40.71, lng: -74.01,  size: "small",  severity: "medium",   color: "#daaf16", pulseColor: "rgba(218,175,22,0.06)", ringColor: "rgba(218,175,22,0.12)", label: "UNITED STATES" },
  { id: "ch-10", lat: 35.68, lng: 51.39,   size: "small",  severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.06)", ringColor: "rgba(228,120,18,0.12)", label: "IRAN" },
  { id: "ch-11", lat: 37.57, lng: 126.98,  size: "small",  severity: "low",      color: "#38a869", pulseColor: "rgba(56,168,105,0.06)", ringColor: "rgba(56,168,105,0.14)", label: "SOUTH KOREA" },
  { id: "ch-12", lat: 24.71, lng: 46.68,   size: "small",  severity: "critical", color: "#dc322f", pulseColor: "rgba(220,50,47,0.06)", ringColor: "rgba(220,50,47,0.14)", label: "SAUDI ARABIA" },
  { id: "ch-13", lat: -33.87, lng: 151.21, size: "small",  severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.06)", ringColor: "rgba(228,120,18,0.14)", label: "AUSTRALIA" },
  { id: "ch-14", lat: -23.55, lng: -46.63, size: "small",  severity: "critical", color: "#dc322f", pulseColor: "rgba(220,50,47,0.06)", ringColor: "rgba(220,50,47,0.14)", label: "BRAZIL" },
  { id: "ch-15", lat: 6.52,  lng: 3.38,    size: "small",  severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.06)", ringColor: "rgba(228,120,18,0.14)", label: "NIGERIA" },
  { id: "ch-16", lat: 35.68, lng: 139.69,  size: "medium", severity: "medium",   color: "#daaf16", pulseColor: "rgba(218,175,22,0.10)", ringColor: "rgba(218,175,22,0.22)", label: "JAPAN" },
  { id: "ch-17", lat: 13.76, lng: 100.50,  size: "small",  severity: "low",      color: "#38a869", pulseColor: "rgba(56,168,105,0.06)", ringColor: "rgba(56,168,105,0.14)", label: "THAILAND" },
  { id: "ch-18", lat: 28.61, lng: 77.21,   size: "medium", severity: "high",     color: "#e47812", pulseColor: "rgba(228,120,18,0.10)", ringColor: "rgba(228,120,18,0.22)", label: "INDIA" },
];

export const cyberNewsItems: CyberNewsItem[] = [
  {
    id: "cn-1",
    headline: "Zero-Day Vulnerability Actively Exploited in Fortinet VPN Devices",
    source: "CISA",
    timeAgo: "45 min ago",
    summary: "CISA confirms active exploitation of CVE-2024-55591 affecting Fortinet FortiOS.",
    categoryTag: "Vulnerability",
    severityTag: "CRITICAL",
    severityLevel: "critical",
    accentColor: "#ef4444",
    context: {
      country: "United States",
      affectedEntity: "Enterprise VPN Operators",
      hackIncident: "Fortinet FortiOS Zero-Day Exploitation",
      attackTypeVector: "VPN Exploitation / Initial Access",
      threatActorGroup: "Unknown / Multiple Actors",
      targetAsset: "Fortinet VPN Appliances",
      targetSector: "Enterprise Infrastructure",
      contextSummary: "Active exploitation of Fortinet FortiOS is being reported across exposed enterprise VPN appliances. The activity may enable unauthorized access and follow-on intrusion attempts against vulnerable network edge systems.",
      firstSeen: "May 12, 2025 08:15 UTC",
      lastUpdate: "May 12, 2025 21:45 UTC",
      confidence: "High",
      impact: "High",
      confidenceLevel: 4,
      impactLevel: 4,
    }
  },
  {
    id: "cn-2",
    headline: "RansomHub Claims Attack on Major European Manufacturing Firm",
    source: "BleepingComputer",
    timeAgo: "1 h ago",
    summary: "RansomHub adds new victim to leak site, claims data exfiltration and encryption.",
    categoryTag: "Ransomware",
    severityTag: "HIGH",
    severityLevel: "high",
    accentColor: "#f97316",
    context: {
      country: "Germany",
      affectedEntity: "European Manufacturing Firm",
      hackIncident: "RansomHub Data Exfiltration Claim",
      attackTypeVector: "Ransomware / Data Exfiltration",
      threatActorGroup: "RansomHub",
      targetAsset: "Corporate File Systems / Business Data",
      targetSector: "Manufacturing",
      contextSummary: "RansomHub has claimed responsibility for an intrusion affecting a European manufacturing organization. The claim references data exfiltration and encryption pressure, suggesting a double-extortion ransomware pattern.",
      firstSeen: "May 12, 2025 09:40 UTC",
      lastUpdate: "May 12, 2025 22:10 UTC",
      confidence: "Medium",
      impact: "High",
      confidenceLevel: 3,
      impactLevel: 4,
    }
  },
  {
    id: "cn-3",
    headline: "APT41 Expands Targeting to Global Telecommunications Sector",
    source: "Recorded Future",
    timeAgo: "2 h ago",
    summary: "New campaign observed targeting telecom providers in Asia and the Middle East.",
    categoryTag: "APT",
    severityTag: "HIGH",
    severityLevel: "high",
    accentColor: "#22c55e",
    context: {
      country: "Southeast Asia",
      affectedEntity: "Regional Telecom Providers",
      hackIncident: "APT41 Telecom Targeting Expansion",
      attackTypeVector: "Espionage / Long-Term Access",
      threatActorGroup: "APT41",
      targetAsset: "Telecom Infrastructure / Partner Networks",
      targetSector: "Telecommunications",
      contextSummary: "Reporting indicates expanded APT41 targeting of telecom providers and partner ecosystems across Asia and the Middle East. The activity suggests long-term access objectives and infrastructure mapping.",
      firstSeen: "May 12, 2025 11:10 UTC",
      lastUpdate: "May 12, 2025 20:30 UTC",
      confidence: "High",
      impact: "Medium",
      confidenceLevel: 4,
      impactLevel: 3,
    }
  },
  {
    id: "cn-4",
    headline: "Malicious NPM Packages Targeting Crypto Developers Discovered",
    source: "Sekoia",
    timeAgo: "3 h ago",
    summary: "Multiple malicious packages found stealing wallet credentials and API keys.",
    categoryTag: "Malware",
    severityTag: "MEDIUM",
    severityLevel: "medium",
    accentColor: "#84cc16",
    context: {
      country: "Global",
      affectedEntity: "Crypto Developer Community",
      hackIncident: "Malicious NPM Package Campaign",
      attackTypeVector: "Supply Chain / Malicious Package",
      threatActorGroup: "Unknown",
      targetAsset: "Developer Workstations / Wallet Credentials",
      targetSector: "Software / Crypto",
      contextSummary: "Malicious NPM packages were observed targeting crypto developers with credential and wallet theft behavior. The activity highlights ongoing supply-chain risk in open-source package ecosystems.",
      firstSeen: "May 12, 2025 13:25 UTC",
      lastUpdate: "May 12, 2025 19:05 UTC",
      confidence: "Medium",
      impact: "Medium",
      confidenceLevel: 3,
      impactLevel: 3,
    }
  },
  {
    id: "cn-5",
    headline: "Microsoft Patches Actively Exploited Windows Privilege Escalation Flaw",
    source: "Microsoft",
    timeAgo: "4 h ago",
    summary: "Patch addresses elevation of privilege vulnerability in Windows Win32k.",
    categoryTag: "Patch",
    severityTag: "HIGH",
    severityLevel: "high",
    accentColor: "#f97316",
    context: {
      country: "Global",
      affectedEntity: "Windows Enterprise Environments",
      hackIncident: "Windows Privilege Escalation Patch Advisory",
      attackTypeVector: "Privilege Escalation",
      threatActorGroup: "Unknown / Opportunistic Actors",
      targetAsset: "Windows Endpoints / Win32k Component",
      targetSector: "Enterprise IT",
      contextSummary: "Microsoft has issued a patch for an actively exploited Windows privilege escalation vulnerability. Successful exploitation may support post-compromise elevation and persistence activity.",
      firstSeen: "May 12, 2025 14:00 UTC",
      lastUpdate: "May 12, 2025 18:45 UTC",
      confidence: "High",
      impact: "Medium",
      confidenceLevel: 4,
      impactLevel: 3,
    }
  },
];

export const cyberRegionMentions: CyberRegionMention[] = [
  { rank: 1, region: "Europe", count: 1235, change: 18.6 },
  { rank: 2, region: "Southeast Asia", count: 987, change: 12.4 },
  { rank: 3, region: "Middle East", count: 754, change: 9.7 },
  { rank: 4, region: "North America", count: 642, change: -2.1 },
  { rank: 5, region: "East Asia", count: 531, change: 6.3 },
  { rank: 6, region: "South Asia", count: 412, change: 3.3 },
  { rank: 7, region: "Africa", count: 298, change: 7.2 },
];
