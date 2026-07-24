import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deterministicIntake } from "@/app/foundation/fallback-intake.mjs";
import { OPENAI_MODEL } from "@/app/foundation/config";
import type { Database } from "@/app/foundation/database.types";
import {
  getAuthenticatedSupabase,
  noStoreJson,
} from "@/app/foundation/server-supabase";

const bodySchema = z.object({
  projectId: z.uuid(),
  narrative: z.string().trim().min(20).max(4000),
});

const interpretationSchema = z.object({
  summary: z.string().min(1).max(800),
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
    .max(12),
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
  follow_up_questions: z.array(z.string().max(260)).max(8),
  can_estimate: z.boolean(),
});

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "project_type",
    "urgency",
    "facts",
    "interpretations",
    "missing_information",
    "follow_up_questions",
    "can_estimate",
  ],
  properties: {
    summary: { type: "string", maxLength: 800 },
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
      maxItems: 12,
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
      maxItems: 8,
      items: { type: "string", maxLength: 260 },
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

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (!auth) return noStoreJson({ error: "Authentication required." }, 401);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return noStoreJson(
      { error: "Describe the roofing project in 20–4,000 characters." },
      400,
    );
  }

  const { client, user } = auth;
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id,homeowner_id")
    .eq("id", parsed.projectId)
    .single();
  if (
    projectError ||
    !project ||
    project.homeowner_id !== user.id
  ) {
    return noStoreJson({ error: "Project not found." }, 404);
  }

  const { data: claim, error: claimError } = await client.rpc(
    "claim_ai_request",
    {
      p_project_id: project.id,
      p_model: OPENAI_MODEL,
      p_input_chars: parsed.narrative.length,
    },
  );
  const claimRow = Array.isArray(claim) ? claim[0] : claim;
  if (claimError || !claimRow?.allowed || !claimRow.request_id) {
    return noStoreJson(
      {
        error:
          "AI intake is limited to 10 requests per hour for each account. Review the saved interpretation or try again later.",
      },
      429,
    );
  }

  const requestLogId = String(claimRow.request_id);
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

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
        max_output_tokens: 1400,
        input: [
          {
            role: "developer",
            content:
              "Role: Interpret a homeowner roofing description for HUM. Extract only facts stated by the homeowner. Separate direct facts from cautious interpretations. Never invent dimensions, quantities, unit costs, labor hours, code compliance, structural condition, hidden damage, profit margin, or a price. If the text is unrelated or insufficient, return empty facts, can_estimate false, and focused follow-up questions. Keep explanations plain and brief.",
          },
          {
            role: "user",
            content: parsed.narrative,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "hum_roofing_intake",
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

    await client
      .from("projects")
      .update({
        ai_interpretation: interpretation,
        ai_source: "openai",
        homeowner_notes: parsed.narrative,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    await completeRequestLog(client, requestLogId, {
      status: "completed",
      latency_ms: Date.now() - startedAt,
      provider_request_id: providerRequestId,
      error_code: null,
    });

    return noStoreJson({
      source: "openai",
      interpretation,
    });
  } catch (error) {
    const fallback = interpretationSchema.parse(
      deterministicIntake(parsed.narrative),
    );
    const errorCode =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "timeout"
        : "provider_unavailable";

    await client
      .from("projects")
      .update({
        ai_interpretation: fallback,
        ai_source: "deterministic_fallback",
        homeowner_notes: parsed.narrative,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    await completeRequestLog(client, requestLogId, {
      status: "fallback",
      latency_ms: Date.now() - startedAt,
      error_code: errorCode,
    });

    return noStoreJson({
      source: "deterministic_fallback",
      interpretation: fallback,
      notice:
        "Live AI was unavailable, so HUM used its deterministic fallback. Review every extracted field.",
    });
  }
}
