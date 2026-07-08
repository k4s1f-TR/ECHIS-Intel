// Air Track static enrichment DB builder.
//
// Downloads two community datasets and emits compact JSON consumed
// server-side by lib/airtrack/staticDb.ts:
//
//   data/airtrack/type-names.json   ICAO type code -> full model name
//     source: Mictronics readsb-protobuf webapp DB (community aircraft DB)
//   data/airtrack/watchlist.json    hex -> [operator, typeName, category]
//     source: sdr-enthusiasts/plane-alert-db (~16k "interesting aircraft")
//
// Run manually when refreshing the data (outputs are committed):
//   node scripts/airtrack/build-static-db.mjs
//
// No dependencies — plain Node 18+ (global fetch).

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TYPES_URL =
  "https://raw.githubusercontent.com/Mictronics/readsb-protobuf/dev/webapp/src/db/types.json";
const PLANE_ALERT_URL =
  "https://raw.githubusercontent.com/sdr-enthusiasts/plane-alert-db/main/plane-alert-db.csv";

const outDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "airtrack",
);

// Minimal RFC-4180-ish CSV line splitter (handles quoted fields with commas).
function splitCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

console.log("Downloading type names …");
const typesRaw = JSON.parse(await fetchText(TYPES_URL));
const typeNames = {};
for (const [code, value] of Object.entries(typesRaw)) {
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
    typeNames[code] = value[0];
  }
}
console.log(`  ${Object.keys(typeNames).length} type codes`);

console.log("Downloading plane-alert-db …");
const csv = await fetchText(PLANE_ALERT_URL);
const lines = csv.split(/\r?\n/);
// Header: $ICAO,$Registration,$Operator,$Type,$ICAO Type,#CMPG,$Tag 1,$#Tag 2,$#Tag 3,Category,$#Link
const watchlist = {};
let skipped = 0;
for (let i = 1; i < lines.length; i += 1) {
  const line = lines[i];
  if (!line) continue;
  const f = splitCsvLine(line);
  const hex = f[0]?.trim().toLowerCase();
  if (!hex || !/^[0-9a-f]{6}$/.test(hex)) {
    skipped += 1;
    continue;
  }
  const operator = f[2]?.trim() || "";
  const typeName = f[3]?.trim() || "";
  const category = f[9]?.trim() || "";
  // Drop rows whose category cell is junk (e.g. a stray URL).
  if (!category || category.startsWith("http")) {
    skipped += 1;
    continue;
  }
  watchlist[hex] = [operator, typeName, category];
}
console.log(
  `  ${Object.keys(watchlist).length} watchlist aircraft (${skipped} rows skipped)`,
);

await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "type-names.json"),
  JSON.stringify(typeNames),
);
await writeFile(
  path.join(outDir, "watchlist.json"),
  JSON.stringify(watchlist),
);
console.log(`Wrote ${outDir}\\type-names.json and watchlist.json`);
