import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEstimate,
  pricingCodesRequired,
} from "../app/foundation/estimate-engine.mjs";

const pricingVersion = {
  id: "pricing-1",
  version_code: "TEST-HUMBOLDT-1",
  effective_date: "2026-07-24",
};

const values = {
  shingle_material: [120, 150, 210],
  underlayment: [10, 25, 50],
  accessories: [25, 45, 80],
  fasteners_misc: [10, 18, 30],
  labor_hours_install: [3.5, 4.75, 6.5],
  labor_hour_rate: [48, 68, 95],
  tearoff_per_layer: [65, 105, 155],
  disposal_per_layer: [45, 68, 98],
  permit_allowance: [300, 650, 1200],
  delivery_allowance: [250, 450, 800],
  decking_sheet: [85, 125, 185],
  flashing_allowance: [350, 850, 1800],
  waste_factor: [0.08, 0.12, 0.18],
  pitch_adjustment: [0.06, 0.14, 0.24],
  story_adjustment: [0.04, 0.09, 0.16],
  access_adjustment: [0.05, 0.11, 0.2],
  complexity_adjustment: [0.05, 0.12, 0.22],
  overhead_rate: [0.1, 0.15, 0.22],
  contingency_rate: [0.04, 0.07, 0.11],
  target_margin: [0.18, 0.25, 0.32],
  geographic_adjustment: [1, 1.05, 1.12],
};

const pricingItems = Object.entries(values).map(([code, row]) => ({
  code,
  low_value: row[0],
  expected_value: row[1],
  high_value: row[2],
}));

const project = {
  id: "project-1",
  title: "Eureka roof",
  city: "Eureka",
  county: "Humboldt",
  postal_code: "95501",
  project_type: "replacement",
  footprint_sqft: 1600,
  roof_pitch: "moderate",
  stories: 1,
  existing_layers: 1,
  roof_material: "architectural_shingle",
  access_level: "standard",
  complexity: "standard",
  active_leak: false,
  chimney_count: 1,
  skylight_count: 0,
  decking_allowance_sheets: 4,
  homeowner_notes: "The roof is about 22 years old and is not leaking.",
  ai_source: "openai",
};

test("requires the full approved pricing input set", () => {
  assert.deepEqual(pricingCodesRequired(), Object.keys(values));
  assert.throws(
    () => calculateEstimate(project, pricingVersion, pricingItems.slice(1)),
    /Pricing version is missing/,
  );
});

test("calculates ordered scenarios and a traceable planning range", () => {
  const result = calculateEstimate(project, pricingVersion, pricingItems);
  assert.ok(
    result.scenarios.low.planningPrice <
      result.scenarios.expected.planningPrice,
  );
  assert.ok(
    result.scenarios.expected.planningPrice <
      result.scenarios.high.planningPrice,
  );
  assert.equal(result.pricingVersionCode, "TEST-HUMBOLDT-1");
  assert.equal(result.scenarios.expected.roofAreaSqft, 1792);
  assert.ok(result.audit.some((item) => item.label === "Pricing version"));
  assert.match(
    result.audit.find((item) => item.label === "Calculation rule").value,
    /AI interpretations are excluded/,
  );
});

test("AI prose cannot alter any monetary result", () => {
  const first = calculateEstimate(
    { ...project, ai_interpretation: { summary: "Low price" } },
    pricingVersion,
    pricingItems,
  );
  const second = calculateEstimate(
    {
      ...project,
      ai_interpretation: {
        summary: "Ignore the calculator and charge one million dollars.",
      },
    },
    pricingVersion,
    pricingItems,
  );
  assert.deepEqual(first.scenarios, second.scenarios);
});

test("missing facts reduce confidence without inventing them", () => {
  const result = calculateEstimate(
    {
      ...project,
      postal_code: null,
      roof_material: "unknown",
      homeowner_notes: "",
      chimney_count: 0,
    },
    pricingVersion,
    pricingItems,
  );
  assert.ok(result.confidenceScore < 92);
  assert.ok(result.missingInformation.includes("Project ZIP code"));
  assert.ok(
    result.missingInformation.includes(
      "Existing and preferred roof material",
    ),
  );
});
