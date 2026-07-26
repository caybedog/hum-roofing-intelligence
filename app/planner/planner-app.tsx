"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/app/foundation/supabase";
import type { Json } from "@/app/foundation/database.types";
import {
  ACCESS_OPTIONS,
  COMPLEXITY_OPTIONS,
  CONDITION_OPTIONS,
  PROJECT_CATEGORIES,
  categoryById,
  type PlannerMode,
  variantFor,
} from "./planner-data";
import { formatPlannerCurrency } from "./estimate-engine.mjs";
import styles from "./planner.module.css";

type Stage = "start" | "category" | "intake" | "review" | "result";

type Analysis = {
  category: string;
  variant: string;
  summary: string;
  quantity: number | null;
  quantity_unit: string;
  access: "easy" | "normal" | "difficult" | "unknown";
  condition: "good" | "typical" | "worn" | "damaged" | "unknown";
  complexity: "simple" | "standard" | "complex" | "unknown";
  facts: Array<{
    label: string;
    value: string;
    confidence: "low" | "medium" | "high";
    source: "homeowner" | "photo" | "inference";
  }>;
  missing_questions: string[];
  safety_flag: boolean;
  safety_message: string;
};

type PlannerEstimate = {
  catalog: {
    id: string;
    versionCode: string;
    effectiveDate: string;
    verifiedAt: string;
    limitationNote: string;
  };
  category: string;
  variant: string;
  label: string;
  unit: string;
  quantity: number;
  totals: { low: number; expected: number; high: number };
  confidence: "low" | "medium" | "high";
  lineItems: Array<{
    label: string;
    expected: number;
    explanation: string;
  }>;
  assumptions: string[];
  unknowns: string[];
  sourceKeys: string[];
  calculationInput: Record<string, unknown>;
};

type SavedEstimate = {
  projectId: string;
  estimateId: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "HUM’s pricing service took too long to respond. Your answers are still here—please try again.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function stepNumber(stage: Stage) {
  return {
    start: 0,
    category: 1,
    intake: 2,
    review: 3,
    result: 4,
  }[stage];
}

function OptionCards({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<readonly [string, string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.optionGrid}>
      {options.map(([id, label, help]) => (
        <button
          type="button"
          key={id}
          className={`${styles.optionCard} ${value === id ? styles.optionSelected : ""}`}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
        >
          <strong>{label}</strong>
          <span>{help}</span>
        </button>
      ))}
    </div>
  );
}

