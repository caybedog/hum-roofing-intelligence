"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  ContractorQuote,
  EstimateRecord,
  PilotEnrollment,
  PilotFeedback,
  PilotInvitation,
  PilotOutcome,
  PilotSettings,
  Profile,
  Project,
  ProjectPhoto,
  ProjectShare,
  QaRun,
  QuoteDifferenceReason,
} from "./types";
import styles from "./foundation.module.css";

type Credentials = {
  homeowner: { email: string; password: string };
  contractor: { email: string; password: string };
};

type RehearsalData = {
  projects: Project[];
  estimates: EstimateRecord[];
  photos: ProjectPhoto[];
  shares: ProjectShare[];
  enrollments: PilotEnrollment[];
  invitations: PilotInvitation[];
  quotes: ContractorQuote[];
  reasons: QuoteDifferenceReason[];
  feedback: PilotFeedback[];
  outcomes: PilotOutcome[];
  approvedContractors: Set<string>;
};

const emptyData: RehearsalData = {
  projects: [],
  estimates: [],
  photos: [],
  shares: [],
  enrollments: [],
  invitations: [],
  quotes: [],
  reasons: [],
  feedback: [],
  outcomes: [],
  approvedContractors: new Set(),
};

export default function QaWorkspace({ profile }: { profile: Profile }) {
  const supabase = getSupabaseBrowserClient();
  const [runs, setRuns] = useState<QaRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [settings, setSettings] = useState<PilotSettings | null>(null);
  const [data, setData] = useState<RehearsalData>(emptyData);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [label, setLabel] = useState("Phase 4A end-to-end rehearsal");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [
      runResult,
      settingsResult,
      projectResult,
      estimateResult,
      photoResult,
      shareResult,
      enrollmentResult,
      invitationResult,
      quoteResult,
      reasonResult,
      feedbackResult,
      outcomeResult,
      contractorResult,
    ] = await Promise.all([
      supabase.from("qa_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("pilot_settings").select("*").eq("id", 1).single(),
      supabase.from("projects").select("*").eq("is_test", true),
      supabase.from("estimates").select("*").order("created_at", { ascending: false }),
      supabase.from("project_photos").select("*"),
      supabase.from("project_shares").select("*"),
      supabase.from("pilot_enrollments").select("*"),
      supabase
        .from("pilot_invitations")
        .select(
          "id,project_id,created_by,expires_at,accepted_by,accepted_at,revoked_at,created_at",
        ),
      supabase.from("contractor_quotes").select("*"),
      supabase.from("quote_difference_reasons").select("*"),
      supabase.from("pilot_feedback").select("*"),
      supabase.from("pilot_outcomes").select("*"),
      supabase.from("pilot_contractor_profiles").select("*").eq("status", "approved"),
    ]);

    const firstError = [
      runResult.error,
      settingsResult.error,
      projectResult.error,
      estimateResult.error,
      photoResult.error,
      shareResult.error,
      enrollmentResult.error,
      invitationResult.error,
      quoteResult.error,
      reasonResult.error,
      feedbackResult.error,
      outcomeResult.error,
      contractorResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const runRows = (runResult.data ?? []) as QaRun[];
    setRuns(runRows);
    setSettings(settingsResult.data as PilotSettings);
    setData({
      projects: (projectResult.data ?? []) as Project[],
      estimates: (estimateResult.data ?? []) as EstimateRecord[],
      photos: (photoResult.data ?? []) as ProjectPhoto[],
      shares: (shareResult.data ?? []) as ProjectShare[],
      enrollments: (enrollmentResult.data ?? []) as PilotEnrollment[],
      invitations: (invitationResult.data ?? []) as PilotInvitation[],
      quotes: (quoteResult.data ?? []) as ContractorQuote[],
      reasons: (reasonResult.data ?? []) as QuoteDifferenceReason[],
      feedback: (feedbackResult.data ?? []) as PilotFeedback[],
      outcomes: (outcomeResult.data ?? []) as PilotOutcome[],
      approvedContractors: new Set(
        (contractorResult.data ?? []).map((row) => row.contractor_id),
      ),
    });
    setSelectedRunId((current) => {
      if (current && runRows.some((run) => run.id === current)) return current;
      return runRows.find((run) => run.status === "active")?.id ?? runRows[0]?.id ?? "";
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const runProjectIds = useMemo(() => {
    if (!selectedRun) return new Set<string>();
    return new Set(
      data.projects
        .filter((project) => project.homeowner_id === selectedRun.homeowner_user_id)
        .map((project) => project.id),
    );
  }, [data.projects, selectedRun]);

  const steps = useMemo(() => {
    if (!selectedRun) return [];
    const projects = data.projects.filter((project) => runProjectIds.has(project.id));
    const estimates = data.estimates.filter((item) =>
      runProjectIds.has(item.project_id),
    );
    const photos = data.photos.filter((item) => runProjectIds.has(item.project_id));
    const shares = data.shares.filter(
      (item) => runProjectIds.has(item.project_id) && !item.revoked_at,
    );
    const enrollments = data.enrollments.filter((item) =>
      runProjectIds.has(item.project_id),
    );
    const invitations = data.invitations.filter(
      (item) => runProjectIds.has(item.project_id) && item.accepted_at,
    );
    const quotes = data.quotes.filter(
      (item) => runProjectIds.has(item.project_id) && item.status === "submitted",
    );
    const reasons = data.reasons.filter((item) =>
      runProjectIds.has(item.project_id),
    );
    const feedback = data.feedback.filter((item) =>
      runProjectIds.has(item.project_id),
    );
    const outcomes = data.outcomes.filter((item) =>
      runProjectIds.has(item.project_id),
    );

    return [
      { label: "Disposable homeowner and contractor accounts", done: true },
      { label: "Homeowner intake project created", done: projects.length > 0 },
      { label: "Versioned HUM estimate generated", done: estimates.length > 0 },
      { label: "Private project photo uploaded", done: photos.length > 0 },
      { label: "Test project enrolled in pilot", done: enrollments.length > 0 },
      {
        label: "QA contractor manually approved",
        done: data.approvedContractors.has(selectedRun.contractor_user_id),
      },
      {
        label: "Invitation accepted and project shared",
        done: invitations.length > 0 && shares.length > 0,
      },
      {
        label: "Actual quote and difference reason submitted",
        done: quotes.length > 0 && reasons.length > 0,
      },
      {
        label: "Homeowner and contractor feedback captured",
        done:
          feedback.some((item) => item.audience === "homeowner") &&
          feedback.some((item) => item.audience === "contractor"),
      },
      { label: "Real-world outcome recorded", done: outcomes.length > 0 },
    ];
  }, [data, runProjectIds, selectedRun]);

  const completedSteps = steps.filter((step) => step.done).length;

  async function createRehearsal() {
    setBusy("create");
    setError("");
    setNotice("");
    setCredentials(null);
    const { data: result, error: invokeError } = await supabase.functions.invoke(
      "phase4a-admin",
      { body: { action: "create_rehearsal", label } },
    );
    if (invokeError || result?.error || !result?.credentials) {
      setError(
        result?.error ?? invokeError?.message ?? "QA accounts could not be created.",
      );
    } else {
      setCredentials(result.credentials as Credentials);
      setNotice(
        "Disposable accounts created. Save both passwords now—they are shown only once.",
      );
      await load();
      setSelectedRunId(result.run.id);
    }
    setBusy("");
  }

  async function resetRehearsal() {
    if (!selectedRun) return;
    setBusy("reset");
    setError("");
    const { data: result, error: invokeError } = await supabase.functions.invoke(
      "phase4a-admin",
      {
        body: {
          action: "reset_rehearsal",
          runId: selectedRun.id,
          confirmation,
        },
      },
    );
    if (invokeError || result?.error) {
      setError(
        result?.error ?? invokeError?.message ?? "Test data could not be reset.",
      );
    } else {
      setCredentials(null);
      setConfirmation("");
      setNotice(
        `Test-only cleanup complete. ${result.removedProjectCount ?? 0} rehearsal project(s) removed; real pilot evidence was untouched.`,
      );
      await load();
    }
    setBusy("");
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy("settings");
    setError("");
    const { data: saved, error: saveError } = await supabase
      .from("pilot_settings")
      .update({
        enrollments_paused: settings.enrollments_paused,
        invitation_expiry_days: settings.invitation_expiry_days,
        variance_review_threshold_pct: settings.variance_review_threshold_pct,
        support_email: settings.support_email.trim(),
        admin_notes: settings.admin_notes.trim(),
        updated_by: profile.id,
      })
      .eq("id", 1)
      .select("*")
      .single();
    if (saveError || !saved) {
      setError(saveError?.message ?? "Pilot settings could not be saved.");
    } else {
      setSettings(saved as PilotSettings);
      setNotice("Pilot settings saved and audit-recorded.");
    }
    setBusy("");
  }

  async function copy(value: string, labelText: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${labelText} copied.`);
    } catch {
      setNotice("Select the value and copy it manually.");
    }
  }

  if (loading) {
    return (
      <main className={styles.workspace}>
        <p className={styles.kicker}>Phase 4A · Admin QA</p>
        <h1>Loading the protected rehearsal lane…</h1>
      </main>
    );
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeading}>
        <p className={styles.kicker}>Phase 4A · Admin QA</p>
        <h1>Rehearse every role without polluting pilot evidence.</h1>
        <p>
          Create disposable accounts, run the homeowner-to-contractor workflow,
          inspect its progress, and remove only the marked test records.
        </p>
        <div className={styles.pilotBoundary}>
          <strong>Roadmap boundary</strong>
          <span>
            QA records are excluded from the 10 real-project target · Round 5
            remains locked
          </span>
        </div>
      </header>

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.qaSummaryGrid}>
        <article className={styles.pilotStat}>
          <span>Active rehearsals</span>
          <strong>{runs.filter((run) => run.status === "active").length}</strong>
        </article>
        <article className={styles.pilotStat}>
          <span>Selected flow</span>
          <strong>
            {steps.length ? `${completedSteps} / ${steps.length}` : "Not started"}
          </strong>
        </article>
        <article className={styles.pilotStat}>
          <span>Real pilot credit</span>
          <strong>0</strong>
        </article>
      </section>

      <div className={styles.pilotTwoColumn}>
        <section className={styles.pilotPanel}>
          <p className={styles.kicker}>Disposable identities</p>
          <h2>Create a fresh role-separated rehearsal.</h2>
          <label className={styles.field}>
            <span>Rehearsal label</span>
            <input
              value={label}
              maxLength={120}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={busy === "create" || label.trim().length < 3}
            onClick={createRehearsal}
          >
            {busy === "create" ? "Creating…" : "Create test accounts"}
          </button>
          <p className={styles.pilotFootnote}>
            These accounts are confirmed automatically, marked as QA, and never
            included in real pilot reporting.
          </p>
        </section>

        <section className={styles.pilotPanel}>
          <p className={styles.kicker}>Current rehearsal</p>
          <h2>Choose the flow to inspect.</h2>
          <label className={styles.field}>
            <span>QA run</span>
            <select
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
            >
              <option value="">No rehearsal created</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.label} · {run.status}
                </option>
              ))}
            </select>
          </label>
          {selectedRun && (
            <div className={styles.qaIdentityList}>
              <span>
                <strong>Homeowner</strong>
                {selectedRun.homeowner_email}
              </span>
              <span>
                <strong>Contractor</strong>
                {selectedRun.contractor_email}
              </span>
            </div>
          )}
        </section>
      </div>

      {credentials && (
        <section className={styles.qaCredentialPanel}>
          <div>
            <p className={styles.kicker}>Shown once</p>
            <h2>Save these temporary logins before leaving this page.</h2>
            <p>
              Keep this admin session open. Each role link opens an isolated HUM
              session, so signing in or out there will not replace this tab.
            </p>
          </div>
          {(["homeowner", "contractor"] as const).map((role) => (
            <article key={role}>
              <span>{role}</span>
              <label>
                Email
                <input readOnly value={credentials[role].email} />
              </label>
              <label>
                Temporary password
                <input readOnly value={credentials[role].password} />
              </label>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  copy(
                    `${credentials[role].email}\n${credentials[role].password}`,
                    `${role} login`,
                  )
                }
              >
                Copy {role} login
              </button>
              <a
                className={styles.secondaryButton}
                href={`/?auth_slot=qa-${role}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open isolated {role} tab
              </a>
            </article>
          ))}
        </section>
      )}

      {selectedRun && (
        <section className={styles.pilotPanel}>
          <div className={styles.pilotPanelHead}>
            <div>
              <p className={styles.kicker}>End-to-end rehearsal</p>
              <h2>One visible checklist across all three roles.</h2>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void load()}
            >
              Refresh progress
            </button>
          </div>
          <div className={styles.qaChecklist}>
            {steps.map((step, index) => (
              <div className={step.done ? styles.qaStepDone : ""} key={step.label}>
                <span>{step.done ? "✓" : index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.done ? "Complete" : "Waiting"}</small>
              </div>
            ))}
          </div>
          <div className={styles.qaRunGuide}>
            <strong>Recommended order</strong>
            <span>1. Sign in as homeowner and complete intake, photo, estimate, and enrollment.</span>
            <span>2. Return here and approve the QA contractor under Pilot support.</span>
            <span>3. Sign in as contractor, accept the invite, submit corrections, quote, and feedback.</span>
            <span>4. Sign in as homeowner, review the comparison, save feedback and an outcome.</span>
            <span>5. Return here, verify all ten checks, then reset the rehearsal.</span>
          </div>
        </section>
      )}

      {settings && (
        <form className={styles.pilotPanel} onSubmit={saveSettings}>
          <div className={styles.pilotPanelHead}>
            <div>
              <p className={styles.kicker}>Persistent pilot controls</p>
              <h2>Change settings with an audit trail.</h2>
            </div>
            <span className={styles.statusPill}>
              Saved {new Date(settings.updated_at).toLocaleString()}
            </span>
          </div>
          <div className={styles.pilotThreeColumn}>
            <label className={styles.field}>
              <span>New real enrollments</span>
              <select
                value={settings.enrollments_paused ? "paused" : "open"}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    enrollments_paused: event.target.value === "paused",
                  })
                }
              >
                <option value="open">Open</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Invitation expiry (days)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.invitation_expiry_days}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    invitation_expiry_days: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className={styles.field}>
              <span>Variance review threshold (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={settings.variance_review_threshold_pct}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    variance_review_threshold_pct: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>Pilot support email</span>
            <input
              type="email"
              value={settings.support_email}
              onChange={(event) =>
                setSettings({ ...settings, support_email: event.target.value })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Private administrator notes</span>
            <textarea
              rows={3}
              value={settings.admin_notes}
              onChange={(event) =>
                setSettings({ ...settings, admin_notes: event.target.value })
              }
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={busy === "settings"}
          >
            {busy === "settings" ? "Saving…" : "Save pilot settings"}
          </button>
        </form>
      )}

      {selectedRun?.status === "active" && (
        <section className={styles.qaResetPanel}>
          <div>
            <p className={styles.kicker}>Test-only cleanup</p>
            <h2>Reset this rehearsal safely.</h2>
            <p>
              Removes only this run’s marked QA accounts, projects, photos,
              estimates, invitations, quotes, feedback, and outcomes. Real pilot
              records are never selected.
            </p>
          </div>
          <label className={styles.field}>
            <span>Type RESET TEST FLOW</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={busy === "reset" || confirmation !== "RESET TEST FLOW"}
            onClick={resetRehearsal}
          >
            {busy === "reset" ? "Resetting…" : "Delete this test flow"}
          </button>
        </section>
      )}
    </main>
  );
}
