const limitationNote =
  "This is a planning range, not a contractor offer. Public residential quotes are sparse outside roofing, incorporated cities have different permits, concealed conditions cannot be confirmed from photos, and every category remains subject to calibration from consented quotes and final invoices.";

export const bundledPlannerCatalog = {
  id: "6b974961-716b-47b9-80d3-647e70ffeaff",
  version_code: "HUM-HC-HOME-2026.07-BETA",
  effective_date: "2026-07-26",
  verified_at: "2026-07-26",
  limitation_note: limitationNote,
};

type PricingSeed = [
  id: string,
  category: string,
  variant: string,
  label: string,
  unit: string,
  low: number,
  expected: number,
  high: number,
  minimum: number,
  permitLow: number,
  permitExpected: number,
  permitHigh: number,
  confidence: "low" | "medium",
  sourceKeys: string[],
  included: string,
];

const seeds: PricingSeed[] = [
  ["42e187bd-99f7-4404-bac9-a72cc8041335", "bathroom", "remodel", "Bathroom remodel", "room", 20000, 40000, 75000, 20000, 500, 1500, 4000, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "typical fixture, finish, labor, overhead and profit allowances; layout changes and hidden damage vary"],
  ["7f7548bd-1582-4bb7-a20d-048f093f7950", "concrete", "flatwork", "Concrete flatwork", "square_foot", 14, 23, 40, 2500, 0, 200, 1000, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary excavation, base, forms, reinforcing allowance, concrete and finishing"],
  ["c5600dfc-28b5-49d3-8c04-6745d8109159", "deck", "new_deck", "New residential deck", "square_foot", 55, 85, 135, 8000, 600, 1600, 4500, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "standard framing and decking with ordinary guardrail allowance; engineering and steep sites vary"],
  ["fbe0ab2e-b138-488c-9eeb-16f8dcd95207", "doors", "exterior_door", "Exterior entry door replacement", "each", 1900, 3200, 6000, 1900, 0, 200, 800, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "pre-hung exterior door, ordinary hardware allowance, removal, weather sealing and trim"],
  ["496a90ef-d1c4-499d-b48c-ec771bd29d23", "electrical", "fixture_or_circuit", "Electrical fixture or circuit work", "each", 500, 1000, 2200, 500, 0, 200, 900, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary device or branch-circuit allowance, service labor and small materials"],
  ["dacac010-88e0-4a0b-9ce8-2bc2792f0553", "electrical", "panel", "Electrical service panel replacement", "each", 4500, 7500, 12000, 4500, 500, 1200, 3000, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "typical residential panel, service labor and ordinary permit allowance; utility work varies"],
  ["e9865867-a695-4191-b814-dc668c53e8bd", "fencing", "wood_fence", "Wood privacy fence", "linear_foot", 45, 70, 110, 2500, 0, 150, 900, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary wood privacy fence, posts, concrete, removal allowance and labor"],
  ["b20e9249-f65c-4eda-b940-1ffd73632e06", "flooring", "installed", "Installed finish flooring", "square_foot", 9, 16, 30, 1800, 0, 0, 0, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "mid-range finish material, ordinary removal, basic underlayment and installation"],
  ["14cc4aa8-d919-464d-9ae7-43986f381898", "gutters", "seamless_aluminum", "Seamless aluminum gutters", "linear_foot", 16, 22, 32, 1200, 0, 0, 300, "low", ["cslb-humboldt-c39-20260726", "lost-coast-roofing-directory-20260726", "hum-admin-assumptions-20260726"], "standard 5- or 6-inch gutter, hangers, ordinary downspout allowance and installation"],
  ["dd5c4461-0acf-4c9a-b2ab-7e1c8fcfce6c", "hvac", "heat_pump", "Heat-pump system", "each", 14000, 22000, 35000, 14000, 400, 1000, 2500, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "typical residential equipment, standard installation and startup; electrical or duct upgrades vary"],
  ["4a16bb93-58bd-4012-bb10-fea0f4aad494", "kitchen", "remodel", "Kitchen remodel", "room", 40000, 75000, 150000, 40000, 700, 2000, 6000, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "mid-range cabinets, counters, finishes and trade labor; appliances and structural changes vary"],
  ["6f6b4685-9571-4dad-b683-f134efe6bbff", "landscaping", "labor_project", "Landscape labor and installation", "labor_hour", 85, 125, 180, 1500, 0, 0, 300, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "loaded crew labor allowance; plants, equipment, soil and disposal are separate facts"],
  ["642959cf-6c3c-4ac8-9f39-94216fde9bf1", "painting", "exterior", "Exterior painting", "square_foot", 4, 7, 11, 4000, 0, 150, 700, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "washing, ordinary prep, spot prime and finish coats; lead or major rot excluded"],
  ["81c20249-fa92-484c-b993-703d1e944db2", "painting", "interior", "Interior painting", "square_foot", 3, 5, 8, 1800, 0, 0, 0, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary prep, two finish coats, standard wall and ceiling access"],
  ["6c43699d-9688-4cb0-8f1f-cfd5429357a9", "plumbing", "fixture_work", "Plumbing fixture replacement or repair", "each", 450, 950, 2000, 450, 0, 150, 650, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary fixture allowance, connections, service labor and small materials"],
  ["894f9688-666c-451a-b25b-ad19f65b0798", "plumbing", "repipe", "Whole-home repipe", "square_foot", 7, 12, 20, 8000, 500, 1200, 3000, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "accessible domestic water piping and ordinary wall access; finish repair varies"],
  ["4ceaadf7-a6c3-4294-9595-157d80c52f13", "plumbing", "water_heater", "Water heater replacement", "each", 2200, 3600, 6200, 2200, 200, 500, 1400, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "standard residential unit, removal, ordinary connections, labor and disposal"],
  ["90b95b6f-8ffc-4fd1-b953-fef354cf861f", "roofing", "asphalt_replacement", "Asphalt roof replacement", "square_foot", 7.75, 10.25, 14.5, 6500, 350, 700, 1600, "medium", ["lowes-gaf-hdz-20260726", "home-depot-underlayment-20260726", "hwma-fees-fy2025-26", "humboldt-reroof-requirements-20260726", "california-edd-roofers-20260726"], "tear-off allowance, architectural shingles, underlayment, standard flashing, disposal, labor, overhead and profit"],
  ["2fdab6b1-68b7-4bd3-a0fc-2c7634e76075", "siding", "replacement", "Siding replacement", "square_foot", 14, 22, 36, 10000, 350, 900, 2200, "low", ["cslb-humboldt-c39-20260726", "california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "ordinary removal, weather barrier, mid-range siding, trim allowance, labor, overhead and profit"],
  ["65d73013-9a30-4fb4-abf1-eb8cffce9a08", "windows", "standard_replacement", "Standard replacement windows", "each", 1100, 1650, 2600, 1100, 0, 250, 900, "low", ["california-edd-roofers-20260726", "hum-admin-assumptions-20260726"], "mid-grade window, removal, ordinary flashing and interior/exterior trim touch-up"],
];

export const bundledPlannerItems = seeds.map(
  ([
    id,
    category,
    variant,
    label,
    unit,
    low,
    expected,
    high,
    minimum,
    permitLow,
    permitExpected,
    permitHigh,
    confidence,
    sourceKeys,
    included,
  ]) => ({
    id,
    catalog_id: bundledPlannerCatalog.id,
    category,
    variant,
    label,
    unit,
    low_unit_cost: low,
    expected_unit_cost: expected,
    high_unit_cost: high,
    minimum_job: minimum,
    permit_low: permitLow,
    permit_expected: permitExpected,
    permit_high: permitHigh,
    confidence,
    source_keys: sourceKeys,
    assumptions: { included },
  }),
);

export function bundledPlannerItem(category: string, variant: string) {
  return bundledPlannerItems.find(
    (item) => item.category === category && item.variant === variant,
  );
}
