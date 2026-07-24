"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PHOTO_BUCKET } from "./config";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  ContractorReview,
  EstimateRecord,
  Profile,
  Project,
  ProjectPhoto,
} from "./types";
import type { WorkspaceView } from "./shell";
import styles from "./foundation.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

type ReviewDraft = {
  measuredFootprint: string;
  scopeNotes: string;
  notes: string;
  pricingCode: string;
  observedValue: string;
  sourceNote: string;
};

const emptyReview: ReviewDraft = {
  measuredFootprint: "",
  scopeNotes: "",
  notes: "",
  pricingCode: "shingle_material",
  observedValue: "",
  sourceNote: "",
};

export default function ContractorWorkspace({
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [review, setReview] = useState<ContractorReview | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>(emptyReview);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedProject =
    projects.find((project) => project.id === selectedId) ?? null;
  const latestEstimate = estimates[0] ?? null;

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const { data, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (projectsError) setError(projectsError.message);
    const rows = (data ?? []) as Project[];
    setProjects(rows);
    setSelectedId((current) =>
      current && rows.some((row) => row.id === current)
        ? current
        : (rows[0]?.id ?? null),
    );
    setLoading(false);
  }, [supabase]);

  const loadProjectDetails = useCallback(
    async (projectId: string) => {
      const [estimateResult, photoResult, reviewResult] = await Promise.all([
        supabase
          .from("estimates")
          .select("*")
          .eq("project_id", projectId)
          .order("version_number", { ascending: false }),
        supabase
          .from("project_photos")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("contractor_reviews")
          .select("*")
          .eq("project_id", projectId)
          .eq("contractor_id", profile.id)
          .maybeSingle(),
      ]);

      if (estimateResult.error) setError(estimateResult.error.message);
      if (photoResult.error) setError(photoResult.error.message);
      if (reviewResult.error) setError(reviewResult.error.message);
      setEstimates((estimateResult.data ?? []) as EstimateRecord[]);

      const photoRows = (photoResult.data ?? []) as ProjectPhoto[];
      if (photoRows.length) {
        const { data: signed } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrls(
            photoRows.map((photo) => photo.storage_path),
            300,
          );
        setPhotos(
          photoRows.map((photo, index) => ({
            ...photo,
            signedUrl: signed?.[index]?.signedUrl ?? undefined,
          })),
        );
      } else {
        setPhotos([]);
      }

      const currentReview =
        (reviewResult.data as ContractorReview | null) ?? null;
      setReview(currentReview);
      setDraft({
        measuredFootprint:
          String(currentReview?.measurement_corrections?.footprint_sqft ?? ""),
        scopeNotes: currentReview?.scope_corrections?.join("\n") ?? "",
        notes: currentReview?.notes ?? "",
        pricingCode: "shingle_material",
        observedValue: "",
        sourceNote: "",
      });
    },
    [profile.id, supabase],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProjects]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (selectedId) void loadProjectDetails(selectedId);
      else {
        setEstimates([]);
        setPhotos([]);
        setReview(null);
        setDraft(emptyReview);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProjectDetails, selectedId]);

  async function saveReview(status: "draft" | "submitted") {
    if (!selectedProject) return;
    setBusy(status);
    setError("");
    setNotice("");

    const reviewPayload = {
      project_id: selectedProject.id,
      estimate_id: latestEstimate?.id ?? null,
      contractor_id: profile.id,
      status,
      measurement_corrections: draft.measuredFootprint
        ? { footprint_sqft: Number(draft.measuredFootprint) }
        : {},
      scope_corrections: draft.scopeNotes
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: draft.notes.trim(),
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    };

    const { data, error: reviewError } = await supabase
      .from("contractor_reviews")
      .upsert(reviewPayload, {
        onConflict: "project_id,contractor_id",
      })
      .select("*")
      .single();

    if (reviewError || !data) {
      setError(reviewError?.message ?? "The review could not be saved.");
      setBusy("");
      return;
    }

    if (
      status === "submitted" &&
      draft.observedValue &&
      draft.sourceNote.trim()
    ) {
      const { error: observationError } = await supabase
        .from("pricing_observations")
        .insert({
          project_id: selectedProject.id,
          estimate_id: latestEstimate?.id ?? null,
          observed_by: profile.id,
          pricing_code: draft.pricingCode,
          observed_value: Number(draft.observedValue),
          source_note: draft.sourceNote.trim(),
          status: "proposed",
        });
      if (observationError) {
        setError(
          `Review saved, but the pricing observation failed: ${observationError.message}`,
        );
        setReview(data as ContractorReview);
        setBusy("");
        return;
      }
    }

    setReview(data as ContractorReview);
    setNotice(
      status === "submitted"
        ? "Corrections submitted to the homeowner record. Pricing observations await administrator review."
        : "Private review draft saved.",
    );
    setBusy("");
  }

  const estimateRange = useMemo(() => {
    if (!latestEstimate) return null;
    return latestEstimate.calculation_result.scenarios;
  }, [latestEstimate]);

  if (loading) {
    return (
      <div className={styles.workspaceLoading}>
        <span />
        <p>Loading explicitly shared projects…</p>
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
            kicker="Contractor workspace"
            title="Only projects shared with your account."
            copy="The database filters this list for your authenticated identity. HUM has no public lead feed in Round 3."
          />
          <div className={styles.warningBanner}>
            <strong>Access boundary</strong>
            <span>
              You may review homeowner facts, private photos, and saved
              estimates only while an active share exists.
            </span>
          </div>
          {projects.length ? (
            <div className={styles.projectGrid}>
              {projects.map((project) => (
                <article className={styles.projectCard} key={project.id}>
                  <div className={styles.cardTopline}>
                    <span className={styles.statusPill}>Explicitly shared</span>
                    <small>
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </small>
                  </div>
                  <h2>{project.title}</h2>
                  <p>
                    {project.city}, CA · {project.project_type.replace("_", " ")}
                  </p>
                  <div className={styles.cardStats}>
                    <span>
                      <strong>{project.footprint_sqft ?? "—"}</strong>
                      <small>footprint sq ft</small>
                    </span>
                    <span>
                      <strong>{project.roof_pitch}</strong>
                      <small>pitch</small>
                    </span>
                    <span>
                      <strong>{project.existing_layers}</strong>
                      <small>existing layers</small>
                    </span>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => {
                        setSelectedId(project.id);
                        onView("estimate");
                      }}
                    >
                      Review estimate
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => {
                        setSelectedId(project.id);
                        onView("sharing");
                      }}
                    >
                      Add corrections
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No shared projects"
              copy="Ask a homeowner to grant access to the exact email address on this contractor account."
            />
          )}
        </>
      )}

      {view === "estimate" && (
        <ProjectRequired
          projects={projects}
          project={selectedProject}
          onSelect={setSelectedId}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Shared estimate review"
                title={selectedProject.title}
                copy="Every amount below comes from deterministic code and the immutable pricing version shown. AI text does not set a price."
                action={
                  <ProjectPicker
                    projects={projects}
                    selectedId={selectedProject.id}
                    onSelect={setSelectedId}
                  />
                }
              />
              {!latestEstimate || !estimateRange ? (
                <EmptyState
                  title="No saved estimate yet"
                  copy="The homeowner has shared the project, but has not created a versioned estimate."
                />
              ) : (
                <>
                  <section className={styles.estimateHero}>
                    <div>
                      <p className={styles.kicker}>Planning range</p>
                      <h2>
                        {money(estimateRange.low.planningPrice)}
                        <span> to </span>
                        {money(estimateRange.high.planningPrice)}
                      </h2>
                      <p>
                        Expected planning point{" "}
                        <strong>
                          {money(estimateRange.expected.planningPrice)}
                        </strong>
                      </p>
                    </div>
                    <div className={styles.versionStamp}>
                      <span>Estimate version</span>
                      <strong>{latestEstimate.version_number}</strong>
                      <small>
                        {
                          latestEstimate.calculation_result
                            .pricingVersionCode
                        }
                      </small>
                    </div>
                  </section>

                  <div className={styles.estimateLayout}>
                    <section className={styles.panel}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <p className={styles.kicker}>Expected scenario</p>
                          <h2>Calculation breakdown</h2>
                        </div>
                      </div>
                      <div className={styles.costTable}>
                        {[
                          ["Materials", estimateRange.expected.materialCost],
                          ["Labor", estimateRange.expected.laborCost],
                          ["Tear-off", estimateRange.expected.tearOffCost],
                          ["Disposal", estimateRange.expected.disposalCost],
                          [
                            "Decking allowance",
                            estimateRange.expected.deckingAllowance,
                          ],
                          ["Overhead", estimateRange.expected.overhead],
                          ["Contingency", estimateRange.expected.contingency],
                        ].map(([label, amount]) => (
                          <div key={String(label)}>
                            <span>{label}</span>
                            <strong>{money(Number(amount))}</strong>
                          </div>
                        ))}
                        <div className={styles.costTotal}>
                          <span>Planning price</span>
                          <strong>
                            {money(estimateRange.expected.planningPrice)}
                          </strong>
                        </div>
                      </div>
                    </section>
                    <aside className={styles.sideStack}>
                      <section className={styles.sideCard}>
                        <p className={styles.kicker}>Confidence</p>
                        <strong className={styles.confidence}>
                          {latestEstimate.confidence_score}%
                        </strong>
                        <p>
                          This is planning confidence, not a roof inspection or
                          quote guarantee.
                        </p>
                      </section>
                      <section className={styles.sideCard}>
                        <p className={styles.kicker}>Private photos</p>
                        <strong className={styles.confidence}>
                          {photos.length}
                        </strong>
                        <p>Preview links expire after five minutes.</p>
                      </section>
                    </aside>
                  </div>

                  <section className={styles.auditPanel}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className={styles.kicker}>Traceable assumptions</p>
                        <h2>Calculation audit</h2>
                      </div>
                    </div>
                    <div className={styles.auditGrid}>
                      {latestEstimate.calculation_result.audit.map((item) => (
                        <div key={`${item.label}-${item.value}`}>
                          <span>{item.source}</span>
                          <strong>{item.label}</strong>
                          <small>{item.value}</small>
                        </div>
                      ))}
                    </div>
                  </section>

                  {!!photos.length && (
                    <section className={styles.panel}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <p className={styles.kicker}>Expiring access</p>
                          <h2>Shared project photos</h2>
                        </div>
                        <span className={styles.sourceTag}>5-minute links</span>
                      </div>
                      <div className={styles.photoGrid}>
                        {photos.map((photo) => (
                          <article className={styles.photoCard} key={photo.id}>
                            {photo.signedUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo.signedUrl}
                                alt={`Project evidence: ${photo.file_name}`}
                              />
                            ) : (
                              <div className={styles.photoExpired}>
                                Preview unavailable
                              </div>
                            )}
                            <strong>{photo.file_name}</strong>
                            <small>
                              {(photo.size_bytes / 1024 / 1024).toFixed(1)} MB
                            </small>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </ProjectRequired>
      )}

      {view === "sharing" && (
        <ProjectRequired
          projects={projects}
          project={selectedProject}
          onSelect={setSelectedId}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Structured contractor correction"
                title="Improve the record without changing history."
                copy="Your observations are stored separately. They do not overwrite the homeowner’s facts, a prior estimate, or an approved pricing catalog."
                action={
                  <ProjectPicker
                    projects={projects}
                    selectedId={selectedProject.id}
                    onSelect={setSelectedId}
                  />
                }
              />
              <div className={styles.intakeLayout}>
                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.kicker}>Review record</p>
                      <h2>Measurements and scope</h2>
                    </div>
                    {review && (
                      <span className={styles.statusPill}>
                        {review.status}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>Measured footprint, sq ft</span>
                      <input
                        type="number"
                        min="100"
                        max="50000"
                        value={draft.measuredFootprint}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            measuredFootprint: event.target.value,
                          })
                        }
                        placeholder={String(
                          selectedProject.footprint_sqft ?? "",
                        )}
                      />
                    </label>
                    <label className={`${styles.field} ${styles.fullField}`}>
                      <span>Scope corrections, one per line</span>
                      <textarea
                        rows={5}
                        value={draft.scopeNotes}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            scopeNotes: event.target.value,
                          })
                        }
                        placeholder="Example: Replace chimney counterflashing"
                      />
                    </label>
                    <label className={`${styles.field} ${styles.fullField}`}>
                      <span>Contractor explanation</span>
                      <textarea
                        rows={5}
                        maxLength={6000}
                        value={draft.notes}
                        onChange={(event) =>
                          setDraft({ ...draft, notes: event.target.value })
                        }
                        placeholder="Explain what you observed and what still requires an on-site inspection."
                      />
                    </label>
                  </div>
                </section>

                <aside className={styles.sideStack}>
                  <section className={styles.sideCard}>
                    <p className={styles.kicker}>Optional observation</p>
                    <h2>Propose pricing evidence</h2>
                    <label className={styles.field}>
                      <span>Pricing input</span>
                      <select
                        value={draft.pricingCode}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            pricingCode: event.target.value,
                          })
                        }
                      >
                        <option value="shingle_material">
                          Material per square
                        </option>
                        <option value="labor_hour_rate">
                          Roofer hourly rate
                        </option>
                        <option value="disposal_per_layer">
                          Disposal per layer and square
                        </option>
                        <option value="decking_sheet">
                          Decking per sheet
                        </option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Observed value</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.observedValue}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            observedValue: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Traceable source note</span>
                      <textarea
                        rows={4}
                        maxLength={1000}
                        value={draft.sourceNote}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            sourceNote: event.target.value,
                          })
                        }
                        placeholder="Quote date, supplier, invoice, or other source."
                      />
                    </label>
                    <p>
                      Observations enter an administrator review queue. They
                      never alter approved pricing automatically.
                    </p>
                  </section>
                </aside>
              </div>
              <div className={styles.panelActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!!busy}
                  onClick={() => saveReview("draft")}
                >
                  {busy === "draft" ? "Saving…" : "Save private draft"}
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={!!busy}
                  onClick={() => saveReview("submitted")}
                >
                  {busy === "submitted"
                    ? "Submitting…"
                    : "Submit corrections"}
                </button>
              </div>
            </>
          )}
        </ProjectRequired>
      )}
    </div>
  );
}

function PageHeading({
  kicker,
  title,
  copy,
  action,
}: {
  kicker: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeading}>
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </header>
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
  return (
    <label className={styles.projectPicker}>
      <span>Current project</span>
      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectRequired({
  projects,
  project,
  onSelect,
  children,
}: {
  projects: Project[];
  project: Project | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  if (project) return children;
  return (
    <EmptyState
      title="No shared project selected"
      copy={
        projects.length
          ? "Choose an explicitly shared project to continue."
          : "No homeowner has granted this account project access."
      }
      action={
        projects.length
          ? {
              label: "Open first project",
              run: () => onSelect(projects[0].id),
            }
          : undefined
      }
    />
  );
}

function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: { label: string; run: () => void };
}) {
  return (
    <section className={styles.emptyState}>
      <span>H</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action && (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={action.run}
        >
          {action.label}
        </button>
      )}
    </section>
  );
}
