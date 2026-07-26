import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlannerEstimate,
  formatPlannerCurrency,
} from "../app/planner/estimate-engine.mjs";

const catalog = {
  id: "catalog-1",
  version_code: "HUM-HC-HOME-TEST",
  effective_date: "2026-07-26",
  verified_at: "2026-07-26",
  limitation_note: "Planning baseline pending consented quote calibration.",
};

const item = {
  id: "item-1",
  category: "gutters",
  variant: "seamless_aluminum",
  label: "Seamless aluminum gutters",
  unit: "linear_foot",
  low_unit_cost: 16,
  expected_unit_cost: 22,
  high_unit_cost: 32,
  minimum_job: 1200,
  permit_low: 0,
  permit_expected: 0,
  permit_high: 300,
  confidence: "low",
  source_keys: ["public-source", "explicit-assumption"],
  assumptions: {
    included: "standard gutters, hangers, ordinary downspouts and installation",
  },
};

const guidedInput = {
  mode: "guided",
  category: "gutters",
  variant: "seamless_aluminum",
  quantity: 160,
  access: "normal",
  condition: "typical",
  complexity: "standard",
  unknownCount: 0,
  extraMaterialCost: 0,
};

test("calculates an ordered versioned planning range", () => {
  const result = calculatePlannerEstimate({
    input: guidedInput,
    item,
    catalog,
  });
  assert.ok(result.totals.low < result.totals.expected);
  assert.ok(result.totals.expected < result.totals.high);
  assert.equal(result.catalog.versionCode, "HUM-HC-HOME-TEST");
  assert.equal(result.quantity, 160);
  assert.equal(result.confidence, "low");
  assert.ok(result.lineItems.some((row) => row.label.includes("baseline")));
});

test("unknowns and photo mode widen the planning range", () => {
  const guided = calculatePlannerEstimate({
    input: guidedInput,
    item,
    catalog,
  });
  const photo = calculatePlannerEstimate({
    input: {
      ...guidedInput,
      mode: "photo",
      access: "unknown",
      condition: "unknown",
      complexity: "unknown",
      unknownCount: 3,
    },
    item,
    catalog,
  });
  assert.ok(photo.totals.low <= guided.totals.low);
  assert.ok(photo.totals.high > guided.totals.high);
  assert.ok(photo.unknowns.length >= 4);
});

test("homeowner-entered materials are carried without being invented", () => {
  const result = calculatePlannerEstimate({
    input: { ...guidedInput, extraMaterialCost: 3500 },
    item,
    catalog,
  });
  assert.ok(
    result.lineItems.some(
      (row) => row.label === "Homeowner-entered material allowance",
    ),
  );
  assert.ok(result.totals.expected > 3500);
});

test("rejects unsupported category and variant combinations", () => {
  assert.throws(
    () =>
      calculatePlannerEstimate({
        input: { ...guidedInput, category: "roofing" },
        item,
        catalog,
      }),
    /No approved pricing item/,
  );
});

test("formats rounded homeowner-facing currency", () => {
  assert.equal(formatPlannerCurrency(12345), "$12,345");
});
