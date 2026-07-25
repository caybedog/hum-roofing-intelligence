import { z } from "zod";
import { calculateEstimate } from "@/app/foundation/estimate-engine.mjs";
import type { EstimateResult } from "@/app/foundation/types";
import {
  getAuthenticatedSupabase,
  noStoreJson,
} from "@/app/foundation/server-supabase";

const bodySchema = z.object({
  projectId: z.uuid(),
});

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (!auth) return noStoreJson({ error: "Authentication required." }, 401);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return noStoreJson({ error: "A valid project ID is required." }, 400);
  }

  const { client, user } = auth;
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", parsed.projectId)
    .single();

  if (
    projectError ||
    !project ||
    project.homeowner_id !== user.id
  ) {
    return noStoreJson({ error: "Project not found." }, 404);
  }
  if (!project.footprint_sqft) {
    return noStoreJson(
      { error: "Add the roof footprint before generating an estimate." },
      422,
    );
  }
  const confirmedFields =
    project.homeowner_facts &&
    typeof project.homeowner_facts === "object" &&
    "confirmed_fields" in project.homeowner_facts
      ? project.homeowner_facts.confirmed_fields
      : null;
  if (
    !confirmedFields ||
    typeof confirmedFields !== "object" ||
    !("footprint_sqft" in confirmedFields) ||
    !("project_type" in confirmedFields)
  ) {
    return noStoreJson(
      {
        error:
          "Confirm the project type and home footprint in the guided intake before estimating.",
      },
      422,
    );
  }

  const { data: pricingVersion, error: versionError } = await client
    .from("pricing_versions")
    .select("*")
    .eq("status", "approved")
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (versionError || !pricingVersion) {
    return noStoreJson(
      { error: "No approved pricing version is available." },
      503,
    );
  }

  const { data: pricingItems, error: itemsError } = await client
    .from("pricing_items")
    .select("*")
    .eq("pricing_version_id", pricingVersion.id)
    .order("category")
    .order("code");

  if (itemsError || !pricingItems?.length) {
    return noStoreJson(
      { error: "The approved pricing version is incomplete." },
      503,
    );
  }

  let calculationResult: EstimateResult;
  try {
    calculationResult = calculateEstimate(
      project,
      pricingVersion,
      pricingItems,
    ) as EstimateResult;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Estimate calculation failed.";
    return noStoreJson({ error: message }, 422);
  }

  const { data: previous } = await client
    .from("estimates")
    .select("version_number")
    .eq("project_id", project.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (previous?.version_number ?? 0) + 1;

  const homeownerInputs = {
    title: project.title,
    city: project.city,
    county: project.county,
    postalCode: project.postal_code,
    projectType: project.project_type,
    footprintSqft: Number(project.footprint_sqft),
    roofPitch: project.roof_pitch,
    stories: project.stories,
    existingLayers: project.existing_layers,
    roofMaterial: project.roof_material,
    accessLevel: project.access_level,
    complexity: project.complexity,
    activeLeak: project.active_leak,
    chimneyCount: project.chimney_count,
    skylightCount: project.skylight_count,
    deckingAllowanceSheets: project.decking_allowance_sheets,
    homeownerFacts: project.homeowner_facts,
  };

  const calculationInputs = {
    project: homeownerInputs,
    pricingVersion: {
      id: pricingVersion.id,
      code: pricingVersion.version_code,
      effectiveDate: pricingVersion.effective_date,
    },
    pricingItems: pricingItems.map((item) => ({
      code: item.code,
      unit: item.unit,
      low: Number(item.low_value),
      expected: Number(item.expected_value),
      high: Number(item.high_value),
    })),
    rule: "AI interpretations excluded from all monetary calculations.",
  };

  const { data: estimate, error: estimateError } = await client
    .from("estimates")
    .insert({
      project_id: project.id,
      version_number: versionNumber,
      pricing_version_id: pricingVersion.id,
      homeowner_inputs: homeownerInputs,
      ai_interpretation: project.ai_interpretation,
      calculation_inputs: calculationInputs,
      calculation_result: calculationResult,
      confidence_score: calculationResult.confidenceScore,
      missing_information: calculationResult.missingInformation,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (estimateError || !estimate) {
    return noStoreJson(
      { error: "The estimate could not be saved. Try again." },
      500,
    );
  }

  await client
    .from("projects")
    .update({
      status: "estimated",
      intake_step: 6,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);

  return noStoreJson({ estimate });
}
