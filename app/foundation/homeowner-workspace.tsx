"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_BUCKET,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";
import { browserRandomId, getSupabaseBrowserClient } from "./supabase";
import type {
  EstimateRecord,
  HomeownerIntakeState,
  IntakeFieldKey,
  Profile,
  Project,
  ProjectPhoto,
  ProjectShare,
} from "./types";
import type { WorkspaceView } from "./shell";
import styles from "./foundation.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const intakeFieldLabels: Record<IntakeFieldKey, string> = {
  city: "City",
  postal_code: "ZIP code",
  project_type: "Project type",
  footprint_sqft: "Home footprint",
  roof_pitch: "Roof slope",
  stories: "Stories",
  existing_layers: "Existing layers",
  roof_material: "Roof material",
  access_level: "Property access",
  complexity: "Roof shape",
  active_leak: "Active leak",
  chimney_count: "Chimneys",
  skylight_count: "Skylights",
};

const progressFields: IntakeFieldKey[] = [
  "city",
  "postal_code",
  "project_type",
  "footprint_sqft",
  "roof_material",
  "stories",
  "roof_pitch",
  "existing_layers",
  "active_leak",
];

function intakeState(project: Project): HomeownerIntakeState {
  return project.homeowner_facts &&
    typeof project.homeowner_facts === "object"
    ? project.homeowner_facts
    : {};
}

const blankProject = (ownerId: string): Omit<Project, "id" | "created_at" | "updated_at"> => ({
  homeowner_id: ownerId,
  title: "My roof project",
  status: "draft",
  intake_step: 1,
  city: "",
  county: "Humboldt",
  postal_code: null,
  project_type: "unknown",
  footprint_sqft: null,
  roof_pitch: "moderate",
  stories: 1,
  existing_layers: 1,
  roof_material: "unknown",
  access_level: "standard",
  complexity: "standard",
  active_leak: false,
  chimney_count: 0,
  skylight_count: 0,
  decking_allowance_sheets: 4,
  homeowner_notes: "",
  homeowner_facts: {
    intake_version: 2,
    conversation: [],
    confirmed_fields: {},
    deferred_fields: [],
    last_autofilled_fields: [],
    decking_allowance_method: "hum_default",
  },
  ai_interpretation: null,
  ai_source: null,
  is_test: false,
  archived_at: null,
});

