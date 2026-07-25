export function buildPilotEvidenceScope(
  projects: Array<{ id: string; is_test: boolean }>,
): {
  realProjectIds: Set<string>;
  testProjectIds: Set<string>;
};

export function onlyRealProjectRows<T extends { project_id: string }>(
  rows: T[],
  realProjectIds: Set<string>,
): T[];

export function phaseFourGateStatus(input: {
  projects: Array<{ id: string; is_test: boolean }>;
  enrollments: Array<{ project_id: string }>;
  quotes: Array<{ project_id: string; status: string }>;
  reasons: Array<{ project_id: string }>;
  feedback: Array<{ project_id: string; audience: string }>;
  criticalIssues: unknown[];
}): {
  realEnrollmentCount: number;
  realQuoteCount: number;
  targetMet: boolean;
  everyRealProjectQuoted: boolean;
  hasReasons: boolean;
  hasHomeownerFeedback: boolean;
  hasContractorFeedback: boolean;
  hasNoCriticalIssues: boolean;
};
