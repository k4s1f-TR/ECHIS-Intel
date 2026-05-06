/* ─── Cyber Sec. mock data ────────────────────────────────────── */

export type CyberFeedItem = {
  id: string;
  title: string;
  source: string;
  time: string;
  severity: "critical" | "high" | "medium" | "low";
  tag: string;
};

export type CyberIntelItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  region: string;
  category: string;
};

export type CyberAttackIndicator = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  tier: "low" | "active" | "critical";
};

/* Hotspot nodes — static activity markers on the map (not arcs) */
export type CyberHotspot = {
  id: string;
  lat: number;
  lng: number;
  tier: "low" | "active" | "critical";
  label?: string;
};

export const cyberAttackIndicators: CyberAttackIndicator[] = [
  { id: "ca-1", fromLat: 55.75, fromLng: 37.62, toLat: 52.52, toLng: 13.40, tier: "critical" },
  { id: "ca-2", fromLat: 39.90, fromLng: 116.40, toLat: 1.35, toLng: 103.82, tier: "active" },
  { id: "ca-3", fromLat: 35.68, fromLng: 51.39, toLat: 39.92, toLng: 32.85, tier: "active" },
  { id: "ca-4", fromLat: 55.75, fromLng: 37.62, toLat: 48.86, toLng: 2.35, tier: "critical" },
  { id: "ca-5", fromLat: 39.90, fromLng: 116.40, toLat: 25.27, toLng: 55.30, tier: "active" },
];

export const cyberHotspots: CyberHotspot[] = [
  { id: "ch-1", lat: 52.52, lng: 13.40, tier: "critical", label: "Berlin" },
  { id: "ch-2", lat: 48.86, lng: 2.35, tier: "critical", label: "Paris" },
  { id: "ch-3", lat: 55.75, lng: 37.62, tier: "active" },
  { id: "ch-4", lat: 39.90, lng: 116.40, tier: "active" },
  { id: "ch-5", lat: 39.92, lng: 32.85, tier: "active", label: "Ankara" },
  { id: "ch-6", lat: 25.27, lng: 55.30, tier: "low" },
  { id: "ch-7", lat: 1.35, lng: 103.82, tier: "low" },
  { id: "ch-8", lat: 51.51, lng: -0.13, tier: "low" },
  { id: "ch-9", lat: 40.71, lng: -74.01, tier: "low" },
  { id: "ch-10", lat: 35.68, lng: 51.39, tier: "low" },
  { id: "ch-11", lat: 37.57, lng: 126.98, tier: "low" },
  { id: "ch-12", lat: 24.71, lng: 46.68, tier: "low" },
];

export type CyberRegionMention = {
  region: string;
  count: number;
  change: number;
  trending: boolean;
};

export const cyberFeedItems: CyberFeedItem[] = [
  { id: "cf-1", title: "Massive DDoS Campaign Targets European Banking Infrastructure", source: "CyberWire", time: "12 min ago", severity: "critical", tag: "DDoS" },
  { id: "cf-2", title: "New Ransomware Variant 'BlackVeil' Spreading Across Healthcare Sector", source: "Recorded Future", time: "28 min ago", severity: "critical", tag: "Ransomware" },
  { id: "cf-3", title: "APT41 Linked to Espionage Campaign Against Telecom Providers in SE Asia", source: "Mandiant", time: "1h ago", severity: "high", tag: "APT" },
  { id: "cf-4", title: "Critical Zero-Day Vulnerability Discovered in Fortinet VPN Appliances", source: "CISA", time: "1h 40min ago", severity: "critical", tag: "Zero-Day" },
  { id: "cf-5", title: "Phishing Campaign Impersonating NATO Targets Eastern European Governments", source: "ESET", time: "2h ago", severity: "high", tag: "Phishing" },
  { id: "cf-6", title: "Turkish CERT Issues Advisory on Increased Scanning Activity from Known APT IPs", source: "TR-CERT", time: "2h 30min ago", severity: "medium", tag: "Advisory" },
  { id: "cf-7", title: "Supply Chain Attack Detected in Popular NPM Package Ecosystem", source: "Snyk", time: "3h ago", severity: "high", tag: "Supply Chain" },
  { id: "cf-8", title: "Chinese State-Sponsored Group Targets Critical Infrastructure in Middle East", source: "CrowdStrike", time: "3h 20min ago", severity: "high", tag: "APT" },
  { id: "cf-9", title: "Data Breach at Major European Logistics Company Exposes 2.3M Records", source: "HaveIBeenPwned", time: "4h ago", severity: "medium", tag: "Data Breach" },
  { id: "cf-10", title: "Credential Stuffing Wave Hits Turkish E-Commerce Platforms", source: "TR-CERT", time: "4h 45min ago", severity: "medium", tag: "Credential" },
  { id: "cf-11", title: "Russian Botnet Infrastructure Disrupted by Joint Law Enforcement Operation", source: "Europol", time: "5h ago", severity: "low", tag: "Takedown" },
  { id: "cf-12", title: "Industrial Control Systems Vulnerability Report — Q2 2025 Summary", source: "ICS-CERT", time: "6h ago", severity: "medium", tag: "ICS" },
];