export default function PlannerApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [mode, setMode] = useState<PlannerMode>("photo");
  const [categoryId, setCategoryId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [description, setDescription] = useState("");
  const [postalCode, setPostalCode] = useState("95501");
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisEngine, setAnalysisEngine] = useState("");
  const [quantity, setQuantity] = useState("");
  const [access, setAccess] = useState("unknown");
  const [condition, setCondition] = useState("unknown");
  const [complexity, setComplexity] = useState("unknown");
  const [extraMaterialCost, setExtraMaterialCost] = useState("");
  const [estimate, setEstimate] = useState<PlannerEstimate | null>(null);
  const [regionNotice, setRegionNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState<SavedEstimate | null>(null);
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [actualQuoteTotal, setActualQuoteTotal] = useState("");
  const [actualFinalTotal, setActualFinalTotal] = useState("");
  const [projectCompleted, setProjectCompleted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState("");

  const category = categoryById(categoryId);
  const variant = variantFor(categoryId, variantId);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const progress = useMemo(() => {
    const step = stepNumber(stage);
    return Math.max(0, Math.min(100, (step / 4) * 100));
  }, [stage]);

  function chooseMode(nextMode: PlannerMode) {
    setMode(nextMode);
    setStage("category");
    setMessage("");
  }

  function chooseCategory(id: string) {
    const nextCategory = categoryById(id);
    if (!nextCategory) return;
    setCategoryId(id);
    setVariantId(nextCategory.variants[0].id);
    const defaultQuantity = nextCategory.variants[0].defaultQuantity;
    setQuantity(defaultQuantity ? String(defaultQuantity) : "");
    setStage("intake");
    setMessage("");
  }

  function changeVariant(id: string) {
    setVariantId(id);
    const nextVariant = variantFor(categoryId, id);
    setQuantity(
      nextVariant?.defaultQuantity ? String(nextVariant.defaultQuantity) : "",
    );
  }

  function handleImages(next: FileList | null) {
    if (!next) return;
    const accepted = Array.from(next)
      .filter((file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
      .filter((file) => file.size <= MAX_IMAGE_BYTES)
      .slice(0, 4);
    setFiles(accepted);
    if (accepted.length !== Math.min(next.length, 4)) {
      setMessage(
        "HUM kept only JPEG, PNG or WebP photos under 4 MB. You can attach up to four.",
      );
    } else {
      setMessage("");
    }
  }

  async function analyzeProject() {
    if (!category || !variant) return;
    if (description.trim().length < 3 && files.length === 0) {
      setMessage("Add a short description or at least one project photo.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const images = await Promise.all(files.map(fileToDataUrl));
      const response = await fetchWithTimeout("/api/planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description:
            description.trim() ||
            `The homeowner wants help planning ${category.name.toLowerCase()} work and attached project photos.`,
          selectedCategory: categoryId,
          selectedVariant: variantId,
          images,
        }),
      });
      const payload = (await response.json()) as {
        analysis?: Analysis;
        engine?: string;
        error?: string;
      };
      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error ?? "HUM could not analyze the project.");
      }
      const next = payload.analysis as Analysis;
      setAnalysis(next);
      setAnalysisEngine(payload.engine ?? "");
      if (next.category === categoryId) {
        setVariantId(next.variant);
      }
      if (next.quantity) setQuantity(String(next.quantity));
      setAccess(next.access);
      setCondition(next.condition);
      setComplexity(next.complexity);
      setStage("review");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "HUM could not analyze the project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function calculateEstimate() {
    if (!category || !variant) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setMessage(`Enter the approximate ${variant.quantityLabel.toLowerCase()}.`);
      return;
    }
    if (!/^[0-9]{5}$/.test(postalCode)) {
      setMessage("Enter a five-digit project ZIP code.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const unknownCount = [access, condition, complexity].filter(
        (value) => value === "unknown",
      ).length;
      const response = await fetchWithTimeout("/api/planner/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          category: categoryId,
          variant: variantId,
          quantity: parsedQuantity,
          access,
          condition,
          complexity,
          unknownCount,
          extraMaterialCost: Number(extraMaterialCost) || 0,
          postalCode,
        }),
      });
      const payload = (await response.json()) as {
        estimate?: PlannerEstimate;
        regionNotice?: string;
        error?: string;
      };
      if (!response.ok || !payload.estimate) {
        throw new Error(payload.error ?? "HUM could not calculate the project.");
      }
      setEstimate(payload.estimate as PlannerEstimate);
      setRegionNotice(payload.regionNotice ?? "");
      setStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "HUM could not calculate the project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { requested_role: "homeowner" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your HUM account, then sign in.");
          setAuthMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      setMessage("Signed in. You can save this estimate now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEstimate() {
    if (!session || !estimate || !category || !variant) return null;
    if (saved) return saved;
    setBusy(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    try {
      const { data: project, error: projectError } = await supabase
        .from("planner_projects")
        .insert({
          owner_id: session.user.id,
          mode,
          status: "estimated",
          category: categoryId,
          variant: variantId,
          title: `${category.name} planning estimate`,
          description,
          postal_code: postalCode,
          facts: {
            quantity: Number(quantity),
            unit: variant.quantityUnit,
            access,
            condition,
            complexity,
            aiFacts: analysis?.facts ?? [],
          },
          ai_summary: analysis?.summary ?? "",
          confidence: estimate.confidence,
        })
        .select("id")
        .single();
      if (projectError) throw projectError;

      const { data: estimateRow, error: estimateError } = await supabase
        .from("planner_estimates")
        .insert({
          project_id: project.id,
          owner_id: session.user.id,
          pricing_catalog_id: estimate.catalog.id,
          low_total: estimate.totals.low,
          expected_total: estimate.totals.expected,
          high_total: estimate.totals.high,
          line_items: estimate.lineItems,
          assumptions: estimate.assumptions,
          unknowns: estimate.unknowns,
          calculation_input: estimate.calculationInput as Json,
          confidence: estimate.confidence,
        })
        .select("id")
        .single();
      if (estimateError) throw estimateError;

      const result = { projectId: project.id, estimateId: estimateRow.id };
      setSaved(result);
      let photoFailures = 0;
      for (const [index, file] of files.entries()) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${session.user.id}/${project.id}/photos/${index + 1}-${safeName}`;
          const { error: storageError } = await supabase.storage
            .from("planner-uploads")
            .upload(path, file, {
              upsert: false,
              contentType: file.type,
            });
          if (storageError) throw storageError;
          const { error: uploadError } = await supabase
            .from("planner_uploads")
            .insert({
              project_id: project.id,
              owner_id: session.user.id,
              kind: "project_photo",
              storage_path: path,
              original_filename: file.name,
              mime_type: file.type,
              byte_size: file.size,
            });
          if (uploadError) throw uploadError;
        } catch {
          photoFailures += 1;
        }
      }

      setMessage(
        photoFailures
          ? `Estimate saved privately. ${photoFailures} photo${photoFailures === 1 ? "" : "s"} could not be attached, but the calculation is safe.`
          : "Estimate saved privately to your HUM account.",
      );
      return result;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The estimate could not be saved.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitCalibration(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !estimate || !quoteFile || !consent) {
      setCalibrationMessage(
        "Sign in, attach the real quote and approve anonymous calibration.",
      );
      return;
    }
    const quoteTotal = Number(actualQuoteTotal);
    const finalTotal = Number(actualFinalTotal);
    if (!quoteTotal && !finalTotal) {
      setCalibrationMessage("Enter the quoted total or final project total.");
      return;
    }
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        quoteFile.type,
      ) ||
      quoteFile.size > 10 * 1024 * 1024
    ) {
      setCalibrationMessage("Use a PDF, JPEG, PNG or WebP file under 10 MB.");
      return;
    }

    setBusy(true);
    setCalibrationMessage("");
    const supabase = getSupabaseBrowserClient();
    try {
      const savedEstimate = (await saveEstimate()) ?? saved;
      if (!savedEstimate) throw new Error("Save the HUM estimate first.");
      const safeName = quoteFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${savedEstimate.projectId}/quotes/${quoteFile.lastModified}-${safeName}`;
      const { error: storageError } = await supabase.storage
        .from("planner-uploads")
        .upload(path, quoteFile, {
          upsert: false,
          contentType: quoteFile.type,
        });
      if (storageError) throw storageError;

      const { data: upload, error: uploadError } = await supabase
        .from("planner_uploads")
        .insert({
          project_id: savedEstimate.projectId,
          owner_id: session.user.id,
          kind: "actual_quote",
          storage_path: path,
          original_filename: quoteFile.name,
          mime_type: quoteFile.type,
          byte_size: quoteFile.size,
        })
        .select("id")
        .single();
      if (uploadError) throw uploadError;

      const { error: calibrationError } = await supabase
        .from("planner_calibration_submissions")
        .insert({
          project_id: savedEstimate.projectId,
          estimate_id: savedEstimate.estimateId,
          upload_id: upload.id,
          owner_id: session.user.id,
          consent_to_anonymous_calibration: true,
          project_completed: projectCompleted,
          actual_quote_total: quoteTotal || null,
          actual_final_total: finalTotal || null,
          normalized_scope: {},
        });
      if (calibrationError) throw calibrationError;
      setCalibrationMessage(
        "Thank you. The private document is saved, and only its consented anonymous project facts and totals can enter calibration after review.",
      );
      setQuoteFile(null);
      setActualQuoteTotal("");
      setActualFinalTotal("");
      setConsent(false);
    } catch (error) {
      setCalibrationMessage(
        error instanceof Error
          ? error.message
          : "The real quote could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("start");
    setCategoryId("");
    setVariantId("");
    setDescription("");
    setFiles([]);
    setAnalysis(null);
    setEstimate(null);
    setSaved(null);
    setQuantity("");
    setAccess("unknown");
    setCondition("unknown");
    setComplexity("unknown");
    setExtraMaterialCost("");
    setMessage("");
    setCalibrationMessage("");
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <button type="button" className={styles.brand} onClick={reset}>
          <span className={styles.brandMark}>H</span>
          <span>
            <strong>HUM</strong>
            <small>Home Project Planner</small>
          </span>
        </button>
        <div className={styles.headerActions}>
          <span className={styles.locationPill}>Humboldt beta</span>
          {session ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => getSupabaseBrowserClient().auth.signOut()}
            >
              Sign out
            </button>
          ) : (
            <span className={styles.guestLabel}>No account needed</span>
          )}
        </div>
      </header>

      {stage !== "start" && (
        <div className={styles.progressShell} aria-label="Quote progress">
          <div className={styles.progressMeta}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                if (stage === "category") setStage("start");
                if (stage === "intake") setStage("category");
                if (stage === "review") setStage("intake");
                if (stage === "result") setStage("review");
              }}
            >
              ← Back
            </button>
            <span>Step {Math.max(1, stepNumber(stage))} of 4</span>
          </div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {stage === "start" && (
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Plan before you call</p>
            <h1>Get a useful home-project price range in minutes.</h1>
            <p className={styles.heroLead}>
              Upload a few photos for speed or walk through a simple
              self-inspection for a tighter range. HUM explains what could move
              the price before a contractor visits.
            </p>
          </div>

          <div className={styles.modeGrid}>
            <button
              type="button"
              className={`${styles.modeCard} ${styles.modePrimary}`}
              onClick={() => chooseMode("photo")}
            >
              <span className={styles.modeTime}>2–4 min</span>
              <span className={styles.modeIcon}>◎</span>
              <strong>Quick photo quote</strong>
              <p>Upload up to four photos. HUM identifies visible scope and asks only what is missing.</p>
              <span className={styles.modeCta}>Start with photos →</span>
            </button>
            <button
              type="button"
              className={styles.modeCard}
              onClick={() => chooseMode("guided")}
            >
              <span className={styles.modeTime}>5–8 min</span>
              <span className={styles.modeIcon}>✓</span>
              <strong>Guided self-inspection</strong>
              <p>Describe the work, confirm measurements and answer plain-language condition questions.</p>
              <span className={styles.modeCta}>Get a tighter range →</span>
            </button>
          </div>

          <div className={styles.trustStrip}>
            <span>Free during beta</span>
            <span>No contractor sales calls</span>
            <span>Unknowns widen the range</span>
            <span>AI never sets the price</span>
          </div>

          <div className={styles.howItWorks}>
            <article>
              <span>01</span>
              <strong>Show the project</strong>
              <p>Photos or a description—use whatever you have.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Confirm the facts</strong>
              <p>HUM never treats a guess as a measurement.</p>
            </article>
            <article>
              <span>03</span>
              <strong>See the range</strong>
              <p>Review cost drivers, unknowns and the pricing version used.</p>
            </article>
          </div>

          <aside className={styles.betaNotice}>
            <strong>This is a planning estimate, not a contractor bid.</strong>
            <p>
              HUM’s current catalog is strongest for Humboldt asphalt roofing.
              Other project types start with wider, clearly labeled regional
              ranges and improve only from consented real quotes and final
              invoices.
            </p>
          </aside>
        </section>
      )}

      {stage === "category" && (
        <section className={styles.flowPage}>
          <div className={styles.flowHeading}>
            <p className={styles.eyebrow}>
              {mode === "photo" ? "Quick photo quote" : "Guided self-inspection"}
            </p>
            <h1>What are you planning?</h1>
            <p>Choose the closest project. You can explain the details next.</p>
          </div>
          <div className={styles.categoryGrid}>
            {PROJECT_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={styles.categoryCard}
                onClick={() => chooseCategory(item.id)}
              >
                <span className={styles.categoryIcon}>{item.icon}</span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
          <p className={styles.categoryFootnote}>
            Don’t see an exact match? Pick the closest trade and describe the
            full scope. HUM will not force a price when the approved catalog
            cannot support one.
          </p>
        </section>
      )}

      {stage === "intake" && category && variant && (
        <section className={styles.flowPage}>
          <div className={styles.flowHeading}>
            <p className={styles.eyebrow}>{category.name}</p>
            <h1>
              {mode === "photo"
                ? "Show HUM what you’re looking at."
                : "Tell HUM what you want done."}
            </h1>
            <p>
              Technical roofing and construction knowledge is not required.
              “I’m not sure” is a valid answer.
            </p>
          </div>

          <div className={styles.intakeLayout}>
            <div className={styles.formCard}>
              {category.variants.length > 1 && (
                <label className={styles.field}>
                  <span>Closest project type</span>
                  <select
                    value={variantId}
                    onChange={(event) => changeVariant(event.target.value)}
                  >
                    {category.variants.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className={styles.field}>
                <span>Describe the project in your own words</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder={`Example: I want to ${variant.name.toLowerCase()}. The home is one story and I can see some damage, but I don't know the exact material or measurements.`}
                />
                <small>
                  Mention what you want changed, visible damage, size if known,
                  and anything that seems difficult.
                </small>
              </label>

              <label className={styles.field}>
                <span>Project ZIP code</span>
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  onChange={(event) =>
                    setPostalCode(event.target.value.replace(/\D/g, ""))
                  }
                />
                <small>
                  HUM’s first pricing baseline is Humboldt County. Other ZIP
                  codes receive a wider range.
                </small>
              </label>

              <label className={styles.uploadZone}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => handleImages(event.target.files)}
                />
                <span className={styles.uploadIcon}>＋</span>
                <strong>
                  {files.length
                    ? `${files.length} photo${files.length === 1 ? "" : "s"} selected`
                    : mode === "photo"
                      ? "Choose project photos"
                      : "Add photos for extra context (optional)"}
                </strong>
                <small>Up to 4 JPEG, PNG or WebP images · 4 MB each</small>
              </label>

              {files.length > 0 && (
                <div className={styles.fileList}>
                  {files.map((file) => (
                    <span key={`${file.name}-${file.lastModified}`}>
                      {file.name}
                    </span>
                  ))}
                </div>
              )}

              {message && <p className={styles.message}>{message}</p>}

              <button
                type="button"
                className={styles.primaryButton}
                onClick={analyzeProject}
                disabled={busy}
              >
                {busy ? "Reading your project…" : "Review what HUM found →"}
              </button>
            </div>

            <aside className={styles.tipCard}>
              <p className={styles.eyebrow}>Photos that help</p>
              <h2>Stay safe and keep it simple.</h2>
              <ul>
                {category.photoTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <p className={styles.tipWarning}>
                Never climb, open electrical equipment, enter a crawlspace or
                touch a suspected gas leak for HUM.
              </p>
            </aside>
          </div>
        </section>
      )}

      {stage === "review" && category && variant && (
        <section className={styles.flowPage}>
          <div className={styles.flowHeading}>
            <p className={styles.eyebrow}>Confirm the facts</p>
            <h1>Make sure HUM understood you.</h1>
            <p>
              Edit anything that is wrong. These confirmed facts—not AI
              wording—control the price calculation.
            </p>
          </div>

          {analysis?.safety_flag && (
            <div className={styles.safetyAlert}>
              <strong>Stop before continuing</strong>
              <p>{analysis.safety_message}</p>
            </div>
          )}

          <div className={styles.reviewLayout}>
            <div className={styles.reviewMain}>
              {analysis && (
                <section className={styles.summaryCard}>
                  <div className={styles.summaryHeading}>
                    <span className={styles.aiDot} />
                    <div>
                      <strong>HUM’s project summary</strong>
                      <small>
                        {analysisEngine === "openai_structured_vision"
                          ? "Structured photo and description review"
                          : "Safe fallback review"}
                      </small>
                    </div>
                  </div>
                  <p>{analysis.summary}</p>
                  {analysis.facts.length > 0 && (
                    <div className={styles.factList}>
                      {analysis.facts.map((fact, index) => (
                        <div key={`${fact.label}-${index}`}>
                          <span>{fact.label}</span>
                          <strong>{fact.value}</strong>
                          <small>
                            {fact.source} · {fact.confidence} confidence
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className={styles.confirmCard}>
                {category.variants.length > 1 && (
                  <label className={styles.field}>
                    <span>Project type</span>
                    <select
                      value={variantId}
                      onChange={(event) => changeVariant(event.target.value)}
                    >
                      {category.variants.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className={styles.field}>
                  <span>{variant.quantityLabel}</span>
                  <div className={styles.unitInput}>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder={variant.quantityPlaceholder}
                    />
                    <span>{variant.quantityUnit}</span>
                  </div>
                  <small>{variant.quantityHelp}</small>
                </label>

                <fieldset className={styles.fieldset}>
                  <legend>What condition is it in?</legend>
                  <OptionCards
                    options={CONDITION_OPTIONS}
                    value={condition}
                    onChange={setCondition}
                  />
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend>How easy is the work area to reach?</legend>
                  <OptionCards
                    options={ACCESS_OPTIONS}
                    value={access}
                    onChange={setAccess}
                  />
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend>How complex does the project seem?</legend>
                  <OptionCards
                    options={COMPLEXITY_OPTIONS}
                    value={complexity}
                    onChange={setComplexity}
                  />
                </fieldset>

                {categoryId === "landscaping" && (
                  <label className={styles.field}>
                    <span>Known material or equipment budget (optional)</span>
                    <div className={styles.moneyInput}>
                      <span>$</span>
                      <input
                        type="number"
                        min="0"
                        value={extraMaterialCost}
                        onChange={(event) =>
                          setExtraMaterialCost(event.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <small>
                      Enter only a number you know. HUM will not invent plant,
                      equipment or soil costs.
                    </small>
                  </label>
                )}

                {message && <p className={styles.message}>{message}</p>}
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={calculateEstimate}
                  disabled={busy || analysis?.safety_flag}
                >
                  {busy ? "Calculating…" : "Calculate my planning range →"}
                </button>
              </section>
            </div>

            <aside className={styles.questionCard}>
              <p className={styles.eyebrow}>What could still matter</p>
              {analysis?.missing_questions.length ? (
                <ol>
                  {analysis.missing_questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              ) : (
                <p>
                  HUM has the basic planning facts. An on-site professional can
                  still uncover concealed conditions.
                </p>
              )}
              <div className={styles.unknownNote}>
                <strong>Not sure is okay.</strong>
                <p>
                  Unknown selections widen the range instead of receiving a
                  fake default.
                </p>
              </div>
            </aside>
          </div>
        </section>
      )}

      {stage === "result" && estimate && category && variant && (
        <section className={styles.resultPage}>
          <div className={styles.resultHero}>
            <div>
              <p className={styles.eyebrow}>{category.name} planning estimate</p>
              <h1>
                {formatPlannerCurrency(estimate.totals.low)}–
                {formatPlannerCurrency(estimate.totals.high)}
              </h1>
              <p className={styles.expectedPrice}>
                Expected planning point{" "}
                <strong>
                  {formatPlannerCurrency(estimate.totals.expected)}
                </strong>
              </p>
            </div>
            <div className={styles.confidenceCard}>
              <span
                className={`${styles.confidenceDot} ${styles[`confidence${estimate.confidence}`]}`}
              />
              <div>
                <strong>{estimate.confidence} confidence</strong>
                <small>
                  {estimate.confidence === "medium"
                    ? "Useful for planning; field verification still matters."
                    : "Use the wider range until real quotes improve this category."}
                </small>
              </div>
            </div>
          </div>

          <p className={styles.regionNotice}>{regionNotice}</p>

          <div className={styles.resultLayout}>
            <div className={styles.resultMain}>
              <section className={styles.breakdownCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className={styles.eyebrow}>Price breakdown</p>
                    <h2>What the expected number carries</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => window.print()}
                  >
                    Print / save PDF
                  </button>
                </div>
                <div className={styles.lineItems}>
                  {estimate.lineItems.map((item) => (
                    <div key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.explanation}</p>
                      </div>
                      <span>{formatPlannerCurrency(item.expected)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.rangeExplainer}>
                <div>
                  <span>Lower end</span>
                  <strong>{formatPlannerCurrency(estimate.totals.low)}</strong>
                  <p>Clear scope, normal access and limited hidden work.</p>
                </div>
                <div className={styles.rangeExpected}>
                  <span>Expected</span>
                  <strong>
                    {formatPlannerCurrency(estimate.totals.expected)}
                  </strong>
                  <p>Most likely planning point from confirmed facts.</p>
                </div>
                <div>
                  <span>Upper end</span>
                  <strong>{formatPlannerCurrency(estimate.totals.high)}</strong>
                  <p>Harder access, damage, custom scope or larger unknowns.</p>
                </div>
              </section>

              <section className={styles.detailGrid}>
                <article>
                  <p className={styles.eyebrow}>Confirmed assumptions</p>
                  <ul>
                    {estimate.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article>
                  <p className={styles.eyebrow}>Could change on site</p>
                  {estimate.unknowns.length ? (
                    <ul>
                      {estimate.unknowns.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No major intake facts remain unknown, but concealed
                      conditions can still change a real proposal.
                    </p>
                  )}
                </article>
              </section>

              <section className={styles.sourceCard}>
                <p className={styles.eyebrow}>Pricing transparency</p>
                <h2>{estimate.catalog.versionCode}</h2>
                <p>
                  Effective {estimate.catalog.effectiveDate}; evidence reviewed{" "}
                  {estimate.catalog.verifiedAt}. The result was calculated from
                  stored unit ranges and confirmed facts. AI did not set the
                  price.
                </p>
                <details>
                  <summary>Current evidence and limitations</summary>
                  <p>{estimate.catalog.limitationNote}</p>
                  <p>
                    Evidence register keys:{" "}
                    {estimate.sourceKeys.length
                      ? estimate.sourceKeys.join(", ")
                      : "administrator assumptions pending calibration"}
                  </p>
                </details>
              </section>

              <section className={styles.calibrationCard}>
                <div className={styles.calibrationIntro}>
                  <p className={styles.eyebrow}>Help HUM learn after the project</p>
                  <h2>Upload the real quote or final invoice.</h2>
                  <p>
                    HUM stores the document privately. With your permission,
                    reviewed anonymous scope and totals can improve future
                    ranges. Contractor identity is not used as a pricing
                    feature.
                  </p>
                </div>

                {!session ? (
                  <form className={styles.authForm} onSubmit={authenticate}>
                    <div className={styles.authTabs}>
                      <button
                        type="button"
                        className={authMode === "signin" ? styles.authActive : ""}
                        onClick={() => setAuthMode("signin")}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className={authMode === "signup" ? styles.authActive : ""}
                        onClick={() => setAuthMode("signup")}
                      >
                        Create account
                      </button>
                    </div>
                    <label className={styles.field}>
                      <span>Email</span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Password</span>
                      <input
                        type="password"
                        required
                        minLength={10}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={
                          authMode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                      />
                    </label>
                    <button
                      className={styles.primaryButton}
                      disabled={busy}
                    >
                      {authMode === "signin"
                        ? "Sign in to save"
                        : "Create private account"}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className={styles.saveRow}>
                      <div>
                        <strong>
                          {saved ? "Estimate saved" : "Save this estimate privately"}
                        </strong>
                        <p>
                          Saved projects keep the exact pricing version and
                          confirmed inputs used today.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={saveEstimate}
                        disabled={busy || Boolean(saved)}
                      >
                        {saved ? "Saved ✓" : "Save estimate"}
                      </button>
                    </div>

                    <form
                      className={styles.quoteForm}
                      onSubmit={submitCalibration}
                    >
                      <label className={styles.uploadZone}>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            setQuoteFile(event.target.files?.[0] ?? null)
                          }
                        />
                        <span className={styles.uploadIcon}>＋</span>
                        <strong>
                          {quoteFile
                            ? quoteFile.name
                            : "Attach real quote or invoice"}
                        </strong>
                        <small>PDF or image · up to 10 MB</small>
                      </label>
                      <div className={styles.twoFields}>
                        <label className={styles.field}>
                          <span>Quoted total</span>
                          <div className={styles.moneyInput}>
                            <span>$</span>
                            <input
                              type="number"
                              min="1"
                              value={actualQuoteTotal}
                              onChange={(event) =>
                                setActualQuoteTotal(event.target.value)
                              }
                              placeholder="0"
                            />
                          </div>
                        </label>
                        <label className={styles.field}>
                          <span>Final paid total (optional)</span>
                          <div className={styles.moneyInput}>
                            <span>$</span>
                            <input
                              type="number"
                              min="1"
                              value={actualFinalTotal}
                              onChange={(event) =>
                                setActualFinalTotal(event.target.value)
                              }
                              placeholder="0"
                            />
                          </div>
                        </label>
                      </div>
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={projectCompleted}
                          onChange={(event) =>
                            setProjectCompleted(event.target.checked)
                          }
                        />
                        <span>The project was completed</span>
                      </label>
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          required
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                        />
                        <span>
                          I allow HUM to use reviewed, anonymous project facts
                          and totals to improve future planning ranges.
                        </span>
                      </label>
                      <button
                        className={styles.primaryButton}
                        disabled={busy}
                      >
                        Submit private calibration evidence
                      </button>
                    </form>
                  </>
                )}
                {message && <p className={styles.message}>{message}</p>}
                {calibrationMessage && (
                  <p className={styles.message}>{calibrationMessage}</p>
                )}
              </section>
            </div>

            <aside className={styles.resultAside}>
              <div className={styles.nextStepCard}>
                <p className={styles.eyebrow}>Use this range to</p>
                <ul>
                  <li>Set a realistic planning budget</li>
                  <li>Compare contractor scope—not just total price</li>
                  <li>Ask about the unknowns HUM identified</li>
                  <li>Keep a contingency before work begins</li>
                </ul>
              </div>
              <button
                type="button"
                className={styles.newQuoteButton}
                onClick={reset}
              >
                Plan another project
              </button>
              <p className={styles.disclaimer}>
                HUM is not a licensed contractor, engineer or inspector. This
                estimate is for planning and does not replace an on-site
                professional proposal, permit review or emergency service.
              </p>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
