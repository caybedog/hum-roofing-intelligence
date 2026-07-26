import { z } from "zod";
import { OPENAI_MODEL } from "@/app/foundation/config";

const categoryIds = [
  "roofing",
  "gutters",
  "windows",
  "doors",
  "plumbing",
  "painting",
  "flooring",
  "electrical",
  "hvac",
  "siding",
  "deck",
  "bathroom",
  "kitchen",
  "fencing",
  "concrete",
  "landscaping",
] as const;

const variants = [
  "asphalt_replacement",
  "seamless_aluminum",
  "standard_replacement",
  "exterior_door",
  "fixture_work",
  "water_heater",
  "repipe",
  "interior",
  "exterior",
  "installed",
  "fixture_or_circuit",
  "panel",
  "heat_pump",
  "replacement",
  "new_deck",
  "remodel",
  "wood_fence",
  "flatwork",
  "labor_project",
] as const;

const bodySchema = z.object({
  description: z.string().trim().min(3).max(5000),
  selectedCategory: z.enum(categoryIds).optional(),
  selectedVariant: z.enum(variants).optional(),
  images: z
    .array(
      z
        .string()
        .max(6_000_000)
        .regex(/^data:image\/(jpeg|png|webp);base64,/),
    )
    .max(4)
    .default([]),
});

const analysisSchema = z.object({
  category: z.enum(categoryIds),
  variant: z.enum(variants),
  summary: z.string().min(1).max(800),
  quantity: z.number().positive().max(1000000).nullable(),
  quantity_unit: z.enum([
    "square_foot",
    "linear_foot",
    "each",
    "room",
    "labor_hour",
  ]),
  access: z.enum(["easy", "normal", "difficult", "unknown"]),
  condition: z.enum(["good", "typical", "worn", "damaged", "unknown"]),
  complexity: z.enum(["simple", "standard", "complex", "unknown"]),
  facts: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        value: z.string().min(1).max(240),
        confidence: z.enum(["low", "medium", "high"]),
        source: z.enum(["homeowner", "photo", "inference"]),
      }),
    )
    .max(12),
  missing_questions: z.array(z.string().min(1).max(220)).max(4),
  safety_flag: z.boolean(),
  safety_message: z.string().max(500),
});

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "variant",
    "summary",
    "quantity",
    "quantity_unit",
    "access",
    "condition",
    "complexity",
    "facts",
    "missing_questions",
    "safety_flag",
    "safety_message",
  ],
  properties: {
    category: { type: "string", enum: categoryIds },
    variant: { type: "string", enum: variants },
    summary: { type: "string", maxLength: 800 },
    quantity: {
      anyOf: [
        { type: "number", exclusiveMinimum: 0, maximum: 1000000 },
        { type: "null" },
      ],
    },
    quantity_unit: {
      type: "string",
      enum: ["square_foot", "linear_foot", "each", "room", "labor_hour"],
    },
    access: {
      type: "string",
      enum: ["easy", "normal", "difficult", "unknown"],
    },
    condition: {
      type: "string",
      enum: ["good", "typical", "worn", "damaged", "unknown"],
    },
    complexity: {
      type: "string",
      enum: ["simple", "standard", "complex", "unknown"],
    },
    facts: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "confidence", "source"],
        properties: {
          label: { type: "string", maxLength: 100 },
          value: { type: "string", maxLength: 240 },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          source: {
            type: "string",
            enum: ["homeowner", "photo", "inference"],
          },
        },
      },
    },
    missing_questions: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 220 },
    },
    safety_flag: { type: "boolean" },
    safety_message: { type: "string", maxLength: 500 },
  },
} as const;

const VARIANT_BY_CATEGORY: Record<(typeof categoryIds)[number], string> = {
  roofing: "asphalt_replacement",
  gutters: "seamless_aluminum",
  windows: "standard_replacement",
  doors: "exterior_door",
  plumbing: "fixture_work",
  painting: "interior",
  flooring: "installed",
  electrical: "fixture_or_circuit",
  hvac: "heat_pump",
  siding: "replacement",
  deck: "new_deck",
  bathroom: "remodel",
  kitchen: "remodel",
  fencing: "wood_fence",
  concrete: "flatwork",
  landscaping: "labor_project",
};

const VALID_VARIANTS_BY_CATEGORY: Record<
  (typeof categoryIds)[number],
  ReadonlyArray<(typeof variants)[number]>
> = {
  roofing: ["asphalt_replacement"],
  gutters: ["seamless_aluminum"],
  windows: ["standard_replacement"],
  doors: ["exterior_door"],
  plumbing: ["fixture_work", "water_heater", "repipe"],
  painting: ["interior", "exterior"],
  flooring: ["installed"],
  electrical: ["fixture_or_circuit", "panel"],
  hvac: ["heat_pump"],
  siding: ["replacement"],
  deck: ["new_deck"],
  bathroom: ["remodel"],
  kitchen: ["remodel"],
  fencing: ["wood_fence"],
  concrete: ["flatwork"],
  landscaping: ["labor_project"],
};

const UNIT_BY_VARIANT: Record<string, z.infer<typeof analysisSchema>["quantity_unit"]> = {
  asphalt_replacement: "square_foot",
  seamless_aluminum: "linear_foot",
  standard_replacement: "each",
  exterior_door: "each",
  fixture_work: "each",
  water_heater: "each",
  repipe: "square_foot",
  interior: "square_foot",
  exterior: "square_foot",
  installed: "square_foot",
  fixture_or_circuit: "each",
  panel: "each",
  heat_pump: "each",
  replacement: "square_foot",
  new_deck: "square_foot",
  remodel: "room",
  wood_fence: "linear_foot",
  flatwork: "square_foot",
  labor_project: "labor_hour",
};

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const result = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string; refusal?: string }>;
    }>;
  };
  if (typeof result.output_text === "string") return result.output_text;
  for (const item of result.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) throw new Error("The photo analysis was declined.");
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

