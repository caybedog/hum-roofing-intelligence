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
import { getSupabaseBrowserClient } from "./supabase";
import type {
  EstimateRecord,
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

const blankProject = (ownerId: string): Omit<Project, "id" | "created_at" | "updated_at"> => ({
  homeowner_id: ownerId,
  title: "My Humboldt roof project",
  status: "draft",
  intake_step: 1,
  city: "Eureka",
  county: "Humboldt",
  postal_code: "95501",
  project_type: "replacement",
  footprint_sqft: 1500,
  roof_pitch: "moderate",
  stories: 1,
  existing_layers: 1,
  roof_material: "architectural_shingle",
  access_level: "standard",
  complexity: "standard",
  active_leak: false,
  chimney_count: 1,
  skylight_count: 0,
  decking_allowance_sheets: 4,
  homeowner_notes: "",
  homeowner_facts: {},
  ai_interpretation: null,
  ai_source: null,
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

  const selectedProject =
    draft ?? projects.find((project) => project.id === selectedId) ?? null;
  const latestEstimate = estimates[0] ?? null;

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
    const update: Partial<Project> = {
      title: selectedProject.title.trim(),
      status: selectedProject.footprint_sqft
        ? "ready_for_estimate"
        : "draft",
      intake_step: selectedProject.footprint_sqft ? 5 : 2,
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

  function setField<K extends keyof Project>(key: K, value: Project[K]) {
    if (!selectedProject) return;
    setDraft({ ...selectedProject, [key]: value });
  }

  async function runAiIntake() {
    if (!selectedProject) return;
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
          narrative: selectedProject.homeowner_notes,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        interpretation: Project["ai_interpretation"];
        source: Project["ai_source"];
        notice?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "AI intake failed.");
      setDraft({
        ...selectedProject,
        ai_interpretation: payload.interpretation,
        ai_source: payload.source,
      });
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                ai_interpretation: payload.interpretation,
                ai_source: payload.source,
                homeowner_notes: selectedProject.homeowner_notes,
              }
            : project,
        ),
      );
      setNotice(
        payload.notice ??
          "AI interpretation saved. Review it before using the estimator.",
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
    const path = `${profile.id}/${selectedProject.id}/${crypto.randomUUID()}-${cleanName}`;
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
                    {project.city}, CA · {project.footprint_sqft ?? "Area needed"} sq ft footprint ·{" "}
                    {project.roof_pitch} pitch
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
                kicker="Homeowner facts + cautious interpretation"
                title="Describe the roof once. Verify every fact."
                copy="HUM separates what you entered, what AI interpreted, what the calculator derived, and which administrator-approved pricing version supplied cost assumptions."
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
              <div className={styles.intakeLayout}>
                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.kicker}>Verified by you</p>
                      <h2>Project facts</h2>
                    </div>
                    <span className={styles.sourceTag}>Homeowner-provided</span>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={`${styles.field} ${styles.fullField}`}>
                      <span>Project name</span>
                      <input
                        value={selectedProject.title}
                        maxLength={120}
                        onChange={(event) => setField("title", event.target.value)}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>City</span>
                      <input
                        value={selectedProject.city}
                        maxLength={80}
                        onChange={(event) => setField("city", event.target.value)}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>ZIP code</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        value={selectedProject.postal_code ?? ""}
                        onChange={(event) =>
                          setField(
                            "postal_code",
                            event.target.value.replace(/\D/g, "").slice(0, 5),
                          )
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Project type</span>
                      <select
                        value={selectedProject.project_type}
                        onChange={(event) =>
                          setField(
                            "project_type",
                            event.target.value as Project["project_type"],
                          )
                        }
                      >
                        <option value="replacement">Replacement</option>
                        <option value="repair">Repair</option>
                        <option value="inspection">Inspection / unknown scope</option>
                        <option value="unknown">Not sure</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Home footprint (sq ft)</span>
                      <input
                        type="number"
                        min={100}
                        max={50000}
                        value={selectedProject.footprint_sqft ?? ""}
                        onChange={(event) =>
                          setField(
                            "footprint_sqft",
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                      />
                      <small>HUM applies a transparent pitch and waste factor.</small>
                    </label>
                    <label className={styles.field}>
                      <span>Roof pitch</span>
                      <select
                        value={selectedProject.roof_pitch}
                        onChange={(event) =>
                          setField(
                            "roof_pitch",
                            event.target.value as Project["roof_pitch"],
                          )
                        }
                      >
                        <option value="low">Low · under about 4:12</option>
                        <option value="moderate">Moderate · about 4:12–7:12</option>
                        <option value="steep">Steep · above about 7:12</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Stories</span>
                      <select
                        value={selectedProject.stories}
                        onChange={(event) =>
                          setField("stories", Number(event.target.value))
                        }
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Existing roof layers</span>
                      <select
                        value={selectedProject.existing_layers}
                        onChange={(event) =>
                          setField("existing_layers", Number(event.target.value))
                        }
                      >
                        {[0, 1, 2, 3, 4].map((value) => (
                          <option key={value} value={value}>
                            {value === 0 ? "Unknown / none" : value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Roof material</span>
                      <select
                        value={selectedProject.roof_material}
                        onChange={(event) =>
                          setField(
                            "roof_material",
                            event.target.value as Project["roof_material"],
                          )
                        }
                      >
                        <option value="architectural_shingle">Architectural shingle</option>
                        <option value="three_tab">Three-tab shingle</option>
                        <option value="metal">Metal</option>
                        <option value="tile">Tile</option>
                        <option value="unknown">Not sure</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Property access</span>
                      <select
                        value={selectedProject.access_level}
                        onChange={(event) =>
                          setField(
                            "access_level",
                            event.target.value as Project["access_level"],
                          )
                        }
                      >
                        <option value="easy">Easy staging</option>
                        <option value="standard">Standard</option>
                        <option value="difficult">Difficult access / hand carry</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Roof complexity</span>
                      <select
                        value={selectedProject.complexity}
                        onChange={(event) =>
                          setField(
                            "complexity",
                            event.target.value as Project["complexity"],
                          )
                        }
                      >
                        <option value="simple">Simple gable</option>
                        <option value="standard">Standard</option>
                        <option value="complex">Complex hips, valleys, or dormers</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Chimneys</span>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        value={selectedProject.chimney_count}
                        onChange={(event) =>
                          setField("chimney_count", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Skylights</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={selectedProject.skylight_count}
                        onChange={(event) =>
                          setField("skylight_count", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Decking sheets carried as allowance</span>
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
                    <label className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={selectedProject.active_leak}
                        onChange={(event) =>
                          setField("active_leak", event.target.checked)
                        }
                      />
                      <span>
                        <strong>Active leak reported</strong>
                        This affects confidence, not an invented damage quantity.
                      </span>
                    </label>
                  </div>
                  <div className={styles.panelActions}>
                    <button
                      className={styles.primaryButton}
                      onClick={saveProject}
                      disabled={busy === "save"}
                    >
                      {busy === "save" ? "Saving…" : "Save verified facts"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={generateEstimate}
                      disabled={!selectedProject.footprint_sqft || Boolean(busy)}
                    >
                      Generate line-item estimate
                    </button>
                  </div>
                </section>

                <aside className={styles.aiPanel}>
                  <p className={styles.kicker}>AI interprets · code calculates</p>
                  <h2>Tell HUM what is going on.</h2>
                  <p>
                    Include roof age, leaks, storm damage, materials, access,
                    and anything a contractor previously told you. Do not
                    include names, phone numbers, or a street address.
                  </p>
                  <textarea
                    maxLength={4000}
                    value={selectedProject.homeowner_notes}
                    placeholder="Example: The roof is about 18 years old. We have an active leak near the chimney after heavy rain…"
                    onChange={(event) =>
                      setField("homeowner_notes", event.target.value)
                    }
                  />
                  <div className={styles.characterRow}>
                    <span>{selectedProject.homeowner_notes.length}/4,000</span>
                    <button
                      type="button"
                      onClick={runAiIntake}
                      disabled={
                        selectedProject.homeowner_notes.trim().length < 20 ||
                        busy === "ai"
                      }
                    >
                      {busy === "ai" ? "Interpreting…" : "Interpret description"}
                    </button>
                  </div>
                  {selectedProject.ai_interpretation && (
                    <div className={styles.aiResult}>
                      <div className={styles.resultSource}>
                        <strong>
                          {selectedProject.ai_source === "openai"
                            ? "OpenAI structured interpretation"
                            : "Deterministic fallback"}
                        </strong>
                        <span>Suggestion · review required</span>
                      </div>
                      <p>{selectedProject.ai_interpretation.summary}</p>
                      <h3>Directly recognized facts</h3>
                      {selectedProject.ai_interpretation.facts.length ? (
                        <ul>
                          {selectedProject.ai_interpretation.facts.map((fact, index) => (
                            <li key={`${fact.field}-${index}`}>
                              <strong>{fact.field.replaceAll("_", " ")}</strong>
                              <span>{fact.value}</span>
                              <small>“{fact.source_text}”</small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No direct facts were safe to extract.</p>
                      )}
                      <h3>Still needed</h3>
                      <div className={styles.chipList}>
                        {selectedProject.ai_interpretation.missing_information.map(
                          (item) => (
                            <span key={item}>{item}</span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  <div className={styles.aiBoundary}>
                    <strong>AI cannot confirm</strong>
                    Hidden damage, code compliance, structural condition, exact
                    dimensions, unit costs, labor hours, or price.
                  </div>
                </aside>
              </div>
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
                    <strong>Planning estimate—not a contractor quote.</strong>
                    Field measurements, concealed conditions, material
                    selections, jurisdictional fees, contractor availability,
                    and negotiated terms can change the final price.
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
