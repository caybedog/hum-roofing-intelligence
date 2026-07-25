import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deterministicIntake } from "@/app/foundation/fallback-intake.mjs";
import { OPENAI_MODEL } from "@/app/foundation/config";
import type { Database } from "@/app/foundation/database.types";
import type {
  AiInterpretation,
  HomeownerIntakeState,
  IntakeChatMessage,
  IntakeFieldKey,
  Project,
} from "@/app/foundation/types";
import {
  getAuthenticatedSupabase,
  noStoreJson,
} from "@/app/foundation/server-supabase";

const fieldKeys = [
  "city",
  "postal_code",
  "project_type",
  "footprint_sqft",
  "roof_pitch",
  "stories",
  "existing_layers",
  "roof_material",
  "access_level",
  "complexity",
  "active_leak",
  "chimney_count",
  "skylight_count",
] as const satisfies readonly IntakeFieldKey[];

const aiFieldSchema = z.enum(fieldKeys);

const bodySchema = z.object({
  projectId: z.uuid(),
  message: z.string().trim().min(2).max(4000),
});

const nextQuestionSchema = z.object({
  field: z.union([aiFieldSchema, z.literal("complete")]),
  question: z.string().min(1).max(300),
  why_it_matters: z.string().min(1).max(300),
  answer_help: z.array(z.string().min(1).max(120)).max(4),
});

const interpretationSchema = z.object({
  summary: z.string().min(1).max(800),
  assistant_message: z.string().min(1).max(700),
  project_type: z.enum([
    "repair",
    "replacement",
    "inspection",
    "unknown",
  ]),
  urgency: z.enum([
    "active_leak",
    "damage",
    "no_active_leak",
    "unknown",
  ]),
  facts: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        value: z.string().max(240),
        source_text: z.string().max(240),
      }),
    )
    .max(16),
  confirmed_updates: z
    .array(
      z.object({
        field: aiFieldSchema,
        value: z.string().min(1).max(160),
        source_text: z.string().min(1).max(240),
      }),
    )
    .max(13),
  deferred_fields: z.array(aiFieldSchema).max(13),
  next_question: nextQuestionSchema,
  interpretations: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        explanation: z.string().min(1).max(500),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(8),
  missing_information: z.array(z.string().max(220)).max(12),
  follow_up_questions: z.array(z.string().max(300)).max(1),
  can_estimate: z.boolean(),
});

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "assistant_message",
    "project_type",
    "urgency",
    "facts",
    "confirmed_updates",
    "deferred_fields",
    "next_question",
    "interpretations",
    "missing_information",
    "follow_up_questions",
    "can_estimate",
  ],
  properties: {
    summary: { type: "string", maxLength: 800 },
    assistant_message: { type: "string", maxLength: 700 },
    project_type: {
      type: "string",
      enum: ["repair", "replacement", "inspection", "unknown"],
    },
    urgency: {
      type: "string",
      enum: ["active_leak", "damage", "no_active_leak", "unknown"],
    },
    facts: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "source_text"],
        properties: {
          field: { type: "string", maxLength: 80 },
          value: { type: "string", maxLength: 240 },
          source_text: { type: "string", maxLength: 240 },
        },
      },
    },
    confirmed_updates: {
      type: "array",
      maxItems: 13,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "source_text"],
        properties: {
          field: { type: "string", enum: fieldKeys },
          value: { type: "string", maxLength: 160 },
          source_text: { type: "string", maxLength: 240 },
        },
      },
    },
    deferred_fields: {
      type: "array",
      maxItems: 13,
      items: { type: "string", enum: fieldKeys },
    },
    next_question: {
      type: "object",
      additionalProperties: false,
      required: ["field", "question", "why_it_matters", "answer_help"],
      properties: {
        field: { type: "string", enum: [...fieldKeys, "complete"] },
        question: { type: "string", maxLength: 300 },
        why_it_matters: { type: "string", maxLength: 300 },
        answer_help: {
          type: "array",
          maxItems: 4,
          items: { type: "string", maxLength: 120 },
        },
      },
    },
    interpretations: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "explanation", "confidence"],
        properties: {
          label: { type: "string", maxLength: 120 },
          explanation: { type: "string", maxLength: 500 },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
        },
      },
    },
    missing_information: {
      type: "array",
      maxItems: 12,
      items: { type: "string", maxLength: 220 },
    },
    follow_up_questions: {
      type: "array",
      maxItems: 1,
      items: { type: "string", maxLength: 300 },
    },
    can_estimate: { type: "boolean" },
  },
} as const;

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; refusal?: string }>;
    }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" || content.refusal) {
        throw new Error("The AI interpreter declined this request.");
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

