import type { Agency } from "@/types/intel-watch";

export const agencies: Agency[] = [
  // ── Intelligence: North America ──
  { id: "cia", name: "CIA", fullName: "Central Intelligence Agency", type: "Intelligence", region: "North America", city: "Washington D.C.", country: "United States", lat: 38.90, lng: -77.04, activityLevel: 312 },
  { id: "nsa", name: "NSA", fullName: "National Security Agency", type: "Intelligence", region: "North America", city: "Fort Meade", country: "United States", lat: 39.11, lng: -76.77, activityLevel: 287 },
  { id: "dia", name: "DIA", fullName: "Defense Intelligence Agency", type: "Intelligence", region: "North America", city: "Washington D.C.", country: "United States", lat: 38.87, lng: -77.01, activityLevel: 145 },
  { id: "csis", name: "CSIS", fullName: "Canadian Security Intelligence Service", type: "Intelligence", region: "North America", city: "Ottawa", country: "Canada", lat: 45.42, lng: -75.69, activityLevel: 98 },

  // ── Intelligence: Western & Central Europe ──
  { id: "mi6", name: "MI6", fullName: "Secret Intelligence Service", type: "Intelligence", region: "Western & Central Europe", city: "London", country: "United Kingdom", lat: 51.49, lng: -0.12, activityLevel: 278 },
  { id: "gchq", name: "GCHQ", fullName: "Government Communications Headquarters", type: "Intelligence", region: "Western & Central Europe", city: "Cheltenham", country: "United Kingdom", lat: 51.90, lng: -2.09, activityLevel: 241 },
  { id: "bnd", name: "BND", fullName: "Bundesnachrichtendienst", type: "Intelligence", region: "Western & Central Europe", city: "Berlin", country: "Germany", lat: 52.52, lng: 13.40, activityLevel: 189 },
  { id: "dgse", name: "DGSE", fullName: "Direction Générale de la Sécurité Extérieure", type: "Intelligence", region: "Western & Central Europe", city: "Paris", country: "France", lat: 48.86, lng: 2.35, activityLevel: 176 },
  { id: "aise", name: "AISE", fullName: "Agenzia Informazioni e Sicurezza Esterna", type: "Intelligence", region: "Western & Central Europe", city: "Rome", country: "Italy", lat: 41.90, lng: 12.50, activityLevel: 87 },

  // ── Intelligence: Eastern Europe ──
  { id: "aw", name: "AW", fullName: "Agencja Wywiadu", type: "Intelligence", region: "Eastern Europe", city: "Warsaw", country: "Poland", lat: 52.23, lng: 21.01, activityLevel: 76 },
  { id: "hur", name: "HUR", fullName: "Main Directorate of Intelligence of Ukraine", type: "Intelligence", region: "Eastern Europe", city: "Kyiv", country: "Ukraine", lat: 50.45, lng: 30.52, activityLevel: 134 },

  // ── Intelligence: Eurasia & Russia ──
  { id: "fsb", name: "FSB", fullName: "Federal Security Service of Russia", type: "Intelligence", region: "Eurasia & Russia", city: "Moscow", country: "Russia", lat: 55.76, lng: 37.62, activityLevel: 245 },
  { id: "svr", name: "SVR", fullName: "Foreign Intelligence Service of Russia", type: "Intelligence", region: "Eurasia & Russia", city: "Moscow", country: "Russia", lat: 55.74, lng: 37.58, activityLevel: 218 },
  { id: "gru", name: "GRU", fullName: "Main Intelligence Directorate", type: "Intelligence", region: "Eurasia & Russia", city: "Moscow", country: "Russia", lat: 55.72, lng: 37.65, activityLevel: 201 },

  // ── Intelligence: MENA ──
  { id: "mit", name: "MİT", fullName: "Millî İstihbarat Teşkilatı", type: "Intelligence", region: "MENA", city: "Ankara", country: "Türkiye", lat: 39.93, lng: 32.86, activityLevel: 153 },
  { id: "mossad", name: "Mossad", fullName: "Institute for Intelligence and Special Operations", type: "Intelligence", region: "MENA", city: "Tel Aviv", country: "Israel", lat: 32.08, lng: 34.78, activityLevel: 198 },
  { id: "gid", name: "GID", fullName: "General Intelligence Directorate", type: "Intelligence", region: "MENA", city: "Amman", country: "Jordan", lat: 31.96, lng: 35.95, activityLevel: 112 },
  { id: "mois", name: "MOIS", fullName: "Ministry of Intelligence and Security", type: "Intelligence", region: "MENA", city: "Tehran", country: "Iran", lat: 35.69, lng: 51.39, activityLevel: 174 },
  { id: "gis-eg", name: "GIS", fullName: "General Intelligence Service", type: "Intelligence", region: "MENA", city: "Cairo", country: "Egypt", lat: 30.04, lng: 31.24, activityLevel: 108 },
  { id: "sia-uae", name: "SIA", fullName: "State Intelligence Agency (UAE)", type: "Intelligence", region: "MENA", city: "Abu Dhabi", country: "UAE", lat: 24.45, lng: 54.37, activityLevel: 143 },

  // ── Intelligence: South & East Asia ──
  { id: "mss", name: "MSS", fullName: "Ministry of State Security", type: "Intelligence", region: "South & East Asia", city: "Beijing", country: "China", lat: 39.91, lng: 116.39, activityLevel: 264 },
  { id: "raw", name: "RAW", fullName: "Research and Analysis Wing", type: "Intelligence", region: "South & East Asia", city: "New Delhi", country: "India", lat: 28.61, lng: 77.21, activityLevel: 167 },
  { id: "isi", name: "ISI", fullName: "Inter-Services Intelligence", type: "Intelligence", region: "South & East Asia", city: "Islamabad", country: "Pakistan", lat: 33.72, lng: 73.06, activityLevel: 162 },
  { id: "nis-kr", name: "NIS", fullName: "National Intelligence Service", type: "Intelligence", region: "South & East Asia", city: "Seoul", country: "South Korea", lat: 37.57, lng: 126.98, activityLevel: 119 },
  { id: "psia", name: "PSIA", fullName: "Public Security Intelligence Agency", type: "Intelligence", region: "South & East Asia", city: "Tokyo", country: "Japan", lat: 35.69, lng: 139.69, activityLevel: 78 },

  // ── Intelligence: Southeast Asia & Oceania ──
  { id: "asis", name: "ASIS", fullName: "Australian Secret Intelligence Service", type: "Intelligence", region: "Southeast Asia & Oceania", city: "Canberra", country: "Australia", lat: -35.28, lng: 149.13, activityLevel: 92 },
  { id: "nica", name: "NICA", fullName: "National Intelligence Coordinating Agency", type: "Intelligence", region: "Southeast Asia & Oceania", city: "Manila", country: "Philippines", lat: 14.60, lng: 120.98, activityLevel: 54 },

  // ── Intelligence: Latin America & Africa ──
  { id: "abin", name: "ABIN", fullName: "Agência Brasileira de Inteligência", type: "Intelligence", region: "Latin America & Africa", city: "Brasília", country: "Brazil", lat: -15.78, lng: -47.93, activityLevel: 67 },
  { id: "ssa", name: "SSA", fullName: "State Security Agency", type: "Intelligence", region: "Latin America & Africa", city: "Pretoria", country: "South Africa", lat: -25.74, lng: 28.19, activityLevel: 61 },

  // ── Supranational ──
  { id: "nato-intel", name: "NATO Intl", fullName: "NATO Intelligence Enterprise", type: "Supranational", region: "Supranational", city: "Brussels", country: "Belgium", lat: 50.88, lng: 4.50, activityLevel: 156 },
  { id: "eu-intcen", name: "EU INTCEN", fullName: "EU Intelligence and Situation Centre", type: "Supranational", region: "Supranational", city: "Brussels", country: "Belgium", lat: 50.85, lng: 4.35, activityLevel: 123 },
  { id: "interpol", name: "Interpol", fullName: "International Criminal Police Organization", type: "Supranational", region: "Supranational", city: "Lyon", country: "France", lat: 45.75, lng: 4.85, activityLevel: 188 },

  // ── Diplomatic: Major Powers ──
  { id: "state-dept", name: "State Dept", fullName: "U.S. Department of State", type: "Diplomatic", region: "North America", city: "Washington D.C.", country: "United States", lat: 38.89, lng: -77.05, activityLevel: 234 },
  { id: "fcdo", name: "FCDO", fullName: "Foreign, Commonwealth & Development Office", type: "Diplomatic", region: "Western & Central Europe", city: "London", country: "United Kingdom", lat: 51.50, lng: -0.13, activityLevel: 198 },
  { id: "auswaertiges", name: "Auswärtiges", fullName: "Auswärtiges Amt", type: "Diplomatic", region: "Western & Central Europe", city: "Berlin", country: "Germany", lat: 52.51, lng: 13.38, activityLevel: 167 },
  { id: "quai-dorsay", name: "Quai d'Orsay", fullName: "Ministère de l'Europe et des Affaires Étrangères", type: "Diplomatic", region: "Western & Central Europe", city: "Paris", country: "France", lat: 48.86, lng: 2.31, activityLevel: 154 },
  { id: "mid-russia", name: "MID Russia", fullName: "Ministry of Foreign Affairs of Russia", type: "Diplomatic", region: "Eurasia & Russia", city: "Moscow", country: "Russia", lat: 55.73, lng: 37.58, activityLevel: 189 },
  { id: "mofa-china", name: "MOFA China", fullName: "Ministry of Foreign Affairs of China", type: "Diplomatic", region: "South & East Asia", city: "Beijing", country: "China", lat: 39.92, lng: 116.40, activityLevel: 176 },

  // ── Diplomatic: Regional ──
  { id: "tc-disisleri", name: "T.C. Dışişleri", fullName: "T.C. Dışişleri Bakanlığı", type: "Diplomatic", region: "MENA", city: "Ankara", country: "Türkiye", lat: 39.92, lng: 32.85, activityLevel: 143 },
  { id: "mea-india", name: "MEA India", fullName: "Ministry of External Affairs", type: "Diplomatic", region: "South & East Asia", city: "New Delhi", country: "India", lat: 28.60, lng: 77.20, activityLevel: 112 },
  { id: "mofa-japan", name: "MOFA Japan", fullName: "Ministry of Foreign Affairs of Japan", type: "Diplomatic", region: "South & East Asia", city: "Tokyo", country: "Japan", lat: 35.68, lng: 139.75, activityLevel: 134 },
  { id: "mofa-saudi", name: "MOFA Saudi", fullName: "Ministry of Foreign Affairs of Saudi Arabia", type: "Diplomatic", region: "MENA", city: "Riyadh", country: "Saudi Arabia", lat: 24.69, lng: 46.72, activityLevel: 121 },
  { id: "mfa-israel", name: "MFA Israel", fullName: "Ministry of Foreign Affairs of Israel", type: "Diplomatic", region: "MENA", city: "Jerusalem", country: "Israel", lat: 31.77, lng: 35.21, activityLevel: 156 },
  { id: "mfa-iran", name: "MFA Iran", fullName: "Ministry of Foreign Affairs of Iran", type: "Diplomatic", region: "MENA", city: "Tehran", country: "Iran", lat: 35.70, lng: 51.42, activityLevel: 145 },

  // ── Diplomatic: Multilateral ──
  { id: "eeas", name: "EEAS", fullName: "European External Action Service", type: "Diplomatic", region: "Supranational", city: "Brussels", country: "Belgium", lat: 50.84, lng: 4.38, activityLevel: 134 },
  { id: "un-dpa", name: "UN DPA", fullName: "UN Department of Political and Peacebuilding Affairs", type: "Diplomatic", region: "Supranational", city: "New York", country: "United States", lat: 40.75, lng: -73.98, activityLevel: 98 },
  { id: "arab-league", name: "Arab League", fullName: "Arab League Secretariat", type: "Diplomatic", region: "MENA", city: "Cairo", country: "Egypt", lat: 30.06, lng: 31.22, activityLevel: 76 },
];
