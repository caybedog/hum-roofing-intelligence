export type PlannerEstimateInput = {
  mode: "photo" | "guided";
  category: string;
  variant: string;
  quantity: number;
  access: "easy" | "normal" | "difficult" | "unknown";
  condition: "good" | "typical" | "worn" | "damaged" | "unknown";
  complexity: "simple" | "standard" | "complex" | "unknown";
  unknownCount: number;
  extraMaterialCost?: number;
};

export function calculatePlannerEstimate(args: {
  input: PlannerEstimateInput;
  item: Record<string, unknown>;
  catalog: Record<string, unknown>;
}): Record<string, unknown>;

export function formatPlannerCurrency(value: number): string;