export const cyberIntelItems: CyberIntelItem[] = [
  { id: "ci-1", title: "APT41 Infrastructure Shift Indicates New Campaign Preparation", summary: "Analysis of newly registered domains and C2 infrastructure suggests APT41 is preparing a large-scale operation targeting telecommunications and energy sectors. Multiple newly provisioned servers in Southeast Asia show signatures consistent with the group's historical tooling. Intelligence community assessments indicate a high probability of coordinated attacks within the next 30-day window.", source: "Mandiant Threat Intelligence", time: "45 min ago", region: "Southeast Asia", category: "APT Activity" },
  { id: "ci-2", title: "European Banking Sector Under Sustained DDoS Pressure", summary: "A coordinated distributed denial-of-service campaign has been targeting major European financial institutions since early morning hours. The attack vectors include DNS amplification, HTTP/2 rapid reset, and SYN floods peaking at 1.2 Tbps. Attribution analysis points to hacktivist groups with possible state backing. Multiple banks in Germany, France, and the Netherlands have reported service degradation.", source: "CyberWire Intelligence Brief", time: "1h ago", region: "Europe", category: "DDoS Campaign" },
  { id: "ci-3", title: "BlackVeil Ransomware — Technical Profile and Mitigation Brief", summary: "The newly identified BlackVeil ransomware family utilizes a double-extortion model with advanced anti-analysis techniques including VM detection and sandbox evasion. Initial access vectors include spear-phishing emails with weaponized DOCX files exploiting CVE-2025-21298. The group operates a dedicated leak site on Tor and has claimed 14 victims across the healthcare sector in the past week.", source: "Recorded Future", time: "2h ago", region: "Global", category: "Ransomware" },
  { id: "ci-4", title: "Fortinet VPN Zero-Day: Scope Assessment and Exposure Analysis", summary: "CISA has issued an emergency directive regarding CVE-2025-32756, a critical unauthenticated remote code execution vulnerability in FortiOS SSL-VPN. Shodan scans indicate approximately 340,000 internet-facing Fortinet appliances globally, with an estimated 87,000 running vulnerable firmware versions. Active exploitation has been confirmed in the wild targeting government and defense sector organizations.", source: "CISA / US-CERT", time: "3h ago", region: "Global", category: "Vulnerability" },
];

export const cyberRegionMentions: CyberRegionMention[] = [
  { region: "Europe", count: 847, change: 12.4, trending: true },
  { region: "Middle East", count: 623, change: 8.7, trending: true },
  { region: "Southeast Asia", count: 541, change: 15.2, trending: true },
  { region: "North America", count: 489, change: -2.1, trending: false },
  { region: "Turkey", count: 312, change: 6.3, trending: true },
  { region: "East Asia", count: 287, change: -1.8, trending: false },
  { region: "South Asia", count: 194, change: 3.4, trending: false },
  { region: "Africa", count: 128, change: 9.1, trending: true },
];
