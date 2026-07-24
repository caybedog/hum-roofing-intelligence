"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  ContractorQuote,
  ContractorReview,
  EstimateRecord,
  PilotContractorProfile,
  PilotEnrollment,
  PilotEvent,
  PilotFeedback,
  PilotInvitation,
  PilotOutcome,
  PilotSupportIssue,
  PricingObservation,
  Profile,
  Project,
  QuoteDifferenceReason,
} from "./types";
import styles from "./foundation.module.css";

type QuoteDraft = {
  material: string;
  labor: string;
  tearoffDisposal: string;
  permitDelivery: string;
  allowance: string;
  other: string;
  scope: string;
  exclusions: string;
  reference: string;
  validUntil: string;
  reasonCode: QuoteDifferenceReason["reason_code"];
  reasonDirection: QuoteDifferenceReason["direction"];
  reasonAmount: string;
  reasonExplanation: string;
};

const blankQuote: QuoteDraft = {
  material: "",
  labor: "",
  tearoffDisposal: "",
  permitDelivery: "",
  allowance: "",
  other: "",
  scope: "",
  exclusions: "",
  reference: "",
  validUntil: "",
  reasonCode: "scope_added",
  reasonDirection: "higher",
  reasonAmount: "",
  reasonExplanation: "",
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export default function PilotWorkspace({ profile }: { profile: Profile }) {
  const supabase = getSupabaseBrowserClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [enrollments, setEnrollments] = useState<PilotEnrollment[]>([]);
  const [contractorProfiles, setContractorProfiles] = useState<
    PilotContractorProfile[]
  >([]);
  const [invitations, setInvitations] = useState<PilotInvitation[]>([]);
  const [quotes, setQuotes] = useState<ContractorQuote[]>([]);
  const [reasons, setReasons] = useState<QuoteDifferenceReason[]>([]);
  const [feedback, setFeedback] = useState<PilotFeedback[]>([]);
  const [outcomes, setOutcomes] = useState<PilotOutcome[]>([]);
  const [issues, setIssues] = useState<PilotSupportIssue[]>([]);
  const [events, setEvents] = useState<PilotEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviews, setReviews] = useState<ContractorReview[]>([]);
  const [observations, setObservations] = useState<PricingObservation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(blankQuote);
  const [feedbackDraft, setFeedbackDraft] = useState({
    understanding: "4",
    usefulness: "4",
    ease: "4",
    text: "",
  });
  const [outcomeDraft, setOutcomeDraft] = useState({
    acceptedQuoteId: "",
    finalAmount: "",
    changeOrders: "",
    status: "undecided" as PilotOutcome["outcome_status"],
    notes: "",
  });
  const [issueDraft, setIssueDraft] = useState({
    category: "usability" as PilotSupportIssue["category"],
    severity: "normal" as PilotSupportIssue["severity"],
    description: "",
  });

  const loadData = useCallback(async () => {
    setError("");
    const [
      projectResult,
      estimateResult,
      enrollmentResult,
      contractorProfileResult,
      invitationResult,
      quoteResult,
      reasonResult,
      feedbackResult,
      outcomeResult,
      issueResult,
      eventResult,
      profileResult,
      reviewResult,
      observationResult,
    ] = await Promise.all([
      supabase.from("projects").select("*").order("updated_at", { ascending: false }),
      supabase.from("estimates").select("*").order("created_at", { ascending: false }),
      supabase
        .from("pilot_enrollments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("pilot_contractor_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("pilot_invitations")
        .select("id,project_id,created_by,expires_at,accepted_by,accepted_at,revoked_at,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("contractor_quotes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("quote_difference_reasons")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("pilot_feedback")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("pilot_outcomes")
        .select("*")
        .order("recorded_at", { ascending: false }),
      supabase
        .from("pilot_support_issues")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("pilot_events")
        .select("*")
        .order("created_at", { ascending: false }),
      profile.role === "administrator"
        ? supabase.from("profiles").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      profile.role === "administrator"
        ? supabase
            .from("contractor_reviews")
            .select("*")
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      profile.role === "administrator"
        ? supabase
            .from("pricing_observations")
            .select("*")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const firstError = [
      projectResult.error,
      estimateResult.error,
      enrollmentResult.error,
      contractorProfileResult.error,
      invitationResult.error,
      quoteResult.error,
      reasonResult.error,
      feedbackResult.error,
      outcomeResult.error,
      issueResult.error,
      eventResult.error,
      profileResult.error,
      reviewResult.error,
      observationResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
    }

    const projectRows = (projectResult.data ?? []) as Project[];
    setProjects(projectRows);
    setEstimates((estimateResult.data ?? []) as EstimateRecord[]);
    setEnrollments((enrollmentResult.data ?? []) as PilotEnrollment[]);
    setContractorProfiles(
      (contractorProfileResult.data ?? []) as PilotContractorProfile[],
    );
    setInvitations((invitationResult.data ?? []) as PilotInvitation[]);
    setQuotes((quoteResult.data ?? []) as ContractorQuote[]);
    setReasons((reasonResult.data ?? []) as QuoteDifferenceReason[]);
    setFeedback((feedbackResult.data ?? []) as PilotFeedback[]);
    setOutcomes((outcomeResult.data ?? []) as PilotOutcome[]);
    setIssues((issueResult.data ?? []) as PilotSupportIssue[]);
    setEvents((eventResult.data ?? []) as PilotEvent[]);
    setProfiles((profileResult.data ?? []) as Profile[]);
    setReviews((reviewResult.data ?? []) as ContractorReview[]);
    setObservations((observationResult.data ?? []) as PricingObservation[]);
    setSelectedId((current) => {
      if (current && projectRows.some((project) => project.id === current)) {
        return current;
      }
      return projectRows[0]?.id ?? "";
    });
    setLoading(false);
  }, [profile.role, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const hash = window.location.hash;
      const marker = "#pilot-invite=";
      if (hash.startsWith(marker)) {
        setInviteToken(decodeURIComponent(hash.slice(marker.length)));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const selectedProject =
    projects.find((project) => project.id === selectedId) ?? null;
  const selectedEstimate =
    estimates.find((estimate) => estimate.project_id === selectedId) ?? null;
  const selectedEnrollment =
    enrollments.find((item) => item.project_id === selectedId) ?? null;
  const selectedQuotes = quotes.filter((quote) => quote.project_id === selectedId);
  const selectedOutcome =
    outcomes.find((outcome) => outcome.project_id === selectedId) ?? null;
  const contractorProfile = contractorProfiles.find(
    (item) => item.contractor_id === profile.id,
  );

  useEffect(() => {
    if (!selectedOutcome) return;
    const timeout = window.setTimeout(() => {
      setOutcomeDraft({
        acceptedQuoteId: selectedOutcome.accepted_quote_id ?? "",
        finalAmount: selectedOutcome.final_contract_amount?.toString() ?? "",
        changeOrders: selectedOutcome.change_order_total.toString(),
        status: selectedOutcome.outcome_status,
        notes: selectedOutcome.notes,
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [selectedOutcome]);

  const comparisons = useMemo(
    () =>
      selectedQuotes.map((quote) => {
        const expected =
          selectedEstimate?.calculation_result.scenarios.expected.planningPrice ?? 0;
        const difference = quote.total_amount - expected;
        const percentage = expected ? (difference / expected) * 100 : 0;
        return { quote, expected, difference, percentage };
      }),
    [selectedEstimate, selectedQuotes],
  );

  async function recordEvent(
    eventName: PilotEvent["event_name"],
    projectId = selectedId || null,
    metadata: Record<string, unknown> = {},
  ) {
    const { error: eventError } = await supabase.from("pilot_events").insert({
      project_id: projectId,
      actor_id: profile.id,
      event_name: eventName,
      metadata,
    });
    if (eventError) console.warn("Pilot event could not be recorded.");
  }

  async function enrollProject() {
    if (!selectedProject || !selectedEstimate) {
      setError("Create a saved HUM estimate before enrolling this project.");
      return;
    }
    setBusy("enroll");
    setError("");
    const now = new Date().toISOString();
    const { error: enrollmentError } = await supabase
      .from("pilot_enrollments")
      .insert({
        project_id: selectedProject.id,
        homeowner_id: profile.id,
        homeowner_consent: true,
        consented_at: now,
        intake_started_at: selectedProject.created_at,
        intake_completed_at: selectedEstimate.created_at,
      });
    if (enrollmentError) {
      setError(enrollmentError.message);
    } else {
      await recordEvent("pilot_enrolled", selectedProject.id);
      setNotice(
        "Project enrolled in the controlled pilot. Nothing is public and no contractor can see it until you invite one.",
      );
      await loadData();
    }
    setBusy("");
  }

  async function createInvitation() {
    if (!selectedEnrollment) return;
    setBusy("invite");
    setError("");
    const { data, error: invitationError } = await supabase.rpc(
      "create_pilot_invitation",
      { p_project_id: selectedEnrollment.project_id, p_expires_days: 14 },
    );
    if (invitationError || !data?.[0]) {
      setError(invitationError?.message ?? "The invitation could not be created.");
      setBusy("");
      return;
    }
    const link = `${window.location.origin}/#pilot-invite=${encodeURIComponent(
      data[0].invitation_token,
    )}`;
    setInviteLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Private contractor invitation copied. It expires in 14 days.");
    } catch {
      setNotice("Private invitation created. Copy the link below.");
    }
    await loadData();
    setBusy("");
  }

  async function acceptInvitation(event: React.FormEvent) {
    event.preventDefault();
    setBusy("accept-invite");
    setError("");
    const token = inviteToken.includes("#pilot-invite=")
      ? inviteToken.split("#pilot-invite=").pop() ?? ""
      : inviteToken;
    const { error: acceptError } = await supabase.rpc(
      "accept_pilot_invitation",
      { p_invitation_token: decodeURIComponent(token.trim()) },
    );
    if (acceptError) {
      setError(acceptError.message);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
      setInviteToken("");
      setNotice("Invitation accepted. This project is now in your private pilot workspace.");
      await loadData();
    }
    setBusy("");
  }

  async function saveQuote(status: "draft" | "submitted") {
    if (!selectedProject || !selectedEstimate) {
      setError("This project needs a saved HUM estimate before quote capture.");
      return;
    }
    if (quoteDraft.scope.trim().length < 10) {
      setError("Add a clear scope summary before saving the quote.");
      return;
    }
    setBusy(`quote-${status}`);
    setError("");
    const quotePayload = {
      project_id: selectedProject.id,
      estimate_id: selectedEstimate.id,
      contractor_id: profile.id,
      status,
      material_amount: numberValue(quoteDraft.material),
      labor_amount: numberValue(quoteDraft.labor),
      tearoff_disposal_amount: numberValue(quoteDraft.tearoffDisposal),
      permit_delivery_amount: numberValue(quoteDraft.permitDelivery),
      allowance_amount: numberValue(quoteDraft.allowance),
      other_amount: numberValue(quoteDraft.other),
      scope_summary: quoteDraft.scope.trim(),
      exclusions: quoteDraft.exclusions.trim(),
      quote_reference: quoteDraft.reference.trim() || null,
      valid_until: quoteDraft.validUntil || null,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    };
    const { data, error: quoteError } = await supabase
      .from("contractor_quotes")
      .upsert(quotePayload, { onConflict: "project_id,contractor_id" })
      .select("*")
      .single();

    if (quoteError || !data) {
      setError(quoteError?.message ?? "The quote could not be saved.");
      setBusy("");
      return;
    }

    const quote = data as ContractorQuote;
    await supabase
      .from("quote_difference_reasons")
      .delete()
      .eq("quote_id", quote.id)
      .eq("contractor_id", profile.id);

    if (quoteDraft.reasonExplanation.trim()) {
      const { error: reasonError } = await supabase
        .from("quote_difference_reasons")
        .insert({
          quote_id: quote.id,
          project_id: quote.project_id,
          contractor_id: profile.id,
          reason_code: quoteDraft.reasonCode,
          direction: quoteDraft.reasonDirection,
          amount_effect: quoteDraft.reasonAmount
            ? numberValue(quoteDraft.reasonAmount)
            : null,
          explanation: quoteDraft.reasonExplanation.trim(),
        });
      if (reasonError) {
        setError(reasonError.message);
        setBusy("");
        return;
      }
    }

    if (status === "submitted") {
      await recordEvent("quote_submitted", quote.project_id, {
        quote_id: quote.id,
      });
    }
    setNotice(
      status === "submitted"
        ? "Actual contractor quote captured. HUM has not accepted it or created a contract."
        : "Private quote draft saved.",
    );
    await loadData();
    setBusy("");
  }

  async function saveFeedback(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy("feedback");
    setError("");
    const { error: feedbackError } = await supabase
      .from("pilot_feedback")
      .upsert(
        {
          project_id: selectedProject.id,
          submitted_by: profile.id,
          audience:
            profile.role === "contractor" ? "contractor" : "homeowner",
          understanding_rating: Number(feedbackDraft.understanding),
          usefulness_rating: Number(feedbackDraft.usefulness),
          completion_ease_rating: Number(feedbackDraft.ease),
          feedback_text: feedbackDraft.text.trim(),
        },
        { onConflict: "project_id,submitted_by,audience" },
      );
    if (feedbackError) {
      setError(feedbackError.message);
    } else {
      await recordEvent("feedback_submitted", selectedProject.id);
      setNotice("Pilot feedback saved for the administrator review queue.");
      await loadData();
    }
    setBusy("");
  }

  async function saveOutcome(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy("outcome");
    setError("");
    const { error: outcomeError } = await supabase
      .from("pilot_outcomes")
      .upsert(
        {
          project_id: selectedProject.id,
          recorded_by: profile.id,
          accepted_quote_id: outcomeDraft.acceptedQuoteId || null,
          final_contract_amount: outcomeDraft.finalAmount
            ? numberValue(outcomeDraft.finalAmount)
            : null,
          change_order_total: numberValue(outcomeDraft.changeOrders),
          outcome_status: outcomeDraft.status,
          notes: outcomeDraft.notes.trim(),
        },
        { onConflict: "project_id" },
      );
    if (outcomeError) {
      setError(outcomeError.message);
    } else {
      await recordEvent("outcome_recorded", selectedProject.id);
      if (
        outcomeDraft.status === "contractor_selected" ||
        outcomeDraft.status === "contract_signed_elsewhere"
      ) {
        await supabase
          .from("pilot_enrollments")
          .update({ status: "closed" })
          .eq("project_id", selectedProject.id);
      }
      setNotice(
        "Real-world outcome recorded for comparison only. HUM did not award work, sign, or process payment.",
      );
      await loadData();
    }
    setBusy("");
  }

  async function submitIssue(event: React.FormEvent) {
    event.preventDefault();
    if (issueDraft.description.trim().length < 10) {
      setError("Describe the issue in at least 10 characters.");
      return;
    }
    setBusy("issue");
    setError("");
    const { error: issueError } = await supabase
      .from("pilot_support_issues")
      .insert({
        project_id: selectedId || null,
        reported_by: profile.id,
        category: issueDraft.category,
        severity: issueDraft.severity,
        description: issueDraft.description.trim(),
      });
    if (issueError) {
      setError(issueError.message);
    } else {
      setIssueDraft((current) => ({ ...current, description: "" }));
      setNotice("Support issue added to the private pilot queue.");
      await loadData();
    }
    setBusy("");
  }

  async function setContractorStatus(
    contractor: Profile,
    status: PilotContractorProfile["status"],
  ) {
    setBusy(`contractor-${contractor.id}`);
    setError("");
    const existing = contractorProfiles.find(
      (item) => item.contractor_id === contractor.id,
    );
    const { error: contractorError } = await supabase.rpc(
      "set_pilot_contractor_status",
      {
        p_contractor_id: contractor.id,
        p_company_name:
          existing?.company_name ?? contractor.full_name ?? contractor.email,
        p_license_number: existing?.license_number ?? null,
        p_service_area:
          existing?.service_area ?? contractor.service_area ?? "Humboldt County",
        p_status: status,
        p_onboarding_notes:
          existing?.onboarding_notes ?? "Manual Round 4 pilot onboarding.",
      },
    );
    if (contractorError) {
      setError(contractorError.message);
    } else {
      setNotice(`Contractor pilot status changed to ${status}.`);
      await loadData();
    }
    setBusy("");
  }

  async function updateIssue(
    issue: PilotSupportIssue,
    status: PilotSupportIssue["status"],
  ) {
    setBusy(`issue-${issue.id}`);
    const terminal = status === "resolved" || status === "closed";
    const { error: updateError } = await supabase
      .from("pilot_support_issues")
      .update({
        status,
        resolution: terminal
          ? issue.resolution || "Reviewed during the Round 4 pilot."
          : issue.resolution,
        resolved_by: terminal ? profile.id : null,
        resolved_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", issue.id);
    if (updateError) setError(updateError.message);
    else await loadData();
    setBusy("");
  }

  async function printBrief() {
    await recordEvent("brief_printed");
    window.print();
  }

  if (loading) {
    return (
      <main className={styles.workspace}>
        <p className={styles.kicker}>Round 4 · Controlled Humboldt pilot</p>
        <h1>Loading pilot evidence…</h1>
      </main>
    );
  }

  if (profile.role === "administrator") {
    const submittedQuotes = quotes.filter((quote) => quote.status === "submitted");
    const projectsWithQuotes = new Set(submittedQuotes.map((quote) => quote.project_id));
    const comparable = submittedQuotes.filter((quote) =>
      estimates.some((estimate) => estimate.id === quote.estimate_id),
    );
    const varianceRows = comparable.map((quote) => {
      const estimate = estimates.find((item) => item.id === quote.estimate_id);
      const expected =
        estimate?.calculation_result.scenarios.expected.planningPrice ?? 0;
      return expected ? Math.abs(quote.total_amount - expected) / expected : 0;
    });
    const contractors = profiles.filter((item) => item.role === "contractor");
    const criticalIssues = issues.filter(
      (issue) =>
        issue.severity === "critical" &&
        !["resolved", "closed"].includes(issue.status),
    );

    return (
      <main className={styles.workspace}>
        <PilotHeading
          kicker="Round 4 · Pilot support"
          title="Evidence before marketplace."
          copy="Track ten real Humboldt roofing projects, explain every major difference, and stop the round if a privacy or authorization failure appears."
        />
        <PilotMessages notice={notice} error={error} />

        <section className={styles.pilotStatGrid}>
          <PilotStat label="Real project target" value={`${enrollments.length} / 10`} />
          <PilotStat label="With actual quote" value={projectsWithQuotes.size.toString()} />
          <PilotStat label="Traceable reasons" value={reasons.length.toString()} />
          <PilotStat
            label="Critical open issues"
            value={criticalIssues.length.toString()}
            alert={criticalIssues.length > 0}
          />
        </section>

        <section className={styles.pilotPanel}>
          <div className={styles.pilotPanelHead}>
            <div>
              <p className={styles.kicker}>Accuracy evidence</p>
              <h2>Estimate-versus-quote reporting</h2>
            </div>
            <span className={styles.statusPill}>
              {varianceRows.length < 10
                ? "Benchmark not yet defensible"
                : "Pilot benchmark available"}
            </span>
          </div>
          <p className={styles.pilotCallout}>
            HUM is collecting directional evidence. It will not declare a strict
            accuracy percentage before enough real project comparisons exist.
          </p>
          <div className={styles.pilotTable}>
            <div className={styles.pilotTableHead}>
              <span>Project</span>
              <span>HUM expected</span>
              <span>Actual quote</span>
              <span>Difference</span>
              <span>Reasons</span>
            </div>
            {comparable.map((quote) => {
              const project = projects.find((item) => item.id === quote.project_id);
              const estimate = estimates.find((item) => item.id === quote.estimate_id);
              const expected =
                estimate?.calculation_result.scenarios.expected.planningPrice ?? 0;
              const difference = quote.total_amount - expected;
              return (
                <div className={styles.pilotTableRow} key={quote.id}>
                  <strong>{project?.title ?? "Protected project"}</strong>
                  <span>{money(expected)}</span>
                  <span>{money(quote.total_amount)}</span>
                  <span>
                    {difference >= 0 ? "+" : ""}
                    {money(difference)}
                  </span>
                  <span>
                    {reasons.filter((reason) => reason.quote_id === quote.id).length}
                  </span>
                </div>
              );
            })}
            {!comparable.length && (
              <p className={styles.muted}>No real quote comparisons yet.</p>
            )}
          </div>
        </section>

        <div className={styles.pilotTwoColumn}>
          <section className={styles.pilotPanel}>
            <p className={styles.kicker}>Manual contractor onboarding</p>
            <h2>Approval stays human.</h2>
            <div className={styles.pilotStack}>
              {contractors.map((contractor) => {
                const pilot = contractorProfiles.find(
                  (item) => item.contractor_id === contractor.id,
                );
                return (
                  <div className={styles.pilotQueueRow} key={contractor.id}>
                    <div>
                      <strong>{contractor.full_name ?? contractor.email}</strong>
                      <small>
                        {pilot?.company_name ?? "Company details pending"} ·{" "}
                        {pilot?.status ?? "not onboarded"}
                      </small>
                    </div>
                    <div className={styles.pilotRowActions}>
                      <button
                        className={styles.secondaryButton}
                        disabled={busy === `contractor-${contractor.id}`}
                        onClick={() => setContractorStatus(contractor, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className={styles.ghostButton}
                        disabled={busy === `contractor-${contractor.id}`}
                        onClick={() => setContractorStatus(contractor, "paused")}
                      >
                        Pause
                      </button>
                    </div>
                  </div>
                );
              })}
              {!contractors.length && (
                <p className={styles.muted}>No contractor accounts yet.</p>
              )}
            </div>
          </section>

          <section className={styles.pilotPanel}>
            <p className={styles.kicker}>Admin review queue</p>
            <h2>What needs a human decision.</h2>
            <div className={styles.pilotQueueCounts}>
              <span>
                <strong>
                  {reviews.filter((review) => review.status === "submitted").length}
                </strong>
                submitted corrections
              </span>
              <span>
                <strong>
                  {
                    observations.filter(
                      (observation) => observation.status === "proposed",
                    ).length
                  }
                </strong>
                pricing observations
              </span>
              <span>
                <strong>{feedback.length}</strong>
                feedback records
              </span>
              <span>
                <strong>
                  {
                    issues.filter((issue) =>
                      ["open", "investigating"].includes(issue.status),
                    ).length
                  }
                </strong>
                support issues
              </span>
            </div>
          </section>
        </div>

        <section className={styles.pilotPanel}>
          <div className={styles.pilotPanelHead}>
            <div>
              <p className={styles.kicker}>Pilot support queue</p>
              <h2>Privacy, authorization, and usability issues</h2>
            </div>
          </div>
          <div className={styles.pilotStack}>
            {issues.map((issue) => (
              <div className={styles.pilotQueueRow} key={issue.id}>
                <div>
                  <strong>
                    {issue.severity} · {issue.category}
                  </strong>
                  <small>{issue.description}</small>
                </div>
                <div className={styles.pilotRowActions}>
                  <span className={styles.statusPill}>{issue.status}</span>
                  {issue.status === "open" && (
                    <button
                      className={styles.secondaryButton}
                      disabled={busy === `issue-${issue.id}`}
                      onClick={() => updateIssue(issue, "investigating")}
                    >
                      Investigate
                    </button>
                  )}
                  {!["resolved", "closed"].includes(issue.status) && (
                    <button
                      className={styles.ghostButton}
                      disabled={busy === `issue-${issue.id}`}
                      onClick={() => updateIssue(issue, "resolved")}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!issues.length && <p className={styles.muted}>No pilot issues reported.</p>}
          </div>
        </section>

        <section className={styles.pilotPanel}>
          <p className={styles.kicker}>Exit gate</p>
          <h2>Round 5 remains locked.</h2>
          <div className={styles.pilotGateGrid}>
            <Gate done={enrollments.length >= 10} label="10 real roofing projects" />
            <Gate
              done={
                enrollments.length >= 10 &&
                enrollments.every((item) =>
                  projectsWithQuotes.has(item.project_id),
                )
              }
              label="Every estimate compared with a quote"
            />
            <Gate done={reasons.length > 0} label="Differences have reasons" />
            <Gate done={criticalIssues.length === 0} label="No critical privacy failures" />
            <Gate
              done={feedback.some((item) => item.audience === "contractor")}
              label="Contractor usefulness feedback"
            />
            <Gate
              done={feedback.some((item) => item.audience === "homeowner")}
              label="Homeowner understanding feedback"
            />
          </div>
          <p className={styles.pilotFootnote}>
            Intake events recorded: {events.length}. Round 5 starts only after
            every exit condition is supported by real evidence.
          </p>
        </section>
      </main>
    );
  }

  if (profile.role === "contractor") {
    const existingQuote = selectedQuotes.find(
      (quote) => quote.contractor_id === profile.id,
    );
    return (
      <main className={styles.workspace}>
        <PilotHeading
          kicker="Round 4 · Contractor collaboration"
          title="Review the same facts. Explain the difference."
          copy="Accept a private invitation, review the versioned HUM estimate, and capture an actual quote without joining a public job feed."
        />
        <PilotMessages notice={notice} error={error} />

        {!contractorProfile || contractorProfile.status !== "approved" ? (
          <section className={styles.pilotWarning}>
            <strong>Manual pilot approval required</strong>
            <p>
              An HUM administrator must verify and approve this contractor account
              before an invitation can be accepted or a quote submitted.
            </p>
          </section>
        ) : (
          <section className={styles.pilotSuccess}>
            <strong>{contractorProfile.company_name}</strong>
            <span>
              Approved for the controlled Humboldt pilot ·{" "}
              {contractorProfile.service_area}
            </span>
          </section>
        )}

        <form className={styles.pilotPanel} onSubmit={acceptInvitation}>
          <p className={styles.kicker}>Private invitation</p>
          <h2>Accept contractor access</h2>
          <label className={styles.field}>
            <span>Invitation link or token</span>
            <input
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste the homeowner’s private invitation"
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={
              busy === "accept-invite" ||
              !inviteToken.trim() ||
              contractorProfile?.status !== "approved"
            }
          >
            {busy === "accept-invite" ? "Accepting…" : "Accept invitation"}
          </button>
        </form>

        <ProjectPicker
          projects={projects}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {selectedProject && selectedEstimate ? (
          <>
            <ProjectBrief
              project={selectedProject}
              estimate={selectedEstimate}
              onPrint={printBrief}
            />

            <section className={styles.pilotPanel}>
              <p className={styles.kicker}>Actual quote capture</p>
              <h2>Itemize what you would really quote.</h2>
              {existingQuote && (
                <p className={styles.pilotCallout}>
                  Saved quote: {money(existingQuote.total_amount)} ·{" "}
                  {existingQuote.status}
                </p>
              )}
              <div className={styles.pilotAmountGrid}>
                <MoneyField
                  label="Materials"
                  value={quoteDraft.material}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({ ...current, material: value }))
                  }
                />
                <MoneyField
                  label="Labor"
                  value={quoteDraft.labor}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({ ...current, labor: value }))
                  }
                />
                <MoneyField
                  label="Tear-off + disposal"
                  value={quoteDraft.tearoffDisposal}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({
                      ...current,
                      tearoffDisposal: value,
                    }))
                  }
                />
                <MoneyField
                  label="Permit + delivery"
                  value={quoteDraft.permitDelivery}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({
                      ...current,
                      permitDelivery: value,
                    }))
                  }
                />
                <MoneyField
                  label="Allowances"
                  value={quoteDraft.allowance}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({ ...current, allowance: value }))
                  }
                />
                <MoneyField
                  label="Other"
                  value={quoteDraft.other}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({ ...current, other: value }))
                  }
                />
              </div>
              <label className={styles.field}>
                <span>Scope summary</span>
                <textarea
                  rows={5}
                  value={quoteDraft.scope}
                  onChange={(event) =>
                    setQuoteDraft((current) => ({
                      ...current,
                      scope: event.target.value,
                    }))
                  }
                  placeholder="Describe the included roofing work and material system."
                />
              </label>
              <label className={styles.field}>
                <span>Exclusions</span>
                <textarea
                  rows={3}
                  value={quoteDraft.exclusions}
                  onChange={(event) =>
                    setQuoteDraft((current) => ({
                      ...current,
                      exclusions: event.target.value,
                    }))
                  }
                  placeholder="List work not included in this quote."
                />
              </label>
              <div className={styles.pilotThreeColumn}>
                <label className={styles.field}>
                  <span>Quote reference</span>
                  <input
                    value={quoteDraft.reference}
                    onChange={(event) =>
                      setQuoteDraft((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Valid until</span>
                  <input
                    type="date"
                    value={quoteDraft.validUntil}
                    onChange={(event) =>
                      setQuoteDraft((current) => ({
                        ...current,
                        validUntil: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Main difference reason</span>
                  <select
                    value={quoteDraft.reasonCode}
                    onChange={(event) =>
                      setQuoteDraft((current) => ({
                        ...current,
                        reasonCode: event.target
                          .value as QuoteDifferenceReason["reason_code"],
                      }))
                    }
                  >
                    {[
                      "material_price",
                      "labor_rate",
                      "scope_added",
                      "scope_removed",
                      "measurement",
                      "access",
                      "permit",
                      "disposal",
                      "warranty",
                      "market_conditions",
                      "allowance",
                      "other",
                    ].map((code) => (
                      <option key={code} value={code}>
                        {code.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.pilotThreeColumn}>
                <label className={styles.field}>
                  <span>Direction</span>
                  <select
                    value={quoteDraft.reasonDirection}
                    onChange={(event) =>
                      setQuoteDraft((current) => ({
                        ...current,
                        reasonDirection: event.target
                          .value as QuoteDifferenceReason["direction"],
                      }))
                    }
                  >
                    <option value="higher">Higher than HUM</option>
                    <option value="lower">Lower than HUM</option>
                    <option value="neutral">Scope difference only</option>
                  </select>
                </label>
                <MoneyField
                  label="Approximate amount effect"
                  value={quoteDraft.reasonAmount}
                  onChange={(value) =>
                    setQuoteDraft((current) => ({
                      ...current,
                      reasonAmount: value,
                    }))
                  }
                />
                <label className={styles.field}>
                  <span>Why it differs</span>
                  <input
                    value={quoteDraft.reasonExplanation}
                    onChange={(event) =>
                      setQuoteDraft((current) => ({
                        ...current,
                        reasonExplanation: event.target.value,
                      }))
                    }
                    placeholder="Site-specific explanation"
                  />
                </label>
              </div>
              <div className={styles.pilotRowActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={busy.startsWith("quote-")}
                  onClick={() => saveQuote("draft")}
                >
                  Save draft
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={
                    busy.startsWith("quote-") ||
                    contractorProfile?.status !== "approved"
                  }
                  onClick={() => saveQuote("submitted")}
                >
                  Submit actual quote
                </button>
              </div>
              <p className={styles.pilotFootnote}>
                Submission records real-world evidence only. HUM does not award the
                job, bind either party, or process money in Round 4.
              </p>
            </section>

            <FeedbackForm
              draft={feedbackDraft}
              setDraft={setFeedbackDraft}
              busy={busy}
              onSubmit={saveFeedback}
              audience="contractor"
            />
          </>
        ) : (
          <section className={styles.pilotPanel}>
            <h2>No accepted pilot project yet.</h2>
            <p className={styles.muted}>
              Accept a private invitation from an enrolled homeowner project.
            </p>
          </section>
        )}

        <IssueForm
          draft={issueDraft}
          setDraft={setIssueDraft}
          busy={busy}
          onSubmit={submitIssue}
        />
      </main>
    );
  }

  return (
    <main className={styles.workspace}>
      <PilotHeading
        kicker="Round 4 · Homeowner pilot"
        title="Put the estimate beside a real quote."
        copy="Enroll one protected roofing project, invite a manually approved contractor, and record what the real world proves or disproves."
      />
      <PilotMessages notice={notice} error={error} />
      <ProjectPicker
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {!selectedProject ? (
        <section className={styles.pilotPanel}>
          <h2>Create a roofing project first.</h2>
          <p className={styles.muted}>
            Round 4 begins only after the secure intake and estimate are saved.
          </p>
        </section>
      ) : !selectedEstimate ? (
        <section className={styles.pilotWarning}>
          <strong>A saved HUM estimate is required.</strong>
          <p>
            Finish the Round 3 intake and generate a versioned estimate before
            enrolling this project in the pilot.
          </p>
        </section>
      ) : !selectedEnrollment ? (
        <section className={styles.pilotPanel}>
          <p className={styles.kicker}>Controlled enrollment</p>
          <h2>Keep this project private while HUM learns.</h2>
          <div className={styles.pilotConsent}>
            <strong>By enrolling, you confirm:</strong>
            <span>Only you, HUM administrators, and contractors you invite can access it.</span>
            <span>The HUM range is a planning estimate, not a quote.</span>
            <span>Quote and outcome data will be used to improve Humboldt pricing.</span>
            <span>No project is posted publicly and no work is awarded in Round 4.</span>
          </div>
          <button
            className={styles.primaryButton}
            disabled={busy === "enroll"}
            onClick={enrollProject}
          >
            {busy === "enroll" ? "Enrolling…" : "Enroll this project"}
          </button>
        </section>
      ) : (
        <>
          <section className={styles.pilotSuccess}>
            <strong>Controlled pilot active</strong>
            <span>
              {selectedEnrollment.status.replaceAll("_", " ")} · enrolled{" "}
              {new Date(selectedEnrollment.created_at).toLocaleDateString()}
            </span>
          </section>

          <ProjectBrief
            project={selectedProject}
            estimate={selectedEstimate}
            onPrint={printBrief}
          />

          <section className={styles.pilotPanel}>
            <div className={styles.pilotPanelHead}>
              <div>
                <p className={styles.kicker}>Contractor invitation</p>
                <h2>Share this project—not your account.</h2>
              </div>
              <span className={styles.statusPill}>
                {
                  invitations.filter(
                    (item) =>
                      item.project_id === selectedProject.id &&
                      !item.revoked_at &&
                      new Date(item.expires_at) > new Date(),
                  ).length
                }{" "}
                active
              </span>
            </div>
            <p className={styles.muted}>
              The link works only for a manually approved HUM contractor account,
              expires after 14 days, and grants access to this project alone.
            </p>
            <button
              className={styles.primaryButton}
              disabled={busy === "invite"}
              onClick={createInvitation}
            >
              {busy === "invite" ? "Creating…" : "Create private invitation"}
            </button>
            {inviteLink && (
              <label className={styles.field}>
                <span>Copy this private link</span>
                <input readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
              </label>
            )}
          </section>

          <section className={styles.pilotPanel}>
            <div className={styles.pilotPanelHead}>
              <div>
                <p className={styles.kicker}>Estimate-versus-quote comparison</p>
                <h2>See the amount and the reason.</h2>
              </div>
              <span className={styles.statusPill}>{comparisons.length} quotes</span>
            </div>
            {comparisons.length ? (
              <div className={styles.pilotComparisonGrid}>
                {comparisons.map(({ quote, expected, difference, percentage }) => (
                  <article className={styles.pilotComparisonCard} key={quote.id}>
                    <span>Contractor quote</span>
                    <strong>{money(quote.total_amount)}</strong>
                    <small>
                      HUM expected {money(expected)} · {difference >= 0 ? "+" : ""}
                      {percentage.toFixed(1)}%
                    </small>
                    <div>
                      {reasons
                        .filter((reason) => reason.quote_id === quote.id)
                        .map((reason) => (
                          <p key={reason.id}>
                            <b>{reason.reason_code.replaceAll("_", " ")}</b>{" "}
                            {reason.explanation}
                          </p>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>
                No actual contractor quote has been submitted yet.
              </p>
            )}
          </section>

          <form className={styles.pilotPanel} onSubmit={saveOutcome}>
            <p className={styles.kicker}>Real-world outcome</p>
            <h2>Record what happened outside HUM.</h2>
            <div className={styles.pilotThreeColumn}>
              <label className={styles.field}>
                <span>Selected quote</span>
                <select
                  value={outcomeDraft.acceptedQuoteId}
                  onChange={(event) =>
                    setOutcomeDraft((current) => ({
                      ...current,
                      acceptedQuoteId: event.target.value,
                    }))
                  }
                >
                  <option value="">No quote selected</option>
                  {selectedQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {money(quote.total_amount)}
                    </option>
                  ))}
                </select>
              </label>
              <MoneyField
                label="Final accepted contract"
                value={outcomeDraft.finalAmount}
                onChange={(value) =>
                  setOutcomeDraft((current) => ({
                    ...current,
                    finalAmount: value,
                  }))
                }
              />
              <MoneyField
                label="Change orders to date"
                value={outcomeDraft.changeOrders}
                onChange={(value) =>
                  setOutcomeDraft((current) => ({
                    ...current,
                    changeOrders: value,
                  }))
                }
              />
            </div>
            <label className={styles.field}>
              <span>Outcome</span>
              <select
                value={outcomeDraft.status}
                onChange={(event) =>
                  setOutcomeDraft((current) => ({
                    ...current,
                    status: event.target.value as PilotOutcome["outcome_status"],
                  }))
                }
              >
                <option value="undecided">Still deciding</option>
                <option value="contractor_selected">Contractor selected</option>
                <option value="contract_signed_elsewhere">
                  Contract signed outside HUM
                </option>
                <option value="project_paused">Project paused</option>
                <option value="project_cancelled">Project cancelled</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Notes</span>
              <textarea
                rows={3}
                value={outcomeDraft.notes}
                onChange={(event) =>
                  setOutcomeDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
            <button className={styles.primaryButton} disabled={busy === "outcome"}>
              Save real-world outcome
            </button>
          </form>

          <FeedbackForm
            draft={feedbackDraft}
            setDraft={setFeedbackDraft}
            busy={busy}
            onSubmit={saveFeedback}
            audience="homeowner"
          />
        </>
      )}

      <IssueForm
        draft={issueDraft}
        setDraft={setIssueDraft}
        busy={busy}
        onSubmit={submitIssue}
      />
    </main>
  );
}

function PilotHeading({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <header className={styles.pageHeading}>
      <p className={styles.kicker}>{kicker}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
      <div className={styles.pilotBoundary}>
        <strong>Current boundary</strong>
        <span>
          Controlled research only · no public feed · no competitive bidding · no
          award · no payment
        </span>
      </div>
    </header>
  );
}

function PilotMessages({
  notice,
  error,
}: {
  notice: string;
  error: string;
}) {
  return (
    <>
      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}

function ProjectPicker({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!projects.length) return null;
  return (
    <label className={styles.projectPicker}>
      <span>Current pilot project</span>
      <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title} · {project.city}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectBrief({
  project,
  estimate,
  onPrint,
}: {
  project: Project;
  estimate: EstimateRecord;
  onPrint: () => void;
}) {
  const result = estimate.calculation_result;
  return (
    <section className={`${styles.pilotPanel} ${styles.printBrief}`}>
      <div className={styles.pilotPanelHead}>
        <div>
          <p className={styles.kicker}>Shareable contractor project brief</p>
          <h2>{project.title}</h2>
        </div>
        <button
          className={`${styles.secondaryButton} ${styles.noPrint}`}
          onClick={onPrint}
        >
          Print or save PDF
        </button>
      </div>
      <div className={styles.pilotBriefHero}>
        <div>
          <span>HUM planning range</span>
          <strong>
            {money(result.scenarios.low.planningPrice)} –{" "}
            {money(result.scenarios.high.planningPrice)}
          </strong>
          <small>Expected {money(result.scenarios.expected.planningPrice)}</small>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{result.confidenceScore}%</strong>
          <small>
            {result.pricingVersionCode} · effective {result.pricingEffectiveDate}
          </small>
        </div>
      </div>
      <div className={styles.pilotBriefGrid}>
        <div>
          <h3>Homeowner facts</h3>
          <p>
            {project.city}, Humboldt County · {project.project_type} ·{" "}
            {project.footprint_sqft ?? "area unconfirmed"} sq ft footprint ·{" "}
            {project.roof_pitch} pitch · {project.stories} story
          </p>
          <p>{project.homeowner_notes || "No additional homeowner notes."}</p>
        </div>
        <div>
          <h3>Likely scope</h3>
          <p>{result.projectSummary}</p>
          <ul>
            {result.majorCostDrivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Information still missing</h3>
          {result.missingInformation.length ? (
            <ul>
              {result.missingInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No missing-information warnings in this estimate version.</p>
          )}
        </div>
        <div>
          <h3>Questions for site review</h3>
          <ul>
            {result.questionsForContractor.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className={styles.pilotFootnote}>
        Planning estimate only—not a binding contractor quote. Hidden damage,
        code requirements, exact quantities, and final scope require human site
        review.
      </p>
    </section>
  );
}

function FeedbackForm({
  draft,
  setDraft,
  busy,
  onSubmit,
  audience,
}: {
  draft: {
    understanding: string;
    usefulness: string;
    ease: string;
    text: string;
  };
  setDraft: React.Dispatch<
    React.SetStateAction<{
      understanding: string;
      usefulness: string;
      ease: string;
      text: string;
    }>
  >;
  busy: string;
  onSubmit: (event: React.FormEvent) => void;
  audience: "homeowner" | "contractor";
}) {
  return (
    <form className={styles.pilotPanel} onSubmit={onSubmit}>
      <p className={styles.kicker}>{audience} feedback</p>
      <h2>Tell HUM what was clear and what was not.</h2>
      <div className={styles.pilotThreeColumn}>
        <RatingField
          label={audience === "homeowner" ? "I understand the range" : "Brief clarity"}
          value={draft.understanding}
          onChange={(value) =>
            setDraft((current) => ({ ...current, understanding: value }))
          }
        />
        <RatingField
          label="Usefulness"
          value={draft.usefulness}
          onChange={(value) =>
            setDraft((current) => ({ ...current, usefulness: value }))
          }
        />
        <RatingField
          label="Completion ease"
          value={draft.ease}
          onChange={(value) =>
            setDraft((current) => ({ ...current, ease: value }))
          }
        />
      </div>
      <label className={styles.field}>
        <span>What should HUM change?</span>
        <textarea
          rows={4}
          value={draft.text}
          onChange={(event) =>
            setDraft((current) => ({ ...current, text: event.target.value }))
          }
        />
      </label>
      <button className={styles.primaryButton} disabled={busy === "feedback"}>
        Save pilot feedback
      </button>
    </form>
  );
}

function IssueForm({
  draft,
  setDraft,
  busy,
  onSubmit,
}: {
  draft: {
    category: PilotSupportIssue["category"];
    severity: PilotSupportIssue["severity"];
    description: string;
  };
  setDraft: React.Dispatch<
    React.SetStateAction<{
      category: PilotSupportIssue["category"];
      severity: PilotSupportIssue["severity"];
      description: string;
    }>
  >;
  busy: string;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className={styles.pilotPanel} onSubmit={onSubmit}>
      <p className={styles.kicker}>Pilot support</p>
      <h2>Report a privacy, estimate, or usability problem.</h2>
      <div className={styles.pilotThreeColumn}>
        <label className={styles.field}>
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as PilotSupportIssue["category"],
              }))
            }
          >
            {[
              "privacy",
              "authorization",
              "estimate",
              "photos",
              "quote",
              "intake",
              "usability",
              "other",
            ].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Severity</span>
          <select
            value={draft.severity}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                severity: event.target.value as PilotSupportIssue["severity"],
              }))
            }
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <input
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="What happened and what did you expect?"
          />
        </label>
      </div>
      <button className={styles.secondaryButton} disabled={busy === "issue"}>
        Add to support queue
      </button>
    </form>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        inputMode="decimal"
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="$0"
      />
    </label>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="1">1 · Poor</option>
        <option value="2">2</option>
        <option value="3">3 · Fair</option>
        <option value="4">4</option>
        <option value="5">5 · Excellent</option>
      </select>
    </label>
  );
}

function PilotStat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <article className={`${styles.pilotStat} ${alert ? styles.pilotStatAlert : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Gate({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={done ? styles.pilotGateDone : styles.pilotGatePending}>
      <span>{done ? "✓" : "○"}</span>
      <strong>{label}</strong>
    </div>
  );
}