function fallbackAnalysis(
  body: z.infer<typeof bodySchema>,
): z.infer<typeof analysisSchema> {
  const normalized = body.description.toLowerCase();
  const detected =
    body.selectedCategory ??
    categoryIds.find((category) => {
      const aliases: Record<string, string[]> = {
        roofing: ["roof", "shingle"],
        gutters: ["gutter", "downspout"],
        windows: ["window"],
        doors: ["door"],
        plumbing: ["plumb", "pipe", "toilet", "water heater", "faucet"],
        painting: ["paint"],
        flooring: ["floor", "carpet", "laminate", "hardwood", "tile"],
        electrical: ["electric", "panel", "outlet", "wiring"],
        hvac: ["hvac", "heat pump", "furnace", "air condition"],
        siding: ["siding"],
        deck: ["deck"],
        bathroom: ["bathroom", "shower", "tub"],
        kitchen: ["kitchen", "cabinet", "countertop"],
        fencing: ["fence"],
        concrete: ["concrete", "patio", "walkway", "driveway"],
        landscaping: ["landscap", "yard", "garden"],
      };
      return aliases[category]?.some((alias) => normalized.includes(alias));
    }) ??
    "roofing";
  const variant = body.selectedVariant ?? VARIANT_BY_CATEGORY[detected];
  const quantityMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(square feet|sq\.?\s*ft|linear feet|feet|windows|doors|fixtures|rooms|hours)/,
  );
  const safetyFlag =
    /\b(gas smell|sparks|smoke|collapsed|collapse|live wire|flooding now)\b/.test(
      normalized,
    );

  return {
    category: detected,
    variant: variant as (typeof variants)[number],
    summary:
      "HUM organized the project description. Confirm the measurement and site conditions before calculating the planning range.",
    quantity: quantityMatch ? Number(quantityMatch[1]) : null,
    quantity_unit: UNIT_BY_VARIANT[variant] ?? "each",
    access: "unknown",
    condition: normalized.includes("damage") ? "damaged" : "unknown",
    complexity: "unknown",
    facts: [
      {
        label: "Homeowner description",
        value: body.description.slice(0, 240),
        confidence: "high",
        source: "homeowner",
      },
      ...(body.images.length
        ? [
            {
              label: "Photos attached",
              value: `${body.images.length} photo${body.images.length === 1 ? "" : "s"} ready for review`,
              confidence: "high" as const,
              source: "homeowner" as const,
            },
          ]
        : []),
    ],
    missing_questions: [
      ...(quantityMatch
        ? []
        : ["What is the approximate project quantity or measurement?"]),
      "How difficult is it to reach the work area?",
      "How would you describe the current condition?",
      "Are there custom details, hidden damage or multiple trades involved?",
    ].slice(0, 4),
    safety_flag: safetyFlag,
    safety_message: safetyFlag
      ? "The description may involve an immediate hazard. Leave the area if needed and contact emergency services, the utility, or a licensed professional before continuing."
      : "",
  };
}

function normalizeAnalysis(
  analysis: z.infer<typeof analysisSchema>,
  body: z.infer<typeof bodySchema>,
) {
  const category = body.selectedCategory ?? analysis.category;
  const permitted = VALID_VARIANTS_BY_CATEGORY[category];
  const requestedVariant =
    body.selectedCategory === category && body.selectedVariant
      ? body.selectedVariant
      : analysis.variant;
  const variant = permitted.includes(requestedVariant)
    ? requestedVariant
    : (VARIANT_BY_CATEGORY[category] as (typeof variants)[number]);

  return {
    ...analysis,
    category,
    variant,
    quantity_unit: UNIT_BY_VARIANT[variant],
  };
}

function noStore(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return noStore(
      { error: "Add a short project description and up to four photos." },
      400,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return noStore({
      analysis: fallbackAnalysis(body),
      engine: "deterministic_fallback",
    });
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        "You are HUM's home-project intake specialist.",
        "Extract only facts supported by the homeowner text or visible photos.",
        "Never calculate, suggest, or invent a price.",
        "Never claim a concealed condition is visible.",
        "Do not infer an exact measurement from perspective photos. Quantity must be null unless the homeowner states it or the photo contains a clearly countable set such as doors or windows.",
        "Choose only a category and variant from the schema.",
        "Ask no more than four short questions that materially improve a planning estimate.",
        "Use safety_flag for gas odor, smoke, sparking, exposed live wiring, active flooding, collapse risk, or another immediate hazard.",
        `Selected category: ${body.selectedCategory ?? "not selected"}.`,
        `Selected variant: ${body.selectedVariant ?? "not selected"}.`,
        `Homeowner description: ${body.description}`,
      ].join("\n"),
    },
    ...body.images.map((image) => ({
      type: "input_image",
      image_url: image,
      detail: "high",
    })),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? OPENAI_MODEL ?? "gpt-5.6",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "hum_home_project_extraction",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error("The AI analysis service is temporarily unavailable.");
    }
    const payload = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("The AI returned no structured analysis.");
    const analysis = analysisSchema.parse(JSON.parse(outputText));
    return noStore({
      analysis: normalizeAnalysis(analysis, body),
      engine: "openai_structured_vision",
    });
  } catch {
    return noStore({
      analysis: fallbackAnalysis(body),
      engine: "deterministic_fallback",
    });
  }
}
