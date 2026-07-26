"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  ContractorMarketRecord,
  HumRole,
  PricingItem,
  PricingSource,
  PricingVersion,
  Profile,
  PublicProjectEvidence,
  Project,
} from "./types";
import type { WorkspaceView } from "./shell";
import styles from "./foundation.module.css";

type PricingObservation = {
  id: string;
  project_id: string;
  pricing_code: string;
  observed_value: number;
  source_note: string;
  status: "proposed" | "reviewed" | "rejected";
  created_at: string;
};

type AiRequest = {
  id: string;
  status: "pending" | "completed" | "fallback" | "error";
  model: string;
  input_chars: number;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
};

type AuditEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default function AdminWorkspace({
  profile,
  view,
  onView,
}: {
  profile: Profile;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const [items, setItems] = useState<PricingItem[]>([]);
  const [pricingSources, setPricingSources] = useState<PricingSource[]>([]);
  const [contractorMarket, setContractorMarket] = useState<
    ContractorMarketRecord[]
  >([]);
  const [publicEvidence, setPublicEvidence] = useState<
    PublicProjectEvidence[]
  >([]);
  const [observations, setObservations] = useState<PricingObservation[]>([]);
  const [aiRequests, setAiRequests] = useState<AiRequest[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState({
    versionCode: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    sourceSummary: "",
    changeSummary: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [
      projectResult,
      profileResult,
      versionResult,
      observationResult,
      aiResult,
      auditResult,
      sourceResult,
      marketResult,
      publicEvidenceResult,
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").order("email"),
      supabase
        .from("pricing_versions")
        .select("*")
        .order("effective_date", { ascending: false }),
      supabase
        .from("pricing_observations")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("pricing_sources")
        .select("*")
        .order("verified_at", { ascending: false }),
      supabase
        .from("contractor_market_records")
        .select("*")
        .order("city")
        .order("company_name"),
      supabase
        .from("public_project_evidence")
        .select("*")
        .order("verified_at", { ascending: false }),
    ]);

    const firstError = [
      projectResult.error,
      profileResult.error,
      versionResult.error,
      observationResult.error,
      aiResult.error,
      auditResult.error,
      sourceResult.error,
      marketResult.error,
      publicEvidenceResult.error,
    ].find(Boolean);
    if (firstError) setError(firstError.message);

    const versionRows = (versionResult.data ?? []) as PricingVersion[];
    setProjects((projectResult.data ?? []) as Project[]);
    setProfiles((profileResult.data ?? []) as Profile[]);
    setVersions(versionRows);
    setObservations(
      (observationResult.data ?? []) as PricingObservation[],
    );
    setAiRequests((aiResult.data ?? []) as AiRequest[]);
    setAudits((auditResult.data ?? []) as AuditEvent[]);
    setPricingSources((sourceResult.data ?? []) as PricingSource[]);
    setContractorMarket(
      (marketResult.data ?? []) as ContractorMarketRecord[],
    );
    setPublicEvidence(
      (publicEvidenceResult.data ?? []) as PublicProjectEvidence[],
    );
    setSelectedVersionId((current) =>
      current && versionRows.some((version) => version.id === current)
        ? current
        : (versionRows[0]?.id ?? ""),
    );
    setLoading(false);
  }, [supabase]);

  const loadItems = useCallback(
    async (versionId: string) => {
      if (!versionId) {
        setItems([]);
        return;
      }
      const { data, error: itemError } = await supabase
        .from("pricing_items")
        .select("*")
        .eq("pricing_version_id", versionId)
        .order("category")
        .order("code");
      if (itemError) setError(itemError.message);
      setItems((data ?? []) as PricingItem[]);
    },
    [supabase],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadAll]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadItems(selectedVersionId),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [loadItems, selectedVersionId]);

  async function clonePricing(event: React.FormEvent) {
    event.preventDefault();
    const source = versions.find(
      (version) =>
        version.id === selectedVersionId && version.status === "approved",
    );
    if (!source) {
      setError("Choose an approved pricing version to clone.");
      return;
    }
    if (!proposal.versionCode.trim() || !proposal.sourceSummary.trim()) {
      setError("Version code and source summary are required.");
      return;
    }

    setBusy("clone");
    setError("");
    const { data: version, error: versionError } = await supabase
      .from("pricing_versions")
      .insert({
        version_code: proposal.versionCode.trim(),
        region: source.region,
        category: source.category,
        status: "proposed",
        effective_date: proposal.effectiveDate,
        source_summary: proposal.sourceSummary.trim(),
        confidence: "medium",
        change_summary: proposal.changeSummary.trim(),
        created_by: profile.id,
      })
      .select("*")
      .single();

    if (versionError || !version) {
      setError(
        versionError?.message ?? "The proposed version could not be created.",
      );
      setBusy("");
      return;
    }

    const { error: itemsError } = await supabase.from("pricing_items").insert(
      items.map((item) => ({
        pricing_version_id: version.id,
        code: item.code,
        category: item.category,
        label: item.label,
        unit: item.unit,
        low_value: item.low_value,
        expected_value: item.expected_value,
        high_value: item.high_value,
        source_name: item.source_name,
        source_url: item.source_url,
        verified_at: item.verified_at,
        confidence: item.confidence,
        change_note: "Cloned for administrator review.",
        created_by: profile.id,
      })),
    );

    if (itemsError) {
      setError(
        `The version was created, but its inputs failed to copy: ${itemsError.message}`,
      );
      setBusy("");
      return;
    }

    setProposal({
      versionCode: "",
      effectiveDate: new Date().toISOString().slice(0, 10),
      sourceSummary: "",
      changeSummary: "",
    });
    setNotice(
      "Proposed pricing version created. Edit its inputs, then approve it as a separate immutable version.",
    );
    await loadAll();
    setSelectedVersionId(version.id);
    setBusy("");
  }

  async function updateItem(
    item: PricingItem,
    key: "low_value" | "expected_value" | "high_value",
    value: string,
  ) {
    const numericValue = Number(value);
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, [key]: numericValue }
          : currentItem,
      ),
    );
  }

  async function savePricingItems() {
    const selected = versions.find(
      (version) => version.id === selectedVersionId,
    );
    if (!selected || selected.status !== "proposed") return;
    const invalid = items.some(
      (item) =>
        item.low_value > item.expected_value ||
        item.expected_value > item.high_value,
    );
    if (invalid) {
      setError("Every pricing row must stay ordered low ≤ expected ≤ high.");
      return;
    }
    setBusy("pricing");
    setError("");
    for (const item of items) {
      const { error: updateError } = await supabase
        .from("pricing_items")
        .update({
          low_value: item.low_value,
          expected_value: item.expected_value,
          high_value: item.high_value,
          verified_at: new Date().toISOString().slice(0, 10),
          change_note: "Administrator-reviewed proposed value.",
        })
        .eq("id", item.id);
      if (updateError) {
        setError(updateError.message);
        setBusy("");
        return;
      }
    }
    setNotice("Proposed values saved. Prior approved versions remain unchanged.");
    await loadItems(selectedVersionId);
    setBusy("");
  }

  async function approveVersion() {
    const selected = versions.find(
      (version) => version.id === selectedVersionId,
    );
    if (!selected || selected.status !== "proposed") return;
    setBusy("approve");
    setError("");
    const { error: approveError } = await supabase.rpc(
      "approve_pricing_version",
      { p_version_id: selected.id },
    );
    if (approveError) setError(approveError.message);
    else {
      setNotice(
        "Pricing version approved and locked. Existing estimates still reference their original version.",
      );
      await loadAll();
    }
    setBusy("");
  }

  async function reviewObservation(
    observation: PricingObservation,
    status: "reviewed" | "rejected",
  ) {
    setBusy(`observation-${observation.id}`);
    const { error: updateError } = await supabase
      .from("pricing_observations")
      .update({
        status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", observation.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(
        status === "reviewed"
          ? "Observation marked reviewed. Create a proposed pricing version before using it."
          : "Observation rejected without changing approved pricing.",
      );
      await loadAll();
    }
    setBusy("");
  }

  async function changeRole(user: Profile, role: HumRole) {
    if (user.id === profile.id && role !== "administrator") {
      setError("You cannot remove your own administrator access here.");
      return;
    }
    setBusy(`role-${user.id}`);
    const { error: roleError } = await supabase.rpc("admin_set_user_role", {
      p_user_id: user.id,
      p_role: role,
    });
    if (roleError) setError(roleError.message);
    else {
      setNotice(`Account role updated to ${role}.`);
      await loadAll();
    }
    setBusy("");
  }

  async function updateRecruitmentStatus(
    contractor: ContractorMarketRecord,
    status: ContractorMarketRecord["recruitment_status"],
  ) {
    setBusy(`market-${contractor.id}`);
    setError("");
    const { error: marketError } = await supabase
      .from("contractor_market_records")
      .update({ recruitment_status: status })
      .eq("id", contractor.id);
    if (marketError) setError(marketError.message);
    else {
      setNotice(
        `${contractor.company_name} moved to ${status.replaceAll("_", " ")}. This changes recruitment tracking only—not pricing.`,
      );
      await loadAll();
    }
    setBusy("");
  }

  const selectedVersion = versions.find(
    (version) => version.id === selectedVersionId,
  );
  const operationStats = useMemo(() => {
    const fallbacks = aiRequests.filter(
      (request) => request.status === "fallback",
    ).length;
    return {
      users: profiles.length,
      projects: projects.filter((project) => !project.is_test).length,
      testProjects: projects.filter((project) => project.is_test).length,
      aiRequests: aiRequests.length,
      fallbackRate: aiRequests.length
        ? Math.round((fallbacks / aiRequests.length) * 100)
        : 0,
    };
  }, [aiRequests, profiles.length, projects]);

  if (loading) {
    return (
      <div className={styles.workspaceLoading}>
        <span />
        <p>Loading protected operations…</p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      {(notice || error) && (
        <div
          className={`${styles.toast} ${error ? styles.toastError : ""}`}
          role="status"
        >
          {error || notice}
          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}

      {view === "projects" && (
        <>
          <PageHeading
            kicker="Administrator overview"
            title="The secure foundation at a glance."
            copy="Administrative visibility is enforced by a server-side role. This screen does not grant or widen access by itself."
          />
          <div className={styles.trustGrid}>
            <StatCard label="Accounts" value={operationStats.users} />
            <StatCard label="Real projects" value={operationStats.projects} />
            <StatCard label="QA projects" value={operationStats.testProjects} />
            <StatCard
              label="Estimate versions"
              value={projects.reduce(
                (total, project) =>
                  total + (project.status === "estimated" ? 1 : 0),
                0,
              )}
            />
            <StatCard
              label="Pricing observations"
              value={observations.filter((item) => item.status === "proposed").length}
            />
          </div>
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>All projects</p>
                <h2>Owned project records</h2>
              </div>
              <span className={styles.sourceTag}>Admin visibility</span>
            </div>
            <div className={styles.historyPanel}>
              {projects.length ? (
                projects.map((project) => (
                  <div className={styles.historyRow} key={project.id}>
                    <strong>{project.title}</strong>
                    <span>{project.city}, CA</span>
                    <span>
                      {project.status}
                      {project.is_test ? " · QA only" : ""}
                    </span>
                    <small>
                      {new Date(project.updated_at).toLocaleString()}
                    </small>
                  </div>
                ))
              ) : (
                <p className={styles.muted}>No projects created yet.</p>
              )}
            </div>
          </section>
        </>
      )}

      {view === "pricing" && (
        <>
          <PageHeading
            kicker="Versioned regional intelligence"
            title="Approve new evidence. Never rewrite history."
            copy="Approved catalogs are immutable. HUM creates a separate proposed version for every change and every estimate keeps its original catalog ID."
          />
          <div className={styles.warningBanner}>
            <strong>Roadmap gate</strong>
            <span>
              Homeowners do not need a contractor quote. Public evidence and
              contractor observations enter a review boundary and cannot
              change an approved regional price automatically.
            </span>
          </div>
          <div className={styles.trustGrid}>
            <StatCard
              label="Evidence snapshots"
              value={pricingSources.length}
            />
            <StatCard
              label="Official sources"
              value={
                pricingSources.filter(
                  (source) => source.source_type === "government",
                ).length
              }
            />
            <StatCard
              label="Low-confidence inputs"
              value={
                items.filter((item) => item.confidence === "low").length
              }
            />
            <StatCard
              label="Contractor candidates"
              value={
                contractorMarket.filter(
                  (contractor) =>
                    contractor.recruitment_status === "candidate",
                ).length
              }
            />
            <StatCard
              label="Public scopes"
              value={publicEvidence.length}
            />
          </div>
          <div className={styles.intakeLayout}>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.kicker}>Catalog history</p>
                  <h2>Humboldt roofing versions</h2>
                </div>
              </div>
              <label className={styles.field}>
                <span>Pricing version</span>
                <select
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version_code} · {version.status}
                    </option>
                  ))}
                </select>
              </label>
              {selectedVersion && (
                <div className={styles.dataPreview}>
                  <strong>{selectedVersion.version_code}</strong>
                  <span>Effective {selectedVersion.effective_date}</span>
                  <span>Confidence {selectedVersion.confidence}</span>
                  <span>{selectedVersion.source_summary}</span>
                  <span>{selectedVersion.change_summary}</span>
                </div>
              )}
            </section>
            <form className={styles.sideCard} onSubmit={clonePricing}>
              <p className={styles.kicker}>Controlled update</p>
              <h2>Clone approved version</h2>
              <label className={styles.field}>
                <span>New version code</span>
                <input
                  required
                  value={proposal.versionCode}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      versionCode: event.target.value,
                    })
                  }
                  placeholder="HUM-HC-ROOF-2026.08"
                />
              </label>
              <label className={styles.field}>
                <span>Effective date</span>
                <input
                  required
                  type="date"
                  value={proposal.effectiveDate}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      effectiveDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Source summary</span>
                <textarea
                  required
                  rows={3}
                  value={proposal.sourceSummary}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      sourceSummary: event.target.value,
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Change summary</span>
                <textarea
                  rows={3}
                  value={proposal.changeSummary}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      changeSummary: event.target.value,
                    })
                  }
                />
              </label>
              <button
                className={styles.primaryButton}
                disabled={busy === "clone"}
              >
                {busy === "clone" ? "Cloning…" : "Create proposed version"}
              </button>
            </form>
          </div>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Regional inputs</p>
                <h2>Low, expected, and high values</h2>
              </div>
              {selectedVersion && (
                <span className={styles.statusPill}>
                  {selectedVersion.status}
                </span>
              )}
            </div>
            <div className={styles.pricingTable}>
              <div className={styles.pricingHead}>
                <span>Input</span>
                <span>Low</span>
                <span>Expected</span>
                <span>High</span>
                <span>Source</span>
              </div>
              {items.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.unit}</small>
                  </span>
                  {(["low_value", "expected_value", "high_value"] as const).map(
                    (key) =>
                      selectedVersion?.status === "proposed" ? (
                        <input
                          key={key}
                          type="number"
                          step="0.01"
                          value={item[key]}
                          onChange={(event) =>
                            updateItem(item, key, event.target.value)
                          }
                        />
                      ) : (
                        <strong key={key}>{item[key]}</strong>
                      ),
                  )}
                  <span>
                    <strong>{item.source_name}</strong>
                    <small>Verified {item.verified_at}</small>
                  </span>
                </div>
              ))}
            </div>
            {selectedVersion?.status === "proposed" && (
              <div className={styles.panelActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!!busy}
                  onClick={savePricingItems}
                >
                  {busy === "pricing" ? "Saving…" : "Save proposed values"}
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={!!busy}
                  onClick={approveVersion}
                >
                  {busy === "approve"
                    ? "Approving…"
                    : "Approve and lock version"}
                </button>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Evidence register</p>
                <h2>What HUM knows—and where it came from</h2>
              </div>
              <span className={styles.sourceTag}>Immutable snapshots</span>
            </div>
            <p className={styles.sectionIntro}>
              Retail prices, public fees, permit rules, and market assumptions
              stay visibly separate. A new verification creates a new snapshot
              instead of silently rewriting an earlier estimate.
            </p>
            <div className={styles.sourceEvidenceGrid}>
              {pricingSources.map((source) => (
                <article key={source.id}>
                  <header>
                    <span>{source.source_type.replaceAll("_", " ")}</span>
                    <span className={styles.statusPill}>
                      {source.confidence}
                    </span>
                  </header>
                  <h3>{source.name}</h3>
                  <p>{source.evidence_summary}</p>
                  <small>{source.limitation_note}</small>
                  <footer>
                    <span>{source.geography}</span>
                    <span>Checked {source.verified_at}</span>
                    {source.source_url && (
                      <a
                        href={source.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Recruitment-only market map</p>
                <h2>Humboldt roofing contractor candidates</h2>
              </div>
              <span className={styles.sourceTag}>
                Never used as price evidence
              </span>
            </div>
            <div className={styles.marketBoundary}>
              <strong>{contractorMarket.length} public business records</strong>
              <span>
                Every record is blocked from pricing use. “Business claim”
                means the company or directory published the information; HUM
                still requires a fresh CSLB check before pilot approval.
              </span>
            </div>
            <div className={styles.contractorMarketGrid}>
              {contractorMarket.map((contractor) => (
                <article key={contractor.id}>
                  <div>
                    <span>{contractor.city}</span>
                    <span className={styles.statusPill}>
                      {contractor.license_evidence_status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h3>{contractor.company_name}</h3>
                  <p>{contractor.service_area}</p>
                  <small>
                    {contractor.license_number
                      ? `Published license #${contractor.license_number}`
                      : "License number not yet captured"}
                  </small>
                  <div className={styles.marketSpecialties}>
                    {contractor.specialties.map((specialty) => (
                      <span key={specialty}>
                        {specialty.replaceAll("-", " ")}
                      </span>
                    ))}
                  </div>
                  <label className={styles.field}>
                    <span>Recruitment status</span>
                    <select
                      value={contractor.recruitment_status}
                      disabled={busy === `market-${contractor.id}`}
                      onChange={(event) =>
                        void updateRecruitmentStatus(
                          contractor,
                          event.target
                            .value as ContractorMarketRecord["recruitment_status"],
                        )
                      }
                    >
                      <option value="research">Research</option>
                      <option value="candidate">Candidate</option>
                      <option value="contacted">Contacted</option>
                      <option value="declined">Declined</option>
                      <option value="pilot_partner">Pilot partner</option>
                    </select>
                  </label>
                  <footer>
                    {contractor.public_website && (
                      <a
                        href={contractor.public_website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Website
                      </a>
                    )}
                    <a
                      href={contractor.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Evidence
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Public project evidence</p>
                <h2>Scope evidence stays separated by use</h2>
              </div>
            </div>
            <div className={styles.publicEvidenceList}>
              {publicEvidence.map((evidence) => (
                <article key={evidence.id}>
                  <div>
                    <span>{evidence.pricing_usability.replaceAll("_", " ")}</span>
                    <strong>{evidence.title}</strong>
                    <p>{evidence.evidence_summary}</p>
                    <small>{evidence.limitation_note}</small>
                  </div>
                  <a
                    href={evidence.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open public record
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Observation queue</p>
                <h2>Contractor-supplied evidence</h2>
              </div>
            </div>
            <div className={styles.historyPanel}>
              {observations.length ? (
                observations.map((observation) => (
                  <div
                    className={styles.observationRow}
                    key={observation.id}
                  >
                    <span>
                      <strong>{observation.pricing_code}</strong>
                      <small>{observation.source_note}</small>
                    </span>
                    <strong>{observation.observed_value}</strong>
                    <span className={styles.statusPill}>
                      {observation.status}
                    </span>
                    {observation.status === "proposed" ? (
                      <span className={styles.rowActions}>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            reviewObservation(observation, "reviewed")
                          }
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            reviewObservation(observation, "rejected")
                          }
                        >
                          Reject
                        </button>
                      </span>
                    ) : (
                      <small>
                        {new Date(observation.created_at).toLocaleDateString()}
                      </small>
                    )}
                  </div>
                ))
              ) : (
                <p className={styles.muted}>
                  No contractor pricing observations yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {view === "operations" && (
        <>
          <PageHeading
            kicker="Protected operations"
            title="Roles, AI health, and immutable activity."
            copy="Logs retain request metadata and record changes without storing homeowner narrative text in the AI request log."
          />
          <div className={styles.trustGrid}>
            <StatCard label="Recent AI requests" value={operationStats.aiRequests} />
            <StatCard
              label="Fallback rate"
              value={`${operationStats.fallbackRate}%`}
            />
            <StatCard
              label="Pending requests"
              value={
                aiRequests.filter((request) => request.status === "pending")
                  .length
              }
            />
            <StatCard label="Audit records" value={audits.length} />
          </div>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Least-privilege access</p>
                <h2>Account roles</h2>
              </div>
            </div>
            <div className={styles.accountTable}>
              {profiles.map((user) => (
                <div key={user.id}>
                  <span>
                    <strong>{user.full_name ?? "Unnamed account"}</strong>
                    <small>{user.email}</small>
                  </span>
                  <select
                    value={user.role}
                    disabled={
                      busy === `role-${user.id}` || user.is_test_account
                    }
                    onChange={(event) =>
                      changeRole(user, event.target.value as HumRole)
                    }
                  >
                    <option value="homeowner">Homeowner</option>
                    <option value="contractor">Contractor</option>
                    <option value="administrator">Administrator</option>
                  </select>
                  <span className={styles.statusPill}>
                    {user.is_test_account
                      ? "QA only"
                      : user.deactivated_at
                        ? "deactivated"
                        : "active"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.intakeLayout}>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.kicker}>AI request metadata</p>
                  <h2>Provider and fallback health</h2>
                </div>
              </div>
              <div className={styles.historyPanel}>
                {aiRequests.map((request) => (
                  <div className={styles.historyRow} key={request.id}>
                    <strong>{request.status}</strong>
                    <span>{request.model}</span>
                    <span>{request.input_chars} input characters</span>
                    <small>
                      {request.latency_ms
                        ? `${request.latency_ms} ms`
                        : request.error_code ?? "pending"}
                    </small>
                  </div>
                ))}
                {!aiRequests.length && (
                  <p className={styles.muted}>No AI requests yet.</p>
                )}
              </div>
            </section>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.kicker}>Activity history</p>
                  <h2>Latest protected changes</h2>
                </div>
              </div>
              <div className={styles.historyPanel}>
                {audits.slice(0, 20).map((audit) => (
                  <div className={styles.historyRow} key={audit.id}>
                    <strong>{audit.action}</strong>
                    <span>{audit.entity_type}</span>
                    <span>{audit.entity_id?.slice(0, 8) ?? "system"}</span>
                    <small>
                      {new Date(audit.created_at).toLocaleString()}
                    </small>
                  </div>
                ))}
                {!audits.length && (
                  <p className={styles.muted}>No audit activity yet.</p>
                )}
              </div>
            </section>
          </div>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => onView("projects")}
          >
            Return to project overview
          </button>
        </>
      )}
    </div>
  );
}

function PageHeading({
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
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Server-visible record</small>
    </article>
  );
}
