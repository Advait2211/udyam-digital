// Converts the hackathon CSVs into small JSON files the app imports.
// Run: node scripts/build-data.mjs
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const out = path.join(root, "lib", "generated");
fs.mkdirSync(out, { recursive: true });

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const read = (f) => parseCSV(fs.readFileSync(path.join(dataDir, f), "utf8"));
const write = (f, v) => fs.writeFileSync(path.join(out, f), JSON.stringify(v));

// Catalogue
const catalogue = read("product_catalogue.csv").map((p) => ({
  id: p.product_id,
  category: p.category,
  name: p.product_name,
  description: p.description,
  unit: p.unit,
  priceMin: Number(p.price_min_inr_per_month),
  priceMax: Number(p.price_max_inr_per_month),
  setup: Number(p.one_time_setup_inr),
  minContract: Number(p.min_contract_months),
  tiers: p.available_city_tiers.split(";").map(Number),
  minEmployees: Number(p.min_employees),
  minSites: Number(p.min_sites),
  requiresGstin: p.requires_gstin === "Y",
  requiresOneOf: p.requires_one_of ? p.requires_one_of.split("|") : [],
  installDays: Number(p.typical_install_days),
  segments: p.target_segments.split(";"),
}));
write("catalogue.json", catalogue);

// Registries (server-side only)
const gst = {};
for (const r of read("mock_gstin_registry.csv")) {
  gst[r.gstin] = {
    legalName: r.legal_name,
    tradeName: r.trade_name,
    constitution: r.constitution,
    address: r.principal_place_of_business,
    state: r.state,
    registeredOn: r.registration_date,
    status: r.status,
  };
}
write("gstin_registry.json", gst);

const udyam = {};
for (const r of read("mock_udyam_registry.csv")) {
  udyam[r.udyam_number] = {
    name: r.enterprise_name,
    type: r.enterprise_type,
    activity: r.major_activity,
    nic: r.nic_description,
    state: r.state,
    city: r.city,
    registeredOn: r.date_of_registration,
  };
}
write("udyam_registry.json", udyam);

// Cities -> tier/state (from leads)
const cities = {};
for (const r of read("smb_leads.csv")) cities[r.city] = { tier: Number(r.city_tier), state: r.state };
write("cities.json", cities);

console.log(`catalogue ${catalogue.length} · gstin ${Object.keys(gst).length} · udyam ${Object.keys(udyam).length} · cities ${Object.keys(cities).length}`);
