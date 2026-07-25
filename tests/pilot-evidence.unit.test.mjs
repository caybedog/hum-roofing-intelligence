import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPilotEvidenceScope,
  phaseFourGateStatus,
} from "../app/foundation/pilot-evidence.mjs";

test("QA projects are separated from real Phase 4 evidence", () => {
  const projects = [
    { id: "real-1", is_test: false },
    { id: "qa-1", is_test: true },
  ];
  const scope = buildPilotEvidenceScope(projects);

  assert.deepEqual([...scope.realProjectIds], ["real-1"]);
  assert.deepEqual([...scope.testProjectIds], ["qa-1"]);
});

test("ten QA completions cannot unlock Round 5", () => {
  const projects = Array.from({ length: 10 }, (_, index) => ({
    id: `qa-${index}`,
    is_test: true,
  }));
  const enrollments = projects.map((project) => ({
    project_id: project.id,
  }));
  const quotes = projects.map((project) => ({
    project_id: project.id,
    status: "submitted",
  }));

  const status = phaseFourGateStatus({
    projects,
    enrollments,
    quotes,
    reasons: [{ project_id: "qa-1" }],
    feedback: [
      { project_id: "qa-1", audience: "homeowner" },
      { project_id: "qa-1", audience: "contractor" },
    ],
    criticalIssues: [],
  });

  assert.equal(status.realEnrollmentCount, 0);
  assert.equal(status.targetMet, false);
  assert.equal(status.everyRealProjectQuoted, false);
  assert.equal(status.hasReasons, false);
  assert.equal(status.hasHomeownerFeedback, false);
  assert.equal(status.hasContractorFeedback, false);
});
