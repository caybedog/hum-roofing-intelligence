export function buildPilotEvidenceScope(projects) {
  const realProjectIds = new Set();
  const testProjectIds = new Set();

  for (const project of projects) {
    if (project.is_test) testProjectIds.add(project.id);
    else realProjectIds.add(project.id);
  }

  return { realProjectIds, testProjectIds };
}

export function onlyRealProjectRows(rows, realProjectIds) {
  return rows.filter((row) => realProjectIds.has(row.project_id));
}

export function phaseFourGateStatus({
  projects,
  enrollments,
  quotes,
  reasons,
  feedback,
  criticalIssues,
}) {
  const { realProjectIds } = buildPilotEvidenceScope(projects);
  const realEnrollments = onlyRealProjectRows(enrollments, realProjectIds);
  const realQuotes = onlyRealProjectRows(
    quotes.filter((quote) => quote.status === "submitted"),
    realProjectIds,
  );
  const realReasons = onlyRealProjectRows(reasons, realProjectIds);
  const realFeedback = onlyRealProjectRows(feedback, realProjectIds);
  const quotedProjects = new Set(realQuotes.map((quote) => quote.project_id));

  return {
    realEnrollmentCount: realEnrollments.length,
    realQuoteCount: quotedProjects.size,
    targetMet: realEnrollments.length >= 10,
    everyRealProjectQuoted:
      realEnrollments.length >= 10 &&
      realEnrollments.every((item) => quotedProjects.has(item.project_id)),
    hasReasons: realReasons.length > 0,
    hasHomeownerFeedback: realFeedback.some(
      (item) => item.audience === "homeowner",
    ),
    hasContractorFeedback: realFeedback.some(
      (item) => item.audience === "contractor",
    ),
    hasNoCriticalIssues: criticalIssues.length === 0,
  };
}
