import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeSummary,
  calculateQuoteBuilder,
} from "../app/foundation/quote-builder.mjs";

test("on-site measurements recalculate every quote category and selling price", () => {
  const result = calculateQuoteBuilder({
    roofAreaSqft: "2000",
    wastePercent: "10",
    existingLayers: "1",
    materialPerSquare: "150",
    crewSize: "4",
    laborDays: "3",
    hoursPerDay: "8",
    hourlyRate: "50",
    tearoffPerSquare: "55",
    disposalFee: "700",
    permitFee: "350",
    deliveryFee: "250",
    deckingSheets: "8",
    deckingSheetCost: "75",
    allowance: "500",
    other: "300",
    overheadPercent: "10",
    profitMarginPercent: "20",
  });

  assert.equal(result.roofingSquares, 22);
  assert.equal(result.materialAmount, 3300);
  assert.equal(result.laborAmount, 4800);
  assert.equal(result.tearoffDisposalAmount, 1910);
  assert.equal(result.permitDeliveryAmount, 600);
  assert.equal(result.allowanceAmount, 1100);
  assert.equal(result.directCost, 12010);
  assert.equal(result.overheadAmount, 1201);
  assert.equal(result.profitAmount, 3302.75);
  assert.equal(result.totalAmount, 16513.75);
});

test("target margin is calculated from selling price rather than treated as markup", () => {
  const result = calculateQuoteBuilder({
    roofAreaSqft: 1000,
    wastePercent: 0,
    existingLayers: 1,
    materialPerSquare: 100,
    crewSize: 0,
    laborDays: 0,
    hoursPerDay: 0,
    hourlyRate: 0,
    tearoffPerSquare: 0,
    disposalFee: 0,
    permitFee: 0,
    deliveryFee: 0,
    deckingSheets: 0,
    deckingSheetCost: 0,
    allowance: 0,
    other: 0,
    overheadPercent: 0,
    profitMarginPercent: 20,
  });

  assert.equal(result.directCost, 1000);
  assert.equal(result.profitAmount, 250);
  assert.equal(result.totalAmount, 1250);
});

test("scope selections produce a readable contractor scope", () => {
  const summary = buildScopeSummary({
    materialSystem: "architectural_shingles",
    roofingSquares: 18.5,
    selections: ["tear_off", "underlayment", "roofing", "cleanup"],
  });

  assert.match(summary, /18\.5 roofing squares/);
  assert.match(summary, /Remove and dispose/);
  assert.match(summary, /architectural shingles/);
  assert.match(summary, /cleanup/);
});
