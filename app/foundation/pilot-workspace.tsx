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
  PilotSettings,
  PilotSupportIssue,
  PricingObservation,
  Profile,
  Project,
  QuoteDifferenceReason,
} from "./types";
import styles from "./foundation.module.css";
import {
  buildPilotEvidenceScope,
  onlyRealProjectRows,
} from "./pilot-evidence.mjs";
import {
  buildScopeSummary,
  calculateQuoteBuilder,
} from "./quote-builder.mjs";

type QuoteDraft = {
  roofAreaSqft: string;
  wastePercent: string;
  existingLayers: string;
  pitch: string;
  access: string;
  deckingSheets: string;
  ridgeFeet: string;
  valleyFeet: string;
  chimneyCount: string;
  skylightCount: string;
  siteNotes: string;
  materialSystem: string;
  materialPerSquare: string;
  crewSize: string;
  laborDays: string;
  hoursPerDay: string;
  hourlyRate: string;
  tearoffPerSquare: string;
  disposalFee: string;
  permitFee: string;
  deliveryFee: string;
  deckingSheetCost: string;
  allowance: string;
  other: string;
  overheadPercent: string;
  profitMarginPercent: string;
  scopeSelections: string[];
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
  roofAreaSqft: "",
  wastePercent: "10",
  existingLayers: "1",
  pitch: "moderate",
  access: "standard",
  deckingSheets: "0",
  ridgeFeet: "",
  valleyFeet: "",
  chimneyCount: "0",
  skylightCount: "0",
  siteNotes: "",
  materialSystem: "architectural_shingles",
  materialPerSquare: "",
  crewSize: "",
  laborDays: "",
  hoursPerDay: "8",
  hourlyRate: "",
  tearoffPerSquare: "",
  disposalFee: "",
  permitFee: "",
  deliveryFee: "",
  deckingSheetCost: "",
  allowance: "",
  other: "",
  overheadPercent: "10",
  profitMarginPercent: "20",
  scopeSelections: [
    "protect_property",
    "tear_off",
    "inspect_deck",
    "underlayment",
    "ice_water",
    "flashing",
    "roofing",
    "cleanup",
    "warranty",
  ],
  scope: "",
  exclusions: "",
  reference: "",
  validUntil: "",
  reasonCode: "scope_added",
  reasonDirection: "higher",
  reasonAmount: "",
  reasonExplanation: "",
};