export default function HomeownerWorkspace({
  profile,
  session,
  view,
  onView,
}: {
  profile: Profile;
  session: Session;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [contractorEmail, setContractorEmail] = useState("");
  const [intakeMessage, setIntakeMessage] = useState("");

  const selectedProject =
    draft ?? projects.find((project) => project.id === selectedId) ?? null;
  const latestEstimate = estimates[0] ?? null;
  const selectedIntakeState = selectedProject
    ? intakeState(selectedProject)
    : {};
  const confirmedFields = selectedIntakeState.confirmed_fields ?? {};
  const deferredFields = new Set(selectedIntakeState.deferred_fields ?? []);
  const completedProgress = progressFields.filter(
    (field) => confirmedFields[field] || deferredFields.has(field),
  ).length;
  const conversation = selectedIntakeState.conversation ?? [];
  const lastAutofilled = selectedIntakeState.last_autofilled_fields ?? [];
  const nextQuestion = selectedProject?.ai_interpretation?.next_question;
  const deckingMethod =
    selectedIntakeState.decking_allowance_method ?? "hum_default";
  const intakeReady = Boolean(
    selectedProject?.footprint_sqft &&
      confirmedFields.footprint_sqft &&
      confirmedFields.project_type,
  );

  function statusFor(field: IntakeFieldKey) {
    if (confirmedFields[field]) return "confirmed" as const;
    if (deferredFields.has(field)) return "not_sure" as const;
    return "review" as const;
  }

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const { data, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .eq("homeowner_id", profile.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (projectsError) {
      setError(projectsError.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Project[];
    setProjects(rows);
    setSelectedId((current) =>
      current && rows.some((row) => row.id === current)
        ? current
        : (rows[0]?.id ?? null),
    );
    setLoading(false);
  }, [profile.id, supabase]);

  const loadProjectDetails = useCallback(
    async (projectId: string) => {
      const [estimateResult, photoResult, shareResult] = await Promise.all([
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
          .from("project_shares")
          .select("*")
          .eq("project_id", projectId)
          .order("granted_at", { ascending: false }),
      ]);

      if (estimateResult.error) setError(estimateResult.error.message);
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
      setShares((shareResult.data ?? []) as ProjectShare[]);
    },
    [supabase],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProjects]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDraft(null);
      setIntakeMessage("");
      if (selectedId) void loadProjectDetails(selectedId);
      else {
        setEstimates([]);
        setPhotos([]);
        setShares([]);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [selectedId, loadProjectDetails]);

  function selectProject(project: Project, nextView?: WorkspaceView) {
    setSelectedId(project.id);
    setDraft({ ...project });
    if (nextView) onView(nextView);
  }

  async function createProject() {
    setBusy("create");
    setError("");
    const { data, error: createError } = await supabase
      .from("projects")
      .insert(blankProject(profile.id))
      .select("*")
      .single();
    if (createError || !data) {
      setError(createError?.message ?? "Project could not be created.");
      setBusy("");
      return;
    }
    await loadProjects();
    selectProject(data as Project, "intake");
    setNotice("Protected project created. Add or confirm the facts below.");
    setBusy("");
  }

  async function persistProject(showNotice: boolean) {
    if (!selectedProject) return false;
    setError("");
    const projectFacts = intakeState(selectedProject);
    const hasConfirmedEstimateBasics = Boolean(
      selectedProject.footprint_sqft &&
        projectFacts.confirmed_fields?.footprint_sqft &&
        projectFacts.confirmed_fields?.project_type,
    );
    const update: Partial<Project> = {
      title: selectedProject.title.trim(),
      status: hasConfirmedEstimateBasics
        ? "ready_for_estimate"
        : "draft",
      intake_step: hasConfirmedEstimateBasics ? 5 : 2,
      city: selectedProject.city.trim(),
      county: "Humboldt",
      postal_code: selectedProject.postal_code,
      project_type: selectedProject.project_type,
      footprint_sqft: selectedProject.footprint_sqft,
      roof_pitch: selectedProject.roof_pitch,
      stories: selectedProject.stories,
      existing_layers: selectedProject.existing_layers,
      roof_material: selectedProject.roof_material,
      access_level: selectedProject.access_level,
      complexity: selectedProject.complexity,
      active_leak: selectedProject.active_leak,
      chimney_count: selectedProject.chimney_count,
      skylight_count: selectedProject.skylight_count,
      decking_allowance_sheets: selectedProject.decking_allowance_sheets,
      homeowner_notes: selectedProject.homeowner_notes,
      homeowner_facts: projectFacts,
      updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await supabase
      .from("projects")
      .update(update)
      .eq("id", selectedProject.id)
      .select("*")
      .single();
    if (saveError || !data) {
      setError(saveError?.message ?? "Project could not be saved.");
      return false;
    }
    setProjects((current) =>
      current.map((project) =>
        project.id === data.id ? (data as Project) : project,
      ),
    );
    setDraft(data as Project);
    if (showNotice) {
      setNotice("Project facts saved to your protected account.");
    }
    return true;
  }

  async function saveProject() {
    setBusy("save");
    await persistProject(true);
    setBusy("");
  }

  function setField<K extends keyof Project>(
    key: K,
    value: Project[K],
    confirm = true,
  ) {
    if (!selectedProject) return;
    const state = intakeState(selectedProject);
    const confirmed = { ...(state.confirmed_fields ?? {}) };
    const deferred = new Set(state.deferred_fields ?? []);
    const isIntakeField = progressFields
      .concat([
        "access_level",
        "complexity",
        "chimney_count",
        "skylight_count",
      ])
      .includes(key as IntakeFieldKey);
    const isUnknown =
      value === null ||
      value === "" ||
      value === "unknown";

    if (confirm && (isIntakeField || key === "title")) {
      if (isUnknown) {
        delete confirmed[key as keyof typeof confirmed];
        if (isIntakeField) deferred.add(key as IntakeFieldKey);
      } else {
        confirmed[key as keyof typeof confirmed] = {
          source: "homeowner_form",
          source_text: "Confirmed in the guided form",
          confirmed_at: new Date().toISOString(),
        };
        if (isIntakeField) deferred.delete(key as IntakeFieldKey);
      }
    }

    setDraft({
      ...selectedProject,
      [key]: value,
      homeowner_facts: {
        ...state,
        intake_version: 2,
        confirmed_fields: confirmed,
        deferred_fields: [...deferred],
        last_autofilled_fields: [],
        decking_allowance_method:
          state.decking_allowance_method ?? "hum_default",
      },
    });
  }

  function markDeferred(field: IntakeFieldKey) {
    if (!selectedProject) return;
    const state = intakeState(selectedProject);
    const confirmed = { ...(state.confirmed_fields ?? {}) };
    delete confirmed[field];
    const deferred = new Set(state.deferred_fields ?? []);
    deferred.add(field);
    setDraft({
      ...selectedProject,
      homeowner_facts: {
        ...state,
        intake_version: 2,
        confirmed_fields: confirmed,
        deferred_fields: [...deferred],
        last_autofilled_fields: [],
      },
    });
  }

  function setDeckingMethod(
    method: "hum_default" | "contractor_quantity",
  ) {
    if (!selectedProject) return;
    const state = intakeState(selectedProject);
    const confirmed = { ...(state.confirmed_fields ?? {}) };
    if (method === "hum_default") {
      delete confirmed.decking_allowance_sheets;
    }
    setDraft({
      ...selectedProject,
      decking_allowance_sheets:
        method === "hum_default"
          ? 4
          : selectedProject.decking_allowance_sheets,
      homeowner_facts: {
        ...state,
        confirmed_fields: confirmed,
        decking_allowance_method: method,
      },
    });
  }

  async function runAiIntake(message = intakeMessage) {
    if (!selectedProject) return;
    const cleanMessage = message.trim();
    if (cleanMessage.length < 2) return;
    setBusy("ai");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ai-intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          projectId: selectedProject.id,
          message: cleanMessage,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        interpretation: Project["ai_interpretation"];
        source: Project["ai_source"];
        project: Project;
        notice?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "AI intake failed.");
      setDraft(payload.project);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? payload.project
            : project,
        ),
      );
      setIntakeMessage("");
      setNotice(
        payload.notice ??
          "HUM saved your answer and filled only directly supported fields.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "AI intake failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function generateEstimate() {
    if (!selectedProject) return;
    setBusy("estimate");
    setError("");
    try {
      const saved = await persistProject(false);
      if (!saved) return;
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      const payload = (await response.json()) as {
        error?: string;
        estimate: EstimateRecord;
      };
      if (!response.ok) throw new Error(payload.error ?? "Estimate failed.");
      await Promise.all([
        loadProjects(),
        loadProjectDetails(selectedProject.id),
      ]);
      setNotice(
        `Estimate version ${payload.estimate.version_number} saved with its pricing version.`,
      );
      onView("estimate");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Estimate failed.",
      );
    } finally {
      setBusy("");
    }
  }

  function uploadObject(
    file: File,
    path: string,
    onProgress: (value: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const encodedPath = path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      xhr.open(
        "POST",
        `${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${encodedPath}`,
      );
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onerror = () => reject(new Error("The photo upload was interrupted."));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let message = "Photo upload failed.";
          try {
            const payload = JSON.parse(xhr.responseText);
            message = payload.message ?? payload.error ?? message;
          } catch {
            // Keep the safe generic error.
          }
          reject(new Error(message));
        }
      };
      xhr.send(file);
    });
  }

  async function uploadPhoto(file: File) {
    if (!selectedProject) return;
    setError("");
    setNotice("");
    if (
      !ALLOWED_PHOTO_TYPES.includes(
        file.type as (typeof ALLOWED_PHOTO_TYPES)[number],
      )
    ) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photos must be 8 MB or smaller.");
      return;
    }

    setUploadProgress(0);
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const path = `${profile.id}/${selectedProject.id}/${browserRandomId()}-${cleanName}`;
    try {
      await uploadObject(file, path, setUploadProgress);
      const { error: metadataError } = await supabase
        .from("project_photos")
        .insert({
          project_id: selectedProject.id,
          owner_id: profile.id,
          storage_path: path,
          file_name: cleanName,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (metadataError) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw metadataError;
      }
      await loadProjectDetails(selectedProject.id);
      setNotice(
        "Private photo saved. Signed previews expire after five minutes.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Photo upload failed.",
      );
    } finally {
      setUploadProgress(null);
    }
  }

  async function deletePhoto(photo: ProjectPhoto) {
    if (!selectedProject) return;
    setBusy(`photo-${photo.id}`);
    setError("");
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([photo.storage_path]);
    if (storageError) {
      setError(storageError.message);
      setBusy("");
      return;
    }
    const { error: metadataError } = await supabase
      .from("project_photos")
      .delete()
      .eq("id", photo.id);
    if (metadataError) setError(metadataError.message);
    else {
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setNotice("Photo removed from private storage.");
    }
    setBusy("");
  }

  async function shareProject(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy("share");
    setError("");
    const { error: shareError } = await supabase.rpc(
      "share_project_with_contractor_email",
      {
        p_project_id: selectedProject.id,
        p_contractor_email: contractorEmail.trim(),
      },
    );
    if (shareError) setError(shareError.message);
    else {
      setNotice(
        "Access granted to that contractor account. No other contractor can see this project.",
      );
      setContractorEmail("");
      await loadProjectDetails(selectedProject.id);
    }
    setBusy("");
  }

  async function revokeShare(share: ProjectShare) {
    setBusy(`share-${share.id}`);
    const { error: revokeError } = await supabase
      .from("project_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", share.id);
    if (revokeError) setError(revokeError.message);
    else {
      setNotice("Contractor access revoked.");
      if (selectedProject) await loadProjectDetails(selectedProject.id);
    }
    setBusy("");
  }

  async function archiveProject(project: Project) {
    setBusy(`archive-${project.id}`);
    const now = new Date().toISOString();
    const { error: archiveError } = await supabase
      .from("projects")
      .update({ status: "archived", archived_at: now, updated_at: now })
      .eq("id", project.id);
    if (archiveError) setError(archiveError.message);
    else {
      setNotice(
        "Project archived. Its estimates and audit history were preserved.",
      );
      await loadProjects();
    }
    setBusy("");
  }

  const range = useMemo(() => {
    const result = latestEstimate?.calculation_result;
    if (!result) return null;
    return {
      low: result.scenarios.low.planningPrice,
      expected: result.scenarios.expected.planningPrice,
      high: result.scenarios.high.planningPrice,
    };
  }, [latestEstimate]);

  if (loading) {
    return <WorkspaceLoading label="Loading protected projects…" />;
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
            kicker="Your protected workspace"
            title="Roofing projects you control."
            copy="Start, resume, estimate, and archive projects without losing the inputs or pricing history behind an earlier result."
            action={
              <button
                className={styles.primaryButton}
                onClick={createProject}
                disabled={busy === "create"}
              >
                {busy === "create" ? "Creating…" : "New roofing project"}
              </button>
            }
          />
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              copy="Create your first protected roofing project. Nothing is shared with a contractor automatically."
              action="Create first project"
              onAction={createProject}
            />
          ) : (
            <div className={styles.projectGrid}>
              {projects.map((project) => (
                <article className={styles.projectCard} key={project.id}>
                  <div className={styles.cardTopline}>
                    <span className={styles.statusPill}>{project.status.replaceAll("_", " ")}</span>
                    <small>
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </small>
                  </div>
                  <h2>{project.title}</h2>
                  <p>
                    {project.city || "City needed"}, CA ·{" "}
                    {project.footprint_sqft
                      ? `${project.footprint_sqft} sq ft footprint`
                      : "Footprint needed"}{" "}
                    · {project.roof_pitch} pitch
                  </p>
                  <div className={styles.cardStats}>
                    <span>
                      <strong>{project.intake_step}/6</strong>
                      Intake
                    </span>
                    <span>
                      <strong>
                        {project.ai_source
                          ? project.ai_source === "openai"
                            ? "AI"
                            : "Fallback"
                          : "Not run"}
                      </strong>
                      Interpretation
                    </span>
                    <span>
                      <strong>
                        {estimates.filter((estimate) => estimate.project_id === project.id).length || "—"}
                      </strong>
                      Loaded versions
                    </span>
                  </div>
                  <div className={styles.cardActions}>
                    <button onClick={() => selectProject(project, "intake")}>
                      Open project
                    </button>
                    <button
                      className={styles.dangerText}
                      disabled={busy === `archive-${project.id}`}
                      onClick={() => archiveProject(project)}
                    >
                      Archive
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {view === "intake" && (
        <ProjectRequired
          project={selectedProject}
          projects={projects}
          onSelect={selectProject}
          onCreate={createProject}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Guided homeowner intake"
                title="Tell HUM what you know. We’ll figure out what to ask next."
                copy="Start in your own words. HUM fills only facts supported by what you said, asks one short follow-up at a time, and explains every roofing term before you have to answer it."
                action={
                  <ProjectPicker
                    projects={projects}
                    selectedId={selectedProject.id}
                    onSelect={(id) => {
                      const project = projects.find((item) => item.id === id);
                      if (project) selectProject(project);
                    }}
                  />
                }
              />
              <div className={styles.guidedIntakeLayout}>
                <section className={styles.conversationPanel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.kicker}>Start here · AI-guided</p>
                      <h2>
                        {conversation.length
                          ? "Keep describing the project."
                          : "What would you like done to your roof?"}
                      </h2>
                    </div>
                    <span className={styles.sourceTag}>
                      One question at a time
                    </span>
                  </div>
                  {conversation.length > 0 ? (
                    <div className={styles.chatThread} aria-live="polite">
                      {conversation.slice(-8).map((message, index) => (
                        <div
                          className={
                            message.role === "homeowner"
                              ? styles.homeownerBubble
                              : styles.humBubble
                          }
                          key={`${message.created_at}-${index}`}
                        >
                          <strong>
                            {message.role === "homeowner" ? "You" : "HUM"}
                          </strong>
                          <p>{message.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.intakeStarter}>
                      <p>
                        You do not need roofing vocabulary. Say what you have
                        noticed, what you want done, and anything a roofer has
                        already told you.
                      </p>
                      <div>
                        {[
                          "My roof is old and I think it needs replacement.",
                          "I have a leak after heavy rain.",
                          "A contractor already gave me some measurements.",
                        ].map((example) => (
                          <button
                            type="button"
                            key={example}
                            onClick={() => setIntakeMessage(example)}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {nextQuestion && (
                    <div className={styles.nextQuestion}>
                      <span>
                        {nextQuestion.field === "complete"
                          ? "Ready for your review"
                          : "Next question"}
                      </span>
                      <strong>{nextQuestion.question}</strong>
                      <p>{nextQuestion.why_it_matters}</p>
                      {nextQuestion.answer_help.length > 0 && (
                        <div>
                          {nextQuestion.answer_help.map((answer) => (
                            <button
                              type="button"
                              key={answer}
                              onClick={() => setIntakeMessage(answer)}
                            >
                              {answer}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <label className={styles.chatComposer}>
                    <span>
                      {conversation.length
                        ? "Your answer"
                        : "Describe the project in your own words"}
                    </span>
                    <textarea
                      rows={4}
                      maxLength={4000}
                      value={intakeMessage}
                      placeholder={
                        nextQuestion?.field === "complete"
                          ? "Add anything else HUM should know, or review the filled form below."
                          : "Type what you know. “I’m not sure” is a valid answer."
                      }
                      onChange={(event) => setIntakeMessage(event.target.value)}
                    />
                  </label>
                  <div className={styles.characterRow}>
                    <span>{intakeMessage.length}/4,000</span>
                    <div>
                      {nextQuestion &&
                        nextQuestion.field !== "complete" && (
                          <button
                            className={styles.secondaryButton}
                            type="button"
                            disabled={busy === "ai"}
                            onClick={() => void runAiIntake("I’m not sure.")}
                          >
                            I’m not sure
                          </button>
                        )}
                      <button
                        className={styles.primaryButton}
                        type="button"
                        onClick={() => void runAiIntake()}
                        disabled={
                          intakeMessage.trim().length < 2 || busy === "ai"
                        }
                      >
                        {busy === "ai"
                          ? "Saving your answer…"
                          : conversation.length
                            ? "Send answer & fill form"
                            : "Start guided intake"}
                      </button>
                    </div>
                  </div>
                  <div className={styles.aiBoundary}>
                    <strong>What AI does:</strong> organize what you said,
                    populate supported fields, and choose the next question.
                    Pricing still comes only from HUM&apos;s versioned calculator.
                  </div>
                </section>

                <aside className={styles.intakeProgressPanel}>
                  <p className={styles.kicker}>Your intake progress</p>
                  <div className={styles.progressValue}>
                    <strong>{completedProgress}</strong>
                    <span>of {progressFields.length} key items answered</span>
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label="Project intake progress"
                    aria-valuemin={0}
                    aria-valuemax={progressFields.length}
                    aria-valuenow={completedProgress}
                  >
                    <span
                      style={{
                        width: `${(completedProgress / progressFields.length) * 100}%`,
                      }}
                    />
                  </div>
                  {lastAutofilled.length > 0 && (
                    <div className={styles.autoFillNotice}>
                      <strong>Just filled from your answer</strong>
                      <div>
                        {lastAutofilled.map((field) => (
                          <span key={field}>{intakeFieldLabels[field]}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={styles.intakeKey}>
                    <FieldStatus status="confirmed" />
                    <span>Supported by something you entered</span>
                    <FieldStatus status="not_sure" />
                    <span>Kept as an assumption for review</span>
                    <FieldStatus status="review" />
                    <span>Still needs your attention</span>
                  </div>
                  <div className={styles.progressBoundary}>
                    <strong>You never have to guess hidden damage.</strong>
                    <p>
                      Decking, flashing condition, and structural damage are
                      verified on site. HUM labels temporary allowances instead
                      of pretending they are known.
                    </p>
                  </div>
                </aside>
              </div>

              <section className={styles.panel}>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className={styles.kicker}>Review what HUM filled</p>
                    <h2>Project facts in plain language</h2>
                  </div>
                  <span className={styles.sourceTag}>
                    You control every answer
                  </span>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>1</span>
                    <div>
                      <h3>Project and location</h3>
                      <p>Basic facts that identify the planning estimate.</p>
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={`${styles.field} ${styles.fullField}`}>
                      <span>Project name</span>
                      <input
                        value={selectedProject.title}
                        maxLength={120}
                        onChange={(event) =>
                          setField("title", event.target.value)
                        }
                      />
                    </label>
                    <GuidedField
                      id="project-city"
                      label="City"
                      status={statusFor("city")}
                      definition="The city where the home is located. A street address is not needed here."
                      howToFind="Use the city shown on your mail or property record."
                    >
                      <input
                        id="project-city"
                        value={selectedProject.city}
                        maxLength={80}
                        placeholder="Example: Eureka"
                        onChange={(event) =>
                          setField("city", event.target.value)
                        }
                      />
                    </GuidedField>
                    <GuidedField
                      id="project-zip"
                      label="ZIP code"
                      status={statusFor("postal_code")}
                      definition="The five-digit ZIP helps HUM use the correct local pricing region."
                      howToFind="Use the ZIP from your mail, property listing, or a map search."
                    >
                      <input
                        id="project-zip"
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        placeholder="95501"
                        value={selectedProject.postal_code ?? ""}
                        onChange={(event) =>
                          setField(
                            "postal_code",
                            event.target.value.replace(/\D/g, "").slice(0, 5),
                          )
                        }
                      />
                    </GuidedField>
                    <GuidedField
                      id="project-type"
                      label="What kind of help do you need?"
                      status={statusFor("project_type")}
                      definition="A repair fixes a limited problem. A replacement removes and rebuilds the roof covering. Choose inspection if you need a professional to determine the scope."
                      howToFind="If you are unsure, choose “I’m not sure yet.” HUM will keep the scope open."
                    >
                      <select
                        id="project-type"
                        value={selectedProject.project_type}
                        onChange={(event) =>
                          setField(
                            "project_type",
                            event.target.value as Project["project_type"],
                          )
                        }
                      >
                        <option value="unknown">I’m not sure yet</option>
                        <option value="replacement">Full replacement</option>
                        <option value="repair">Repair a specific problem</option>
                        <option value="inspection">Inspection first</option>
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="project-footprint"
                      label="Home footprint (square feet)"
                      status={statusFor("footprint_sqft")}
                      definition="The footprint is the ground-floor area covered by the roof—not the roof surface and not always the total living area."
                      howToFind="Check Zillow/Redfin or county records. For a simple home, multiply outside length × width. For a 2,000 sq ft two-story home, a rough footprint may be about 1,000 sq ft."
                    >
                      <input
                        id="project-footprint"
                        type="number"
                        min={100}
                        max={50000}
                        placeholder="Example: 1500"
                        value={selectedProject.footprint_sqft ?? ""}
                        onChange={(event) =>
                          setField(
                            "footprint_sqft",
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                          )
                        }
                      />
                    </GuidedField>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>2</span>
                    <div>
                      <h3>What you can see from the ground</h3>
                      <p>
                        Visual descriptions are enough. Do not climb onto the
                        roof to answer these.
                      </p>
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <GuidedField
                      id="roof-material"
                      label="Current roof material"
                      status={statusFor("roof_material")}
                      definition="The outer material you see: asphalt shingles, metal panels, or tile."
                      howToFind="Look from the ground or compare with listing photos. Architectural shingles look thicker and more layered than flat three-tab shingles."
                    >
                      <select
                        id="roof-material"
                        value={selectedProject.roof_material}
                        onChange={(event) =>
                          setField(
                            "roof_material",
                            event.target.value as Project["roof_material"],
                          )
                        }
                      >
                        <option value="unknown">I’m not sure</option>
                        <option value="architectural_shingle">
                          Dimensional / architectural shingles
                        </option>
                        <option value="three_tab">
                          Flat three-tab shingles
                        </option>
                        <option value="metal">Metal</option>
                        <option value="tile">Tile</option>
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="roof-pitch"
                      label="Roof slope (pitch)"
                      status={statusFor("roof_pitch")}
                      definition="Pitch means how steep the roof is. A 6:12 pitch rises 6 inches for every 12 inches across."
                      howToFind="From the ground choose low, normal, or very steep. A contractor report may list a number such as 4:12 or 8:12."
                    >
                      <select
                        id="roof-pitch"
                        value={selectedProject.roof_pitch}
                        onChange={(event) =>
                          setField(
                            "roof_pitch",
                            event.target.value as Project["roof_pitch"],
                          )
                        }
                      >
                        <option value="low">
                          Low / nearly flat · under about 4:12
                        </option>
                        <option value="moderate">
                          Normal slope · about 4:12–7:12
                        </option>
                        <option value="steep">
                          Very steep · above about 7:12
                        </option>
                      </select>
                      {!confirmedFields.roof_pitch && (
                        <button
                          className={styles.notSureButton}
                          type="button"
                          onClick={() => markDeferred("roof_pitch")}
                        >
                          I can’t tell from the ground
                        </button>
                      )}
                    </GuidedField>
                    <GuidedField
                      id="roof-stories"
                      label="Stories below this roof"
                      status={statusFor("stories")}
                      definition="The number of above-ground levels directly under the main roof."
                      howToFind="Count the visible floors from the lowest ground level where crews would work."
                    >
                      <select
                        id="roof-stories"
                        value={selectedProject.stories}
                        onChange={(event) =>
                          setField("stories", Number(event.target.value))
                        }
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value} value={value}>
                            {value} {value === 1 ? "story" : "stories"}
                          </option>
                        ))}
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="roof-layers"
                      label="Existing roof layers"
                      status={statusFor("existing_layers")}
                      definition="A layer is one complete roof covering installed over the wood decking. Some homes have new shingles placed over an older layer."
                      howToFind="Check an old invoice, permit, or ask a roofer to inspect the roof edge. If you do not know, HUM uses one layer as a visible planning assumption."
                    >
                      <select
                        id="roof-layers"
                        value={
                          deferredFields.has("existing_layers")
                            ? "unknown"
                            : selectedProject.existing_layers
                        }
                        onChange={(event) => {
                          if (event.target.value === "unknown") {
                            setField("existing_layers", 1, false);
                            markDeferred("existing_layers");
                          } else {
                            setField(
                              "existing_layers",
                              Number(event.target.value),
                            );
                          }
                        }}
                      >
                        <option value="unknown">
                          I don’t know · assume one for planning
                        </option>
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value} value={value}>
                            {value} {value === 1 ? "layer" : "layers"}
                          </option>
                        ))}
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="roof-shape"
                      label="Roof shape"
                      status={statusFor("complexity")}
                      definition="A simple roof has two main slopes. Valleys are inside corners where slopes meet; hips are outside corners; dormers are smaller roofed sections projecting from the main roof."
                      howToFind="Look at the roofline from different sides or use aerial listing photos. More peaks and intersecting sections mean more complexity."
                    >
                      <select
                        id="roof-shape"
                        value={selectedProject.complexity}
                        onChange={(event) =>
                          setField(
                            "complexity",
                            event.target.value as Project["complexity"],
                          )
                        }
                      >
                        <option value="simple">
                          Simple · mostly two slopes
                        </option>
                        <option value="standard">
                          Some hips, valleys, or sections
                        </option>
                        <option value="complex">
                          Many peaks, valleys, or dormers
                        </option>
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="roof-access"
                      label="Property access"
                      status={statusFor("access_level")}
                      definition="Access describes how close a truck, dumpster, and material delivery can get to the house."
                      howToFind="Think about driveway space, gates, stairs, narrow side yards, landscaping, and how far materials must be carried."
                    >
                      <select
                        id="roof-access"
                        value={selectedProject.access_level}
                        onChange={(event) =>
                          setField(
                            "access_level",
                            event.target.value as Project["access_level"],
                          )
                        }
                      >
                        <option value="easy">
                          Easy · vehicles can stage close by
                        </option>
                        <option value="standard">
                          Normal driveway / side-yard access
                        </option>
                        <option value="difficult">
                          Difficult · tight gate, stairs, or long carry
                        </option>
                      </select>
                    </GuidedField>
                    <GuidedField
                      id="chimneys"
                      label="Chimneys through the roof"
                      status={statusFor("chimney_count")}
                      definition="Count only chimneys that pass through a roof surface. Each needs waterproof flashing around it."
                      howToFind="Look from the ground or use an aerial photo. Enter 0 if there are none."
                    >
                      <input
                        id="chimneys"
                        type="number"
                        min={0}
                        max={12}
                        value={selectedProject.chimney_count}
                        onChange={(event) =>
                          setField(
                            "chimney_count",
                            Number(event.target.value),
                          )
                        }
                      />
                    </GuidedField>
                    <GuidedField
                      id="skylights"
                      label="Skylights through the roof"
                      status={statusFor("skylight_count")}
                      definition="A skylight is a window installed through the roof. Each opening needs flashing."
                      howToFind="Count visible roof windows from inside the home or an aerial photo. Enter 0 if there are none."
                    >
                      <input
                        id="skylights"
                        type="number"
                        min={0}
                        max={30}
                        value={selectedProject.skylight_count}
                        onChange={(event) =>
                          setField(
                            "skylight_count",
                            Number(event.target.value),
                          )
                        }
                      />
                    </GuidedField>
                    <div className={`${styles.guidedField} ${styles.fullField}`}>
                      <div className={styles.guidedFieldTop}>
                        <strong>Is there an active leak?</strong>
                        <FieldStatus status={statusFor("active_leak")} />
                      </div>
                      <p className={styles.fieldDefinition}>
                        An active leak means water is entering the home now or
                        after recent rain. Old stains with no current moisture
                        can be described in the chat instead.
                      </p>
                      <div className={styles.segmentedChoice}>
                        <button
                          type="button"
                          className={
                            confirmedFields.active_leak &&
                            selectedProject.active_leak
                              ? styles.segmentedActive
                              : ""
                          }
                          onClick={() => setField("active_leak", true)}
                        >
                          Yes, water is getting in
                        </button>
                        <button
                          type="button"
                          className={
                            confirmedFields.active_leak &&
                            !selectedProject.active_leak
                              ? styles.segmentedActive
                              : ""
                          }
                          onClick={() => setField("active_leak", false)}
                        >
                          No active leak
                        </button>
                        <button
                          type="button"
                          className={
                            deferredFields.has("active_leak")
                              ? styles.segmentedActive
                              : ""
                          }
                          onClick={() => markDeferred("active_leak")}
                        >
                          I’m not sure
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>3</span>
                    <div>
                      <h3>Hidden wood beneath the roof covering</h3>
                      <p>
                        This is where HUM uses an allowance instead of asking
                        you to guess.
                      </p>
                    </div>
                  </div>
                  <div className={styles.deckingExplainer}>
                    <div>
                      <p className={styles.kicker}>What is roof decking?</p>
                      <h3>The wood sheets directly under the shingles or metal.</h3>
                      <p>
                        Decking is usually 4 × 8 ft plywood or OSB fastened to
                        the roof framing. Rotten or damaged sheets often cannot
                        be counted until the old roof is removed.
                      </p>
                    </div>
                    <div className={styles.allowanceChoices}>
                      <label>
                        <input
                          type="radio"
                          name="decking-method"
                          checked={deckingMethod === "hum_default"}
                          onChange={() => setDeckingMethod("hum_default")}
                        />
                        <span>
                          <strong>
                            I don’t know · use HUM’s 4-sheet planning allowance
                          </strong>
                          Recommended for the first estimate. This is a reserve,
                          not a prediction of hidden damage.
                        </span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="decking-method"
                          checked={deckingMethod === "contractor_quantity"}
                          onChange={() =>
                            setDeckingMethod("contractor_quantity")
                          }
                        />
                        <span>
                          <strong>A contractor gave me a sheet quantity</strong>
                          Use a written inspection or quote—do not estimate this
                          yourself.
                        </span>
                      </label>
                      {deckingMethod === "contractor_quantity" && (
                        <label className={styles.field}>
                          <span>Contractor-provided number of sheets</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedProject.decking_allowance_sheets}
                            onChange={(event) =>
                              setField(
                                "decking_allowance_sheets",
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.panelActions}>
                  <div className={styles.saveReadiness}>
                    <strong>
                      {intakeReady
                        ? "Ready for a first planning estimate"
                        : "Confirm the project type and home footprint first"}
                    </strong>
                    <span>
                      No contractor quote or contractor pricing is required.
                      Uncertain items widen the range and stay visible.
                    </span>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    onClick={saveProject}
                    disabled={busy === "save"}
                  >
                    {busy === "save" ? "Saving…" : "Save & finish later"}
                  </button>
                  <button
                    className={styles.primaryButton}
                    onClick={generateEstimate}
                    disabled={!intakeReady || Boolean(busy)}
                  >
                    Generate line-item estimate
                  </button>
                </div>
              </section>
            </>
          )}
        </ProjectRequired>
      )}

      {view === "photos" && (
        <ProjectRequired
          project={selectedProject}
          projects={projects}
          onSelect={selectProject}
          onCreate={createProject}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Private Supabase storage"
                title="Photos expire from view, not from your project."
                copy="Images are limited by type and size, stored in a private bucket, and shown through five-minute signed links. Contractors see them only after explicit project access."
                action={
                  <ProjectPicker
                    projects={projects}
                    selectedId={selectedProject.id}
                    onSelect={(id) => {
                      const project = projects.find((item) => item.id === id);
                      if (project) selectProject(project);
                    }}
                  />
                }
              />
              <section className={styles.uploadPanel}>
                <div>
                  <p className={styles.kicker}>JPEG · PNG · WebP</p>
                  <h2>Add a roof photo</h2>
                  <p>
                    Maximum 8 MB. Avoid faces, license plates, mail, or other
                    unnecessary personal details.
                  </p>
                </div>
                <label className={styles.uploadButton}>
                  <input
                    type="file"
                    accept={ALLOWED_PHOTO_TYPES.join(",")}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPhoto(file);
                      event.target.value = "";
                    }}
                  />
                  Choose photo
                </label>
                {uploadProgress !== null && (
                  <div className={styles.progress} aria-label={`Upload ${uploadProgress}%`}>
                    <span style={{ width: `${uploadProgress}%` }} />
                    <strong>{uploadProgress}%</strong>
                  </div>
                )}
              </section>
              {photos.length === 0 ? (
                <EmptyState
                  title="No private photos attached"
                  copy="The estimator can still work from homeowner facts, but photos may help a contractor understand visible conditions later."
                />
              ) : (
                <div className={styles.photoGrid}>
                  {photos.map((photo) => (
                    <article key={photo.id} className={styles.photoCard}>
                      {photo.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.signedUrl} alt={photo.file_name} />
                      ) : (
                        <div className={styles.photoExpired}>Preview expired</div>
                      )}
                      <div>
                        <strong>{photo.file_name}</strong>
                        <span>
                          {(photo.size_bytes / 1024 / 1024).toFixed(1)} MB · signed
                          for 5 minutes
                        </span>
                        <button
                          type="button"
                          disabled={busy === `photo-${photo.id}`}
                          onClick={() => deletePhoto(photo)}
                        >
                          {busy === `photo-${photo.id}` ? "Removing…" : "Delete photo"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </ProjectRequired>
      )}

      {view === "estimate" && (
        <ProjectRequired
          project={selectedProject}
          projects={projects}
          onSelect={selectProject}
          onCreate={createProject}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Deterministic line-item calculation"
                title="A planning range with a memory."
                copy="Each version preserves the homeowner facts, calculation inputs, approved pricing version, confidence score, and result. New pricing never silently rewrites an older estimate."
                action={
                  <button
                    className={styles.primaryButton}
                    onClick={generateEstimate}
                    disabled={!selectedProject.footprint_sqft || Boolean(busy)}
                  >
                    {busy === "estimate" ? "Calculating…" : "Generate new version"}
                  </button>
                }
              />
              {!latestEstimate || !range ? (
                <EmptyState
                  title="No estimate version yet"
                  copy="Confirm the roof footprint and project facts, then generate the first immutable planning estimate."
                  action="Return to intake"
                  onAction={() => onView("intake")}
                />
              ) : (
                <>
                  <section className={styles.estimateHero}>
                    <div>
                      <p className={styles.kicker}>Planning range</p>
                      <h2>
                        {money(range.low)}
                        <span>to</span>
                        {money(range.high)}
                      </h2>
                      <p>
                        Expected scenario: <strong>{money(range.expected)}</strong>
                      </p>
                    </div>
                    <div className={styles.confidence}>
                      <strong>{latestEstimate.confidence_score}%</strong>
                      <span>Estimate confidence</span>
                    </div>
                    <div className={styles.versionStamp}>
                      <span>Estimate version</span>
                      <strong>#{latestEstimate.version_number}</strong>
                      <span>Pricing version</span>
                      <strong>
                        {latestEstimate.calculation_result.pricingVersionCode}
                      </strong>
                      <small>
                        Effective{" "}
                        {new Date(
                          latestEstimate.calculation_result.pricingEffectiveDate,
                        ).toLocaleDateString()}
                      </small>
                    </div>
                  </section>

                  {latestEstimate.calculation_result.dataStrength && (
                    <section className={styles.dataStrengthPanel}>
                      <div>
                        <p className={styles.kicker}>Local data strength</p>
                        <h2>
                          {latestEstimate.calculation_result.dataStrength.label}
                        </h2>
                        <p>
                          {
                            latestEstimate.calculation_result.dataStrength
                              .limitation
                          }
                        </p>
                      </div>
                      <div className={styles.dataStrengthStats}>
                        <span>
                          <strong>
                            {
                              latestEstimate.calculation_result.dataStrength
                                .sourcedInputs
                            }
                          </strong>
                          sourced inputs
                        </span>
                        <span>
                          <strong>
                            {
                              latestEstimate.calculation_result.dataStrength
                                .mediumConfidenceInputs
                            }
                          </strong>
                          medium confidence
                        </span>
                        <span>
                          <strong>
                            {
                              latestEstimate.calculation_result.dataStrength
                                .lowConfidenceInputs
                            }
                          </strong>
                          pilot assumptions
                        </span>
                      </div>
                      {!!latestEstimate.calculation_result.assumptions?.length && (
                        <ul>
                          {latestEstimate.calculation_result.assumptions.map(
                            (assumption) => (
                              <li key={assumption}>{assumption}</li>
                            ),
                          )}
                        </ul>
                      )}
                    </section>
                  )}

                  <div className={styles.estimateLayout}>
                    <section className={styles.panel}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <p className={styles.kicker}>Expected scenario</p>
                          <h2>Line-item economics</h2>
                        </div>
                        <span className={styles.sourceTag}>Calculator-generated</span>
                      </div>
                      <div className={styles.costTable}>
                        {[
                          ["Materials", latestEstimate.calculation_result.scenarios.expected.materialCost],
                          ["Labor", latestEstimate.calculation_result.scenarios.expected.laborCost],
                          ["Tear-off", latestEstimate.calculation_result.scenarios.expected.tearOffCost],
                          ["Disposal", latestEstimate.calculation_result.scenarios.expected.disposalCost],
                          ["Decking allowance", latestEstimate.calculation_result.scenarios.expected.deckingAllowance],
                          ["Flashing allowance", latestEstimate.calculation_result.scenarios.expected.flashingAllowance],
                          ["Permit allowance", latestEstimate.calculation_result.scenarios.expected.permitAllowance],
                          ["Delivery allowance", latestEstimate.calculation_result.scenarios.expected.deliveryAllowance],
                          ["Overhead", latestEstimate.calculation_result.scenarios.expected.overhead],
                          ["Contingency", latestEstimate.calculation_result.scenarios.expected.contingency],
                        ].map(([label, value]) => (
                          <div key={String(label)}>
                            <span>{label}</span>
                            <strong>{money(Number(value))}</strong>
                          </div>
                        ))}
                        <div className={styles.costTotal}>
                          <span>Cost basis</span>
                          <strong>
                            {money(
                              latestEstimate.calculation_result.scenarios.expected
                                .costBasis,
                            )}
                          </strong>
                        </div>
                        <div className={styles.costTotal}>
                          <span>
                            Planning price at{" "}
                            {Math.round(
                              latestEstimate.calculation_result.scenarios.expected
                                .targetMargin * 100,
                            )}
                            % target margin
                          </span>
                          <strong>{money(range.expected)}</strong>
                        </div>
                      </div>
                    </section>
                    <aside className={styles.sideStack}>
                      <section className={styles.sideCard}>
                        <p className={styles.kicker}>Why the number moves</p>
                        <h2>Major cost drivers</h2>
                        <ol>
                          {latestEstimate.calculation_result.majorCostDrivers.map(
                            (driver) => (
                              <li key={driver}>{driver}</li>
                            ),
                          )}
                        </ol>
                      </section>
                      <section className={styles.sideCard}>
                        <p className={styles.kicker}>Known unknowns</p>
                        <h2>Missing information</h2>
                        {latestEstimate.calculation_result.missingInformation
                          .length ? (
                          <ul>
                            {latestEstimate.calculation_result.missingInformation.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              ),
                            )}
                          </ul>
                        ) : (
                          <p>No major intake fields are missing.</p>
                        )}
                      </section>
                    </aside>
                  </div>

                  <section className={styles.auditPanel}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className={styles.kicker}>Calculation audit trail</p>
                        <h2>Where every input came from</h2>
                      </div>
                    </div>
                    <div className={styles.auditGrid}>
                      {latestEstimate.calculation_result.audit.map((item) => (
                        <div key={item.label}>
                          <span>{item.source}</span>
                          <strong>{item.label}</strong>
                          <p>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={styles.warningBanner}>
                    <strong>
                      No quote required—but this is not a contractor quote.
                    </strong>
                    HUM uses source-backed public data and visible assumptions.
                    Field measurements, concealed conditions, material
                    selections, jurisdictional fees, contractor availability,
                    and negotiated terms can still change the final price.
                  </section>

                  <section className={styles.historyPanel}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className={styles.kicker}>Reproducible history</p>
                        <h2>Saved estimate versions</h2>
                      </div>
                    </div>
                    {estimates.map((estimate) => (
                      <div key={estimate.id} className={styles.historyRow}>
                        <span>Version {estimate.version_number}</span>
                        <strong>
                          {money(
                            estimate.calculation_result.scenarios.expected
                              .planningPrice,
                          )}
                        </strong>
                        <span>{estimate.calculation_result.pricingVersionCode}</span>
                        <small>
                          {new Date(estimate.created_at).toLocaleString()}
                        </small>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
        </ProjectRequired>
      )}

      {view === "sharing" && (
        <ProjectRequired
          project={selectedProject}
          projects={projects}
          onSelect={selectProject}
          onCreate={createProject}
        >
          {selectedProject && (
            <>
              <PageHeading
                kicker="Explicit contractor authorization"
                title="Private until you name the contractor."
                copy="Round 3 has no job feed or contractor directory. A contractor can read only a project you grant to their existing HUM contractor account."
                action={
                  <ProjectPicker
                    projects={projects}
                    selectedId={selectedProject.id}
                    onSelect={(id) => {
                      const project = projects.find((item) => item.id === id);
                      if (project) selectProject(project);
                    }}
                  />
                }
              />
              <div className={styles.shareLayout}>
                <form className={styles.panel} onSubmit={shareProject}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.kicker}>Grant one account</p>
                      <h2>Share by exact contractor email</h2>
                    </div>
                    <span className={styles.sourceTag}>No public listing</span>
                  </div>
                  <label className={styles.field}>
                    <span>Contractor account email</span>
                    <input
                      required
                      type="email"
                      value={contractorEmail}
                      onChange={(event) => setContractorEmail(event.target.value)}
                      placeholder="contractor@example.com"
                    />
                    <small>
                      HUM returns the same safe failure whether an unrelated
                      account exists or not.
                    </small>
                  </label>
                  <div className={styles.dataPreview}>
                    <strong>Shared</strong>
                    <span>Project scope and homeowner facts</span>
                    <span>Saved estimates and calculation audit</span>
                    <span>Private project photos through expiring links</span>
                    <strong>Not shared</strong>
                    <span>Password, account security, or unrelated projects</span>
                    <span>Any open marketplace or contact-data feed</span>
                  </div>
                  <button
                    className={styles.primaryButton}
                    disabled={busy === "share"}
                  >
                    {busy === "share" ? "Granting…" : "Grant project access"}
                  </button>
                </form>
                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.kicker}>Current access</p>
                      <h2>Contractor permissions</h2>
                    </div>
                  </div>
                  {shares.filter((share) => !share.revoked_at).length === 0 ? (
                    <p className={styles.muted}>
                      No contractor account can currently read this project.
                    </p>
                  ) : (
                    <div className={styles.shareList}>
                      {shares
                        .filter((share) => !share.revoked_at)
                        .map((share) => (
                          <div key={share.id}>
                            <span className={styles.avatar}>C</span>
                            <span>
                              <strong>Contractor account</strong>
                              <small>
                                ID {share.contractor_id.slice(0, 8)} · granted{" "}
                                {new Date(share.granted_at).toLocaleDateString()}
                              </small>
                            </span>
                            <button
                              type="button"
                              disabled={busy === `share-${share.id}`}
                              onClick={() => revokeShare(share)}
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </ProjectRequired>
      )}
    </div>
  );
}

type FieldStatusValue = "confirmed" | "not_sure" | "review";

function FieldStatus({ status }: { status: FieldStatusValue }) {
  return (
    <span
      className={`${styles.fieldStatus} ${
        status === "confirmed"
          ? styles.fieldConfirmed
          : status === "not_sure"
            ? styles.fieldNotSure
            : styles.fieldReview
      }`}
    >
      {status === "confirmed"
        ? "Confirmed"
        : status === "not_sure"
          ? "Not sure"
          : "Review"}
    </span>
  );
}

function GuidedField({
  id,
  label,
  status,
  definition,
  howToFind,
  children,
}: {
  id: string;
  label: string;
  status: FieldStatusValue;
  definition: string;
  howToFind: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.guidedField}>
      <div className={styles.guidedFieldTop}>
        <label htmlFor={id}>{label}</label>
        <FieldStatus status={status} />
      </div>
      <p className={styles.fieldDefinition}>{definition}</p>
      {children}
      <details className={styles.fieldHelp}>
        <summary>How do I find this?</summary>
        <p>{howToFind}</p>
      </details>
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
      {action && <div>{action}</div>}
    </header>
  );
}

function EmptyState({
  title,
  copy,
  action,
  onAction,
}: {
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className={styles.emptyState}>
      <span>H</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action && onAction && (
        <button className={styles.primaryButton} onClick={onAction}>
          {action}
        </button>
      )}
    </section>
  );
}

function ProjectRequired({
  project,
  projects,
  onSelect,
  onCreate,
  children,
}: {
  project: Project | null;
  projects: Project[];
  onSelect: (project: Project, view?: WorkspaceView) => void;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  if (project) return children;
  return (
    <>
      <PageHeading
        kicker="Project required"
        title="Choose a protected project."
        copy="Create a project or open an existing one before continuing."
      />
      {projects.length ? (
        <div className={styles.projectGrid}>
          {projects.map((item) => (
            <button
              type="button"
              className={styles.projectChoice}
              key={item.id}
              onClick={() => onSelect(item, "intake")}
            >
              <strong>{item.title}</strong>
              <span>{item.city}, CA</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No project selected"
          copy="Start your first protected roofing project."
          action="Create project"
          onAction={onCreate}
        />
      )}
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

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className={styles.workspaceLoading}>
      <span />
      <p>{label}</p>
    </div>
  );
}
