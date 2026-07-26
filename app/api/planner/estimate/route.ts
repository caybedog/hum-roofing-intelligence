import { z } from "zod";
import { calculatePlannerEstimate } from "@/app/planner/estimate-engine.mjs";
import {
  bundledPlannerCatalog,
  bundledPlannerItem,
} from "@/app/planner/baseline-catalog";

const requestSchema = z.object({
  mode: z.enum(["photo", "guided"]),
  category: z.string().regex(/^[a-z0-9_-]+$/),
  variant: z.string().regex(/^[a-z0-9_-]+$/),
  quantity: z.coerce.number().positive().max(1000000),
  access: z.enum(["easy", "normal", "difficult", "unknown"]),
  condition: z.enum(["good", "typical", "worn", "damaged", "unknown"]),
  complexity: z.enum(["simple", "standard", "complex", "unknown"]),
  unknownCount: z.coerce.number().int().min(0).max(8),
  extraMaterialCost: z.coerce.number().min(0).max(1000000).optional(),
  postalCode: z.string().regex(/^[0-9]{5}$/),
});

function noStore(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

export async function POST(request: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    return noStore(
      {
        error:
          error instanceof Error
            ? "Check the project measurements and selections."
            : "The project information is incomplete.",
      },
      400,
    );
  }

  // A quote is calculated from an immutable release snapshot, not a mutable
  // remote response. The same catalog and ids are registered in Supabase so a
  // saved estimate remains traceable to its approved database version.
  const catalog = bundledPlannerCatalog;
  const item = bundledPlannerItem(input.category, input.variant);

  if (!item) {
    return noStore(
      {
        error:
          "HUM does not have an approved planning baseline for that exact project yet.",
      },
      422,
    );
  }

  try {
    const outsideHumboldtBaseline = !input.postalCode.startsWith("955");
    const estimate = calculatePlannerEstimate({
      input: {
        ...input,
        unknownCount:
          input.unknownCount + (outsideHumboldtBaseline ? 1 : 0),
      },
      item,
      catalog,
    });

    return noStore({
      estimate,
      regionNotice: outsideHumboldtBaseline
        ? "This ZIP code is outside HUM’s current Humboldt pricing baseline, so the range is wider and confidence remains low."
        : "This estimate uses HUM’s approved Humboldt County planning baseline. The exact pricing version is shown below.",
    });
  } catch (error) {
    return noStore(
      {
        error:
          error instanceof Error
            ? error.message
            : "HUM could not calculate this project.",
      },
      422,
    );
  }
}