const scopeOptions = [
  ["protect_property", "Property protection", "Protect landscaping, siding, and work areas."],
  ["tear_off", "Tear-off", "Remove and dispose of the existing roof system."],
  ["inspect_deck", "Deck inspection", "Inspect the exposed sheathing before covering it."],
  ["replace_decking", "Decking replacement", "Use the stated sheet allowance for damaged decking."],
  ["underlayment", "Underlayment", "Install the selected code-compliant underlayment."],
  ["ice_water", "Ice and water protection", "Protect required valleys, eaves, and penetrations."],
  ["flashing", "Flashing and pipe boots", "Replace or install the included flashing details."],
  ["ventilation", "Roof ventilation", "Complete the ventilation work included in the quote."],
  ["roofing", "Roofing system", "Install the selected finished roofing material."],
  ["cleanup", "Cleanup and haul-off", "Include debris removal and a magnetic nail sweep."],
  ["warranty", "Warranty documents", "Provide stated workmanship and manufacturer coverage."],
] as const;

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
  const [settings, setSettings] = useState<PilotSettings | null>(null);
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
      settingsResult,
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
      supabase.from("pilot_settings").select("*").eq("id", 1).single(),
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
      settingsResult.error,
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
    setSettings(settingsResult.data as PilotSettings);
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
  const contractorQuote =
    selectedQuotes.find((quote) => quote.contractor_id === profile.id) ?? null;
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

  const quoteCalculation = useMemo(
    () => calculateQuoteBuilder(quoteDraft),
    [quoteDraft],
  );

  const generatedScope = useMemo(
    () =>
      buildScopeSummary({
        materialSystem: quoteDraft.materialSystem,
        roofingSquares: quoteCalculation.roofingSquares,
        selections: quoteDraft.scopeSelections,
      }),
    [
      quoteCalculation.roofingSquares,
      quoteDraft.materialSystem,
      quoteDraft.scopeSelections,
    ],
  );

  useEffect(() => {
    if (profile.role !== "contractor" || !selectedProject) return;
    const timeout = window.setTimeout(() => {
      if (contractorQuote) {
        const builder = contractorQuote.builder_inputs ?? {};
        const site = contractorQuote.site_observations ?? {};
        const savedReason = reasons.find(
          (reason) => reason.quote_id === contractorQuote.id,
        );
        const savedSelections = (builder as Partial<QuoteDraft>).scopeSelections;
        setQuoteDraft({
          ...blankQuote,
          ...(builder as Partial<QuoteDraft>),
          ...(site as Partial<QuoteDraft>),
          scope: contractorQuote.scope_summary,
          exclusions: contractorQuote.exclusions,
          reference: contractorQuote.quote_reference ?? "",
          validUntil: contractorQuote.valid_until ?? "",
          reasonCode: savedReason?.reason_code ?? blankQuote.reasonCode,
          reasonDirection:
            savedReason?.direction ?? blankQuote.reasonDirection,
          reasonAmount: savedReason?.amount_effect?.toString() ?? "",
          reasonExplanation: savedReason?.explanation ?? "",
          scopeSelections: Array.isArray(savedSelections)
            ? savedSelections
            : blankQuote.scopeSelections,
        });
        return;
      }

      const expectedRoofArea =
        selectedEstimate?.calculation_result.scenarios.expected.roofAreaSqft ??
        selectedProject.footprint_sqft ??
        "";
      setQuoteDraft({
        ...blankQuote,
        roofAreaSqft: String(expectedRoofArea),
        existingLayers: String(selectedProject.existing_layers || 1),
        pitch: selectedProject.roof_pitch,
        access: selectedProject.access_level,
        deckingSheets: String(
          selectedProject.decking_allowance_sheets ?? 0,
        ),
        chimneyCount: String(selectedProject.chimney_count ?? 0),
        skylightCount: String(selectedProject.skylight_count ?? 0),
        materialSystem:
          selectedProject.roof_material === "unknown"
            ? blankQuote.materialSystem
            : selectedProject.roof_material,
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    contractorQuote,
    profile.role,
    reasons,
    selectedEstimate,
    selectedProject,
  ]);

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
      {
        p_project_id: selectedEnrollment.project_id,
        p_expires_days: settings?.invitation_expiry_days ?? 14,
      },
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

  function updateQuote<K extends keyof QuoteDraft>(
    field: K,
    value: QuoteDraft[K],
  ) {
    setQuoteDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleScopeItem(item: string) {
    setQuoteDraft((current) => ({
      ...current,
      scope: "",
      scopeSelections: current.scopeSelections.includes(item)
        ? current.scopeSelections.filter((selection) => selection !== item)
        : [...current.scopeSelections, item],
    }));
  }

  async function saveQuote(status: "draft" | "submitted") {
    if (!selectedProject || !selectedEstimate) {
      setError("This project needs a saved HUM estimate before quote capture.");
      return;
    }
    const scopeSummary = quoteDraft.scope.trim() || generatedScope;
    if (scopeSummary.length < 10) {
      setError("Add a clear scope summary before saving the quote.");
      return;
    }
    if (quoteCalculation.roofingSquares <= 0) {
      setError("Add the measured roof area before saving the quote.");
      return;
    }
    if (quoteCalculation.totalAmount <= 0) {
      setError("Complete the cost fields so the quote has a total.");
      return;
    }
    setBusy(`quote-${status}`);
    setError("");
    const {
      roofAreaSqft,
      wastePercent,
      existingLayers,
      pitch,
      access,
      deckingSheets,
      ridgeFeet,
      valleyFeet,
      chimneyCount,
      skylightCount,
      siteNotes,
      ...builderInputs
    } = quoteDraft;
    const quotePayload = {
      project_id: selectedProject.id,
      estimate_id: selectedEstimate.id,
      contractor_id: profile.id,
      status,
      material_amount: quoteCalculation.materialAmount,
      labor_amount: quoteCalculation.laborAmount,
      tearoff_disposal_amount: quoteCalculation.tearoffDisposalAmount,
      permit_delivery_amount: quoteCalculation.permitDeliveryAmount,
      allowance_amount: quoteCalculation.allowanceAmount,
      other_amount: quoteCalculation.otherAmount,
      site_observations: {
        roofAreaSqft,
        wastePercent,
        existingLayers,
        pitch,
        access,
        deckingSheets,
        ridgeFeet,
        valleyFeet,
        chimneyCount,
        skylightCount,
        siteNotes,
      },
      builder_inputs: {
        ...builderInputs,
        builderVersion: 1,
        calculatedRoofingSquares: quoteCalculation.roofingSquares,
        overheadAmount: quoteCalculation.overheadAmount,
        profitAmount: quoteCalculation.profitAmount,
      },
      scope_summary: scopeSummary,
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
    const { realProjectIds, testProjectIds } = buildPilotEvidenceScope(
      projects,
    ) as {
      realProjectIds: Set<string>;
      testProjectIds: Set<string>;
    };
    const testProfileIds = new Set(
      profiles.filter((item) => item.is_test_account).map((item) => item.id),
    );
    const realEnrollments = onlyRealProjectRows(
      enrollments,
      realProjectIds,
    ) as PilotEnrollment[];
    const testEnrollments = enrollments.filter((item) =>
      testProjectIds.has(item.project_id),
    );
    const submittedQuotes = quotes.filter(
      (quote) =>
        quote.status === "submitted" && realProjectIds.has(quote.project_id),
    );
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
    const realReasons = onlyRealProjectRows(
      reasons,
      realProjectIds,
    ) as QuoteDifferenceReason[];
    const realFeedback = onlyRealProjectRows(
      feedback,
      realProjectIds,
    ) as PilotFeedback[];
    const realIssues = issues.filter((issue) =>
      issue.project_id
        ? realProjectIds.has(issue.project_id)
        : !testProfileIds.has(issue.reported_by),
    );
    const realEvents = events.filter(
      (event) => !event.project_id || realProjectIds.has(event.project_id),
    );
    const criticalIssues = realIssues.filter(
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
          <PilotStat
            label="Real project target"
            value={`${realEnrollments.length} / 10`}
          />
          <PilotStat label="With actual quote" value={projectsWithQuotes.size.toString()} />
          <PilotStat label="Traceable reasons" value={realReasons.length.toString()} />
          <PilotStat
            label="Critical open issues"
            value={criticalIssues.length.toString()}
            alert={criticalIssues.length > 0}
          />
          <PilotStat
            label="QA enrollments excluded"
            value={testEnrollments.length.toString()}
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
            Variances of{" "}
            {settings?.variance_review_threshold_pct ?? 15}% or more require
            explicit human review.
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
                    {
                      realReasons.filter((reason) => reason.quote_id === quote.id)
                        .length
                    }
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
                        {contractor.is_test_account ? " · QA only" : ""}
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
            <Gate
              done={realEnrollments.length >= 10}
              label="10 real roofing projects"
            />
            <Gate
              done={
                realEnrollments.length >= 10 &&
                realEnrollments.every((item) =>
                  projectsWithQuotes.has(item.project_id),
                )
              }
              label="Every estimate compared with a quote"
            />
            <Gate
              done={realReasons.length > 0}
              label="Differences have reasons"
            />
            <Gate done={criticalIssues.length === 0} label="No critical privacy failures" />
            <Gate
              done={realFeedback.some((item) => item.audience === "contractor")}
              label="Contractor usefulness feedback"
            />
            <Gate
              done={realFeedback.some((item) => item.audience === "homeowner")}
              label="Homeowner understanding feedback"
            />
          </div>
          <p className={styles.pilotFootnote}>
            Real-project events recorded: {realEvents.length}. QA activity is
            excluded. Round 5 starts only after
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
        {profile.is_test_account && (
          <section className={styles.qaModeBanner}>
            <strong>QA rehearsal mode</strong>
            <span>
              Contractor reviews and quotes from this account never count
              toward the ten-project Phase 4 gate.
            </span>
          </section>
        )}

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

            <section className={styles.quoteBuilder}>
              <div className={styles.quoteBuilderHeader}>
                <div>
                  <p className={styles.kicker}>On-site quote builder</p>
                  <h2>Inspect once. Build the quote as you go.</h2>
                  <p>
                    Fill in what you measure on site. HUM calculates quantities,
                    cost groups, overhead, profit, and the homeowner quote
                    immediately.
                  </p>
                </div>
                {existingQuote && (
                  <span className={styles.savedQuoteBadge}>
                    {existingQuote.status} · {money(existingQuote.total_amount)}
                  </span>
                )}
              </div>

              <div className={styles.quoteStepBar} aria-label="Quote builder steps">
                <span><b>1</b> Site measurements</span>
                <span><b>2</b> Cost build-up</span>
                <span><b>3</b> Scope and finish</span>
              </div>

              <div className={styles.quoteBuilderLayout}>
                <div className={styles.quoteEditor}>
                  <QuoteSection
                    number="01"
                    title="On-site measurements"
                    copy="Start with what you can verify at the property. HUM already brought over the homeowner facts; replace them with your measurements."
                    action={
                      <button
                        className={styles.textButton}
                        type="button"
                        onClick={() => {
                          const roofArea =
                            selectedEstimate.calculation_result.scenarios
                              .expected.roofAreaSqft ??
                            selectedProject.footprint_sqft ??
                            "";
                          setQuoteDraft((current) => ({
                            ...current,
                            roofAreaSqft: String(roofArea),
                            existingLayers: String(
                              selectedProject.existing_layers || 1,
                            ),
                            pitch: selectedProject.roof_pitch,
                            access: selectedProject.access_level,
                            deckingSheets: String(
                              selectedProject.decking_allowance_sheets ?? 0,
                            ),
                            chimneyCount: String(
                              selectedProject.chimney_count ?? 0,
                            ),
                            skylightCount: String(
                              selectedProject.skylight_count ?? 0,
                            ),
                          }));
                        }}
                      >
                        Restore HUM facts
                      </button>
                    }
                  >
                    <div className={styles.quoteFieldGrid}>
                      <NumberField
                        label="Measured roof area"
                        suffix="sq ft"
                        help="Use your aerial report or field measurement. Enter roof surface area, not the home’s floor area."
                        value={quoteDraft.roofAreaSqft}
                        onChange={(value) => updateQuote("roofAreaSqft", value)}
                      />
                      <NumberField
                        label="Waste factor"
                        suffix="%"
                        help="Common planning range is 8–15%. Use more for cut-up roofs, valleys, and complex geometry."
                        value={quoteDraft.wastePercent}
                        onChange={(value) => updateQuote("wastePercent", value)}
                      />
                      <OutputField
                        label="Order quantity"
                        value={`${quoteCalculation.roofingSquares.toFixed(1)} squares`}
                        help="Automatically calculated from measured area plus waste. One roofing square equals 100 sq ft."
                      />
                      <NumberField
                        label="Existing roof layers"
                        suffix="layers"
                        help="Count the roof layers that must be removed."
                        value={quoteDraft.existingLayers}
                        onChange={(value) => updateQuote("existingLayers", value)}
                      />
                      <SelectField
                        label="Verified pitch"
                        value={quoteDraft.pitch}
                        onChange={(value) => updateQuote("pitch", value)}
                        options={[
                          ["low", "Low slope"],
                          ["moderate", "Moderate / walkable"],
                          ["steep", "Steep / special setup"],
                        ]}
                      />
                      <SelectField
                        label="Jobsite access"
                        value={quoteDraft.access}
                        onChange={(value) => updateQuote("access", value)}
                        options={[
                          ["easy", "Easy truck and dumpster access"],
                          ["standard", "Normal residential access"],
                          ["difficult", "Limited or difficult access"],
                        ]}
                      />
                      <NumberField
                        label="Decking allowance"
                        suffix="sheets"
                        help="Enter only sheets you are including. Hidden damage beyond this amount should be handled as a stated unit-price change."
                        value={quoteDraft.deckingSheets}
                        onChange={(value) => updateQuote("deckingSheets", value)}
                      />
                      <NumberField
                        label="Ridge length"
                        suffix="linear ft"
                        help="Total ridge and hip length used for ridge cap planning."
                        value={quoteDraft.ridgeFeet}
                        onChange={(value) => updateQuote("ridgeFeet", value)}
                      />
                      <NumberField
                        label="Valley length"
                        suffix="linear ft"
                        help="Total open or closed valley length."
                        value={quoteDraft.valleyFeet}
                        onChange={(value) => updateQuote("valleyFeet", value)}
                      />
                      <NumberField
                        label="Chimneys"
                        suffix="count"
                        value={quoteDraft.chimneyCount}
                        onChange={(value) => updateQuote("chimneyCount", value)}
                      />
                      <NumberField
                        label="Skylights"
                        suffix="count"
                        value={quoteDraft.skylightCount}
                        onChange={(value) => updateQuote("skylightCount", value)}
                      />
                    </div>
                    <label className={styles.field}>
                      <span>Site notes and concealed-condition warnings</span>
                      <textarea
                        rows={3}
                        value={quoteDraft.siteNotes}
                        onChange={(event) =>
                          updateQuote("siteNotes", event.target.value)
                        }
                        placeholder="Example: Soft decking visible at north eave; final quantity requires tear-off."
                      />
                    </label>
                  </QuoteSection>

                  <QuoteSection
                    number="02"
                    title="Build the real cost"
                    copy="Use your own supplier and labor numbers. Every field updates the quote preview on the right."
                  >
                    <div className={styles.quoteCostGroup}>
                      <div>
                        <strong>Roofing material</strong>
                        <span>
                          Order quantity × your installed material cost per square
                        </span>
                      </div>
                      <div className={styles.quoteFieldGrid}>
                        <SelectField
                          label="Material system"
                          value={quoteDraft.materialSystem}
                          onChange={(value) =>
                            updateQuote("materialSystem", value)
                          }
                          options={[
                            ["architectural_shingles", "Architectural shingles"],
                            ["three_tab_shingles", "Three-tab shingles"],
                            ["standing_seam_metal", "Standing-seam metal"],
                            ["exposed_fastener_metal", "Exposed-fastener metal"],
                            ["tile", "Tile"],
                            ["other", "Other system"],
                          ]}
                        />
                        <MoneyField
                          label="Material cost per square"
                          help="Include the roofing system, underlayment, starter, ridge cap, fasteners, flashing, and normal accessories."
                          value={quoteDraft.materialPerSquare}
                          onChange={(value) =>
                            updateQuote("materialPerSquare", value)
                          }
                        />
                        <OutputField
                          label="Calculated materials"
                          value={money(quoteCalculation.materialAmount)}
                        />
                      </div>
                    </div>

                    <div className={styles.quoteCostGroup}>
                      <div>
                        <strong>Labor plan</strong>
                        <span>
                          Crew size × days × hours per day × loaded hourly cost
                        </span>
                      </div>
                      <div className={styles.quoteFieldGrid}>
                        <NumberField
                          label="Crew size"
                          suffix="people"
                          value={quoteDraft.crewSize}
                          onChange={(value) => updateQuote("crewSize", value)}
                        />
                        <NumberField
                          label="Expected duration"
                          suffix="days"
                          value={quoteDraft.laborDays}
                          onChange={(value) => updateQuote("laborDays", value)}
                        />
                        <NumberField
                          label="Hours per day"
                          suffix="hours"
                          value={quoteDraft.hoursPerDay}
                          onChange={(value) => updateQuote("hoursPerDay", value)}
                        />
                        <MoneyField
                          label="Loaded cost per worker hour"
                          help="Use wage plus payroll burden, workers’ comp, and other direct labor burden."
                          value={quoteDraft.hourlyRate}
                          onChange={(value) => updateQuote("hourlyRate", value)}
                        />
                        <OutputField
                          label="Calculated labor"
                          value={money(quoteCalculation.laborAmount)}
                        />
                      </div>
                    </div>

                    <div className={styles.quoteCostGroup}>
                      <div>
                        <strong>Job-specific costs</strong>
                        <span>
                          Add actual costs and allowances that apply to this property
                        </span>
                      </div>
                      <div className={styles.quoteFieldGrid}>
                        <MoneyField
                          label="Tear-off per square, per layer"
                          value={quoteDraft.tearoffPerSquare}
                          onChange={(value) =>
                            updateQuote("tearoffPerSquare", value)
                          }
                        />
                        <MoneyField
                          label="Dumpster / disposal"
                          value={quoteDraft.disposalFee}
                          onChange={(value) =>
                            updateQuote("disposalFee", value)
                          }
                        />
                        <MoneyField
                          label="Permit"
                          value={quoteDraft.permitFee}
                          onChange={(value) => updateQuote("permitFee", value)}
                        />
                        <MoneyField
                          label="Delivery / equipment"
                          value={quoteDraft.deliveryFee}
                          onChange={(value) => updateQuote("deliveryFee", value)}
                        />
                        <MoneyField
                          label="Decking cost per sheet"
                          value={quoteDraft.deckingSheetCost}
                          onChange={(value) =>
                            updateQuote("deckingSheetCost", value)
                          }
                        />
                        <MoneyField
                          label="Other allowance"
                          help="Use for uncertain but included work. Explain it in the scope."
                          value={quoteDraft.allowance}
                          onChange={(value) => updateQuote("allowance", value)}
                        />
                        <MoneyField
                          label="Other direct cost"
                          value={quoteDraft.other}
                          onChange={(value) => updateQuote("other", value)}
                        />
                      </div>
                    </div>

                    <div className={styles.businessPricing}>
                      <div>
                        <strong>Business pricing</strong>
                        <span>
                          HUM keeps cost, overhead, and profit visible to you—not
                          the homeowner.
                        </span>
                      </div>
                      <NumberField
                        label="Overhead"
                        suffix="% of direct cost"
                        help="Office, vehicles, insurance, sales, software, and general operating expense."
                        value={quoteDraft.overheadPercent}
                        onChange={(value) =>
                          updateQuote("overheadPercent", value)
                        }
                      />
                      <NumberField
                        label="Target profit margin"
                        suffix="% of selling price"
                        help="This is margin, not markup. HUM calculates the correct selling price."
                        value={quoteDraft.profitMarginPercent}
                        onChange={(value) =>
                          updateQuote("profitMarginPercent", value)
                        }
                      />
                    </div>
                  </QuoteSection>

                  <QuoteSection
                    number="03"
                    title="Confirm scope and terms"
                    copy="Choose included work first. HUM turns those selections into an editable quote scope."
                  >
                    <div className={styles.scopeChecklist}>
                      {scopeOptions.map(([value, label, help]) => (
                        <label key={value}>
                          <input
                            type="checkbox"
                            checked={quoteDraft.scopeSelections.includes(value)}
                            onChange={() => toggleScopeItem(value)}
                          />
                          <span>
                            <strong>{label}</strong>
                            <small>{help}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <label className={styles.field}>
                      <span>Customer-facing scope</span>
                      <textarea
                        rows={9}
                        value={quoteDraft.scope || generatedScope}
                        onChange={(event) =>
                          updateQuote("scope", event.target.value)
                        }
                      />
                      <small>
                        Edit this freely. Clear it to rebuild from the checked
                        items.
                      </small>
                    </label>
                    <label className={styles.field}>
                      <span>Exclusions and change-order terms</span>
                      <textarea
                        rows={4}
                        value={quoteDraft.exclusions}
                        onChange={(event) =>
                          updateQuote("exclusions", event.target.value)
                        }
                        placeholder="Example: Concealed decking beyond 8 sheets is excluded and billed at the stated per-sheet price with homeowner approval."
                      />
                    </label>
                    <div className={styles.pilotThreeColumn}>
                      <label className={styles.field}>
                        <span>Quote number / reference</span>
                        <input
                          value={quoteDraft.reference}
                          onChange={(event) =>
                            updateQuote("reference", event.target.value)
                          }
                          placeholder="HUM-2026-001"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Valid until</span>
                        <input
                          type="date"
                          value={quoteDraft.validUntil}
                          onChange={(event) =>
                            updateQuote("validUntil", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <details className={styles.quoteDifference}>
                      <summary>Explain why this differs from HUM’s estimate</summary>
                      <p>
                        This does not change your price. It creates evidence HUM
                        can use to improve future planning estimates.
                      </p>
                      <div className={styles.pilotThreeColumn}>
                        <SelectField
                          label="Main reason"
                          value={quoteDraft.reasonCode}
                          onChange={(value) =>
                            updateQuote(
                              "reasonCode",
                              value as QuoteDifferenceReason["reason_code"],
                            )
                          }
                          options={[
                            ["material_price", "Material price"],
                            ["labor_rate", "Labor rate"],
                            ["scope_added", "Additional scope"],
                            ["scope_removed", "Reduced scope"],
                            ["measurement", "Field measurement"],
                            ["access", "Jobsite access"],
                            ["permit", "Permit requirement"],
                            ["disposal", "Disposal cost"],
                            ["warranty", "Warranty level"],
                            ["market_conditions", "Market conditions"],
                            ["allowance", "Allowance"],
                            ["other", "Other"],
                          ]}
                        />
                        <SelectField
                          label="Direction"
                          value={quoteDraft.reasonDirection}
                          onChange={(value) =>
                            updateQuote(
                              "reasonDirection",
                              value as QuoteDifferenceReason["direction"],
                            )
                          }
                          options={[
                            ["higher", "Higher than HUM"],
                            ["lower", "Lower than HUM"],
                            ["neutral", "Scope difference only"],
                          ]}
                        />
                        <MoneyField
                          label="Approximate amount effect"
                          value={quoteDraft.reasonAmount}
                          onChange={(value) =>
                            updateQuote("reasonAmount", value)
                          }
                        />
                      </div>
                      <label className={styles.field}>
                        <span>Site-specific explanation</span>
                        <textarea
                          rows={3}
                          value={quoteDraft.reasonExplanation}
                          onChange={(event) =>
                            updateQuote(
                              "reasonExplanation",
                              event.target.value,
                            )
                          }
                          placeholder="Example: Aerial measurement was 4.2 squares low and the rear roof requires hand-carry access."
                        />
                      </label>
                    </details>
                  </QuoteSection>
                </div>

                <aside className={styles.liveQuotePreview}>
                  <p className={styles.kicker}>Live quote</p>
                  <span className={styles.liveLabel}>Customer price</span>
                  <strong className={styles.liveTotal}>
                    {money(quoteCalculation.totalAmount)}
                  </strong>
                  <small>
                    {quoteCalculation.roofingSquares.toFixed(1)} roofing squares ·{" "}
                    {quoteDraft.materialSystem.replaceAll("_", " ")}
                  </small>
                  <div className={styles.liveBreakdown}>
                    <QuotePreviewRow
                      label="Materials"
                      value={quoteCalculation.materialAmount}
                    />
                    <QuotePreviewRow
                      label="Labor"
                      value={quoteCalculation.laborAmount}
                    />
                    <QuotePreviewRow
                      label="Tear-off + disposal"
                      value={quoteCalculation.tearoffDisposalAmount}
                    />
                    <QuotePreviewRow
                      label="Permit + delivery"
                      value={quoteCalculation.permitDeliveryAmount}
                    />
                    <QuotePreviewRow
                      label="Allowances"
                      value={quoteCalculation.allowanceAmount}
                    />
                    <QuotePreviewRow
                      label="Other direct cost"
                      value={quoteCalculation.baseOtherAmount}
                    />
                  </div>
                  <div className={styles.privatePricing}>
                    <span>
                      <small>Direct job cost</small>
                      <strong>{money(quoteCalculation.directCost)}</strong>
                    </span>
                    <span>
                      <small>Overhead</small>
                      <strong>{money(quoteCalculation.overheadAmount)}</strong>
                    </span>
                    <span>
                      <small>Target profit</small>
                      <strong>{money(quoteCalculation.profitAmount)}</strong>
                    </span>
                  </div>
                  <div className={styles.quotePreviewActions}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={busy.startsWith("quote-")}
                      onClick={() => saveQuote("draft")}
                    >
                      {busy === "quote-draft" ? "Saving…" : "Save draft"}
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
                      {busy === "quote-submitted"
                        ? "Submitting…"
                        : existingQuote?.status === "submitted"
                          ? "Update submitted quote"
                          : "Submit actual quote"}
                    </button>
                  </div>
                  <p className={styles.pilotFootnote}>
                    Drafts reopen with every field intact. Submission records
                    evidence only; HUM does not award the job or process money.
                  </p>
                </aside>
              </div>
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
      {profile.is_test_account && (
        <section className={styles.qaModeBanner}>
          <strong>QA rehearsal mode</strong>
          <span>
            This account, its projects, quotes, feedback, and outcomes are
            excluded from all real-pilot exit metrics.
          </span>
        </section>
      )}
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
          {settings?.enrollments_paused && !selectedProject.is_test && (
            <p className={styles.pilotWarning}>
              New real-project enrollments are currently paused by the pilot
              administrator. Existing projects remain available.
            </p>
          )}
          <div className={styles.pilotConsent}>
            <strong>By enrolling, you confirm:</strong>
            <span>Only you, HUM administrators, and contractors you invite can access it.</span>
            <span>The HUM range is a planning estimate, not a quote.</span>
            <span>Quote and outcome data will be used to improve Humboldt pricing.</span>
            <span>No project is posted publicly and no work is awarded in Round 4.</span>
          </div>
          <button
            className={styles.primaryButton}
            disabled={
              busy === "enroll" ||
              (!!settings?.enrollments_paused && !selectedProject.is_test)
            }
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
              expires after {settings?.invitation_expiry_days ?? 14} days, and
              grants access to this project alone.
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
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
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
      {help && <small>{help}</small>}
    </label>
  );
}

function NumberField({
  label,
  suffix,
  help,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.inputWithSuffix}>
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
        />
        {suffix && <b>{suffix}</b>}
      </span>
      {help && <small>{help}</small>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function OutputField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className={styles.outputField}>
      <span>{label}</span>
      <strong>{value}</strong>
      {help && <small>{help}</small>}
    </div>
  );
}

function QuoteSection({
  number,
  title,
  copy,
  action,
  children,
}: {
  number: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.quoteSection}>
      <header>
        <span>{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function QuotePreviewRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span>
      <small>{label}</small>
      <strong>{money(value)}</strong>
    </span>
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
