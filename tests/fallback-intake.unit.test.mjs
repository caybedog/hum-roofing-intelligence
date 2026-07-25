import assert from "node:assert/strict";
import test from "node:test";
import { deterministicIntake } from "../app/foundation/fallback-intake.mjs";

test("extracts only explicitly stated roofing facts", () => {
  const result = deterministicIntake(
    "We need a replacement for a two-story asphalt roof. It is about 1,600 square feet, has a 6:12 pitch and one roof layer. There is no active leak.",
  );
  assert.equal(result.project_type, "replacement");
  assert.equal(result.urgency, "no_active_leak");
  assert.equal(result.can_estimate, true);
  assert.ok(result.facts.some((fact) => fact.field === "reported_area"));
  assert.ok(result.facts.some((fact) => fact.field === "reported_pitch"));
  assert.ok(result.facts.every((fact) => fact.source_text.length > 0));
  assert.ok(
    result.confirmed_updates.some(
      (update) =>
        update.field === "footprint_sqft" && update.value === "1600",
    ),
  );
  assert.equal(result.follow_up_questions.length <= 1, true);
});

test("stays cautious when the narrative is incomplete", () => {
  const result = deterministicIntake("I think my roof needs some help soon.");
  assert.equal(result.project_type, "unknown");
  assert.equal(result.can_estimate, false);
  assert.ok(result.missing_information.includes("roof pitch"));
  assert.ok(result.follow_up_questions.length > 0);
});

test("defers an unknown answer and moves to a different question", () => {
  const result = deterministicIntake("I’m not sure.", {
    current_question: "roof_pitch",
    confirmed_fields: ["project_type", "active_leak", "footprint_sqft"],
  });
  assert.ok(result.deferred_fields.includes("roof_pitch"));
  assert.notEqual(result.next_question.field, "roof_pitch");
});

test("never asks a homeowner to guess decking sheets", () => {
  const result = deterministicIntake("We need a roof replacement.");
  assert.equal(
    result.follow_up_questions.some((question) =>
      question.toLowerCase().includes("decking"),
    ),
    false,
  );
  assert.equal(
    result.confirmed_updates.some(
      (update) => update.field === "decking_allowance_sheets",
    ),
    false,
  );
});

test("clips oversized text and never generates a price", () => {
  const result = deterministicIntake(`replace roof ${"x".repeat(6000)}`);
  assert.equal("price" in result, false);
  assert.ok(result.summary.length < 500);
});