async function completeRequestLog(
  client: SupabaseClient<Database>,
  requestId: string | null,
  values: {
    status: "completed" | "fallback" | "error";
    latency_ms: number;
    provider_request_id?: string | null;
    error_code?: string | null;
  },
) {
  if (!requestId) return;
  await client.rpc("complete_ai_request", {
    p_request_id: requestId,
    p_status: values.status,
    p_latency_ms: values.latency_ms,
    p_provider_request_id: values.provider_request_id ?? null,
    p_error_code: values.error_code ?? null,
  });
}

function integerBetween(value: string, min: number, max: number) {
  const match = value.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function normalizeUpdate(field: IntakeFieldKey, value: string) {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  switch (field) {
    case "city": {
      const city = value.trim().replace(/[^\p{L}\p{M}\s.'-]/gu, "").slice(0, 80);
      return city.length >= 2 ? city : null;
    }
    case "postal_code": {
      const zip = value.replace(/\D/g, "").slice(0, 5);
      return zip.length === 5 ? zip : null;
    }
    case "project_type":
      return ["repair", "replacement", "inspection", "unknown"].includes(
        normalized,
      )
        ? normalized
        : null;
    case "footprint_sqft":
      return integerBetween(value, 100, 50000);
    case "roof_pitch":
      return ["low", "moderate", "steep"].includes(normalized)
        ? normalized
        : null;
    case "stories":
      return integerBetween(value, 1, 4);
    case "existing_layers":
      return integerBetween(value, 0, 4);
    case "roof_material":
      return [
        "architectural_shingle",
        "three_tab",
        "metal",
        "tile",
        "unknown",
      ].includes(normalized)
        ? normalized
        : null;
    case "access_level":
      return ["easy", "standard", "difficult"].includes(normalized)
        ? normalized
        : null;
    case "complexity":
      return ["simple", "standard", "complex"].includes(normalized)
        ? normalized
        : null;
    case "active_leak":
      if (["true", "yes", "active_leak"].includes(normalized)) return true;
      if (["false", "no", "no_active_leak"].includes(normalized)) return false;
      return null;
    case "chimney_count":
      return integerBetween(value, 0, 12);
    case "skylight_count":
      return integerBetween(value, 0, 30);
  }
}

function sanitizeUpdates(
  interpretation: z.infer<typeof interpretationSchema>,
) {
  const updates: Partial<Project> = {};
  const accepted: typeof interpretation.confirmed_updates = [];
  for (const candidate of interpretation.confirmed_updates) {
    const normalized = normalizeUpdate(candidate.field, candidate.value);
    if (normalized === null) continue;
    (updates as Record<string, unknown>)[candidate.field] = normalized;
    accepted.push(candidate);
  }
  return { updates, accepted };
}

function stateFrom(project: Project) {
  const state =
    project.homeowner_facts && typeof project.homeowner_facts === "object"
      ? project.homeowner_facts
      : {};
  return state as HomeownerIntakeState;
}

function currentFieldSnapshot(project: Project, state: HomeownerIntakeState) {
  const confirmed = Object.keys(state.confirmed_fields ?? {});
  const values = Object.fromEntries(
    confirmed
      .filter((field) => fieldKeys.includes(field as IntakeFieldKey))
      .map((field) => [field, project[field as keyof Project]]),
  );
  return {
    confirmed_values: values,
    deferred_fields: state.deferred_fields ?? [],
    current_question: project.ai_interpretation?.next_question ?? null,
  };
}

function appendConversation(
  existing: IntakeChatMessage[],
  message: string,
  assistantMessage: string,
) {
  const timestamp = new Date().toISOString();
  return [
    ...existing.slice(-14),
    { role: "homeowner" as const, content: message, created_at: timestamp },
    {
      role: "assistant" as const,
      content: assistantMessage,
      created_at: timestamp,
    },
  ].slice(-16);
}

function conversationNarrative(messages: IntakeChatMessage[]) {
  return messages
    .filter((item) => item.role === "homeowner")
    .map((item) => item.content)
    .join("\n")
    .slice(-6000);
}

async function saveInterpretation(
  client: SupabaseClient<Database>,
  project: Project,
  message: string,
  interpretation: z.infer<typeof interpretationSchema>,
  source: "openai" | "deterministic_fallback",
) {
  const state = stateFrom(project);
  const { updates, accepted } = sanitizeUpdates(interpretation);
  const previousConfirmed = state.confirmed_fields ?? {};
  const nextConfirmed = { ...previousConfirmed };
  const now = new Date().toISOString();

  for (const update of accepted) {
    nextConfirmed[update.field] = {
      source: "homeowner_chat",
      source_text: update.source_text,
      confirmed_at: now,
    };
  }

  const deferred = new Set<IntakeFieldKey>([
    ...(state.deferred_fields ?? []),
    ...interpretation.deferred_fields,
  ]);
  for (const update of accepted) deferred.delete(update.field);

  const conversation = appendConversation(
    state.conversation ?? [],
    message,
    interpretation.assistant_message,
  );
  const homeownerFacts: HomeownerIntakeState = {
    ...state,
    intake_version: 2,
    conversation,
    confirmed_fields: nextConfirmed,
    deferred_fields: [...deferred],
    last_autofilled_fields: accepted.map((item) => item.field),
    decking_allowance_method:
      state.decking_allowance_method ?? "hum_default",
  };
  const savedInterpretation: AiInterpretation = {
    ...interpretation,
    confirmed_updates: accepted,
    deferred_fields: [...deferred],
    autofilled_fields: accepted.map((item) => item.field),
  };

  const nextProject: Partial<Project> = {
    ...updates,
    status:
      updates.footprint_sqft || project.footprint_sqft
        ? ("ready_for_estimate" as const)
        : ("draft" as const),
    intake_step:
      updates.footprint_sqft || project.footprint_sqft ? 5 : 2,
    homeowner_notes: conversationNarrative(conversation),
    homeowner_facts: homeownerFacts,
    ai_interpretation: savedInterpretation,
    ai_source: source,
    updated_at: now,
  };

  const { data, error } = await client
    .from("projects")
    .update(nextProject)
    .eq("id", project.id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("The interpreted project facts could not be saved.");
  }
  return data as Project;
}

function transcriptForModel(
  project: Project,
  state: HomeownerIntakeState,
  message: string,
) {
  const transcript = (state.conversation ?? [])
    .slice(-12)
    .map(
      (item) =>
        `${item.role === "homeowner" ? "HOMEOWNER" : "HUM"}: ${item.content}`,
    )
    .join("\n");
  return [
    "CURRENT PROJECT STATE",
    JSON.stringify(currentFieldSnapshot(project, state)),
    "",
    "CONVERSATION SO FAR",
    transcript || "(first message)",
    "",
    `HOMEOWNER: ${message}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (!auth) return noStoreJson({ error: "Authentication required." }, 401);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return noStoreJson(
      { error: "Write at least two characters about the project." },
      400,
    );
  }

  const { client, user } = auth;
  const { data, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", parsed.projectId)
    .single();
  const project = data as Project | null;
  if (projectError || !project || project.homeowner_id !== user.id) {
    return noStoreJson({ error: "Project not found." }, 404);
  }

  const { data: claim, error: claimError } = await client.rpc(
    "claim_ai_request",
    {
      p_project_id: project.id,
      p_model: OPENAI_MODEL,
      p_input_chars: parsed.message.length,
    },
  );
  const claimRow = Array.isArray(claim) ? claim[0] : claim;
  if (claimError || !claimRow?.allowed || !claimRow.request_id) {
    return noStoreJson(
      {
        error:
          "AI intake is limited to 10 answers per hour for each account. Review the filled fields or continue later.",
      },
      429,
    );
  }

  const requestLogId = String(claimRow.request_id);
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  const state = stateFrom(project);

  try {
    if (!apiKey) throw new Error("OpenAI is not configured.");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 1900,
        input: [
          {
            role: "developer",
            content: [
              "You are HUM's calm homeowner roofing-intake guide for a controlled Humboldt County pilot.",
              "Write at an eighth-grade reading level. Keep the assistant_message brief, helpful, and nonjudgmental.",
              "Extract and autofill only facts the homeowner directly stated in this conversation. Never infer an unstated value from a typical house.",
              "confirmed_updates values must use these canonical formats:",
              "project_type: repair|replacement|inspection|unknown; footprint_sqft: number; roof_pitch: low|moderate|steep; stories: 1-4; existing_layers: 0-4; roof_material: architectural_shingle|three_tab|metal|tile|unknown; access_level: easy|standard|difficult; complexity: simple|standard|complex; active_leak: true|false; chimney_count and skylight_count: whole numbers; postal_code: five digits.",
              "Every confirmed update needs an exact supporting source_text from the homeowner. If evidence is absent or ambiguous, do not update that field.",
              "If the homeowner says they do not know the answer to the current question, put that field in deferred_fields and do not ask it again during this intake.",
              "Ask exactly one focused next question. Prioritize: project type, active leak, ground-floor footprint, roof material, stories, visible pitch, existing layers, complexity, access, chimneys/skylights, city/ZIP.",
              "For footprint, explain they can use a real-estate listing or multiply home length by width; for multi-story living area, approximate ground footprint by dividing by stories.",
              "Never ask the homeowner how many decking sheets are needed. Explain that decking is the wood below the roof covering, hidden damage is usually unknown until tear-off, and HUM carries a clearly labeled temporary allowance.",
              "Never invent dimensions, quantities, unit costs, labor hours, code compliance, structural condition, hidden damage, profit margin, or price.",
              "When the necessary planning facts are collected, set next_question.field to complete and ask the homeowner to review the filled form.",
            ].join("\n"),
          },
          {
            role: "user",
            content: transcriptForModel(project, state, parsed.message),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "hum_guided_roofing_intake",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const providerRequestId = response.headers.get("x-request-id");
    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("OpenAI returned no structured output.");
    const interpretation = interpretationSchema.parse(
      JSON.parse(outputText),
    );
    const savedProject = await saveInterpretation(
      client,
      project,
      parsed.message,
      interpretation,
      "openai",
    );

    await completeRequestLog(client, requestLogId, {
      status: "completed",
      latency_ms: Date.now() - startedAt,
      provider_request_id: providerRequestId,
      error_code: null,
    });

    return noStoreJson({
      source: "openai",
      interpretation: savedProject.ai_interpretation,
      project: savedProject,
    });
  } catch (error) {
    const currentQuestion =
      project.ai_interpretation?.next_question?.field === "complete"
        ? undefined
        : project.ai_interpretation?.next_question?.field;
    const fallback = interpretationSchema.parse(
      deterministicIntake(parsed.message, {
        confirmed_fields: Object.keys(state.confirmed_fields ?? {}),
        deferred_fields: state.deferred_fields ?? [],
        current_question: currentQuestion,
      }),
    );
    const errorCode =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "timeout"
        : "provider_unavailable";

    try {
      const savedProject = await saveInterpretation(
        client,
        project,
        parsed.message,
        fallback,
        "deterministic_fallback",
      );
      await completeRequestLog(client, requestLogId, {
        status: "fallback",
        latency_ms: Date.now() - startedAt,
        error_code: errorCode,
      });
      return noStoreJson({
        source: "deterministic_fallback",
        interpretation: savedProject.ai_interpretation,
        project: savedProject,
        notice:
          "Live AI was unavailable, so HUM used its cautious backup intake. Review each filled field.",
      });
    } catch {
      await completeRequestLog(client, requestLogId, {
        status: "error",
        latency_ms: Date.now() - startedAt,
        error_code: "save_failed",
      });
      return noStoreJson(
        { error: "The intake could not be saved. Try again." },
        500,
      );
    }
  }
}
