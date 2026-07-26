const ACCESS_FACTORS = {
  easy: { low: 0.96, expected: 0.98, high: 1 },
  normal: { low: 1, expected: 1, high: 1.04 },
  difficult: { low: 1.05, expected: 1.15, high: 1.28 },
  unknown: { low: 0.96, expected: 1.08, high: 1.22 },
};

const CONDITION_FACTORS = {
  good: { low: 0.96, expected: 1, high: 1.05 },
  typical: { low: 1, expected: 1.04, high: 1.12 },
  worn: { low: 1.04, expected: 1.12, high: 1.25 },
  damaged: { low: 1.12, expected: 1.28, high: 1.52 },
  unknown: { low: 0.96, expected: 1.1, high: 1.32 },
};

const COMPLEXITY_FACTORS = {
  simple: { low: 0.94, expected: 0.97, high: 1 },
  standard: { low: 1, expected: 1, high: 1.06 },
  complex: { low: 1.08, expected: 1.24, high: 1.45 },
  unknown: { low: 0.97, expected: 1.08, high: 1.25 },
};

function asFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundPlanning(value) {
  if (value < 1000) return Math.round(value / 25) * 25;
  if (value < 10000) return Math.round(value / 100) * 100;
  return Math.round(value / 500) * 500;
}

function factorFor(map, value) {
  return map[value] ?? map.unknown;
}

function rankConfidence(value) {
  return { low: 0, medium: 1, high: 2 }[value] ?? 0;
}

function lowerConfidence(a, b) {
  return rankConfidence(a) <= rankConfidence(b) ? a : b;
}

export function calculatePlannerEstimate({
  input,
  item,
  catalog,
}) {
  const quantity = Math.max(0, asFiniteNumber(input.quantity));
  if (!quantity) {
    throw new Error("A project quantity greater than zero is required.");
  }

  if (!item || item.category !== input.category || item.variant !== input.variant) {
    throw new Error("No approved pricing item matches this project.");
  }

  const access = factorFor(ACCESS_FACTORS, input.access);
  const condition = factorFor(CONDITION_FACTORS, input.condition);
  const complexity = factorFor(COMPLEXITY_FACTORS, input.complexity);
  const unknownCount = Math.max(0, Math.min(8, asFiniteNumber(input.unknownCount)));
  const photoMode = input.mode === "photo";
  const uncertaintyLow = Math.max(0.72, 1 - unknownCount * 0.025 - (photoMode ? 0.04 : 0));
  const uncertaintyExpected = 1 + unknownCount * 0.02 + (photoMode ? 0.03 : 0);
  const uncertaintyHigh = 1 + unknownCount * 0.07 + (photoMode ? 0.1 : 0);

  const lowCore = Math.max(
    asFiniteNumber(item.minimum_job),
    quantity * asFiniteNumber(item.low_unit_cost),
  );
  const expectedCore = Math.max(
    asFiniteNumber(item.minimum_job),
    quantity * asFiniteNumber(item.expected_unit_cost),
  );
  const highCore = Math.max(
    asFiniteNumber(item.minimum_job),
    quantity * asFiniteNumber(item.high_unit_cost),
  );

  const lowConditioned =
    lowCore *
    access.low *
    condition.low *
    complexity.low *
    uncertaintyLow;
  const expectedConditioned =
    expectedCore *
    access.expected *
    condition.expected *
    complexity.expected *
    uncertaintyExpected;
  const highConditioned =
    highCore *
    access.high *
    condition.high *
    complexity.high *
    uncertaintyHigh;

  const userMaterials = Math.max(0, asFiniteNumber(input.extraMaterialCost));
  const lowSubtotal = lowConditioned + userMaterials + asFiniteNumber(item.permit_low);
  const expectedSubtotal =
    expectedConditioned + userMaterials + asFiniteNumber(item.permit_expected);
  const highSubtotal =
    highConditioned + userMaterials + asFiniteNumber(item.permit_high);

  const contingency = {
    low: lowSubtotal * 0.03,
    expected: expectedSubtotal * 0.07,
    high: highSubtotal * 0.14,
  };

  const low = roundPlanning(lowSubtotal + contingency.low);
  const expected = Math.max(
    low,
    roundPlanning(expectedSubtotal + contingency.expected),
  );
  const high = Math.max(
    expected,
    roundPlanning(highSubtotal + contingency.high),
  );

  const projectConfidence =
    unknownCount >= 3 || photoMode
      ? "low"
      : unknownCount === 0 && input.mode === "guided"
        ? "high"
        : "medium";
  const confidence = lowerConfidence(item.confidence, projectConfidence);

  const conditionDifference = Math.max(0, expectedConditioned - expectedCore);

  return {
    catalog: {
      id: catalog.id,
      versionCode: catalog.version_code,
      effectiveDate: catalog.effective_date,
      verifiedAt: catalog.verified_at,
      limitationNote: catalog.limitation_note,
    },
    category: input.category,
    variant: input.variant,
    label: item.label,
    unit: item.unit,
    quantity,
    totals: { low, expected, high },
    confidence,
    lineItems: [
      {
        label: `${item.label} baseline`,
        expected: roundPlanning(expectedCore),
        explanation: `${quantity.toLocaleString()} ${item.unit.replaceAll("_", " ")} at the approved Humboldt planning baseline.`,
      },
      {
        label: "Site conditions and access",
        expected: roundPlanning(conditionDifference),
        explanation:
          "Adjusts the baseline for the condition, access, complexity and unknowns you reported.",
      },
      {
        label: "Permit and inspection allowance",
        expected: roundPlanning(asFiniteNumber(item.permit_expected)),
        explanation:
          "A planning allowance only. The actual jurisdiction and permit scope control the fee.",
      },
      ...(userMaterials
        ? [
            {
              label: "Homeowner-entered material allowance",
              expected: roundPlanning(userMaterials),
              explanation:
                "A material amount you entered directly; HUM did not invent it.",
            },
          ]
        : []),
      {
        label: "Planning contingency",
        expected: roundPlanning(contingency.expected),
        explanation:
          "Carries uncertainty that normally becomes clear during an on-site inspection.",
      },
    ],
    assumptions: [
      `The quantity is ${quantity.toLocaleString()} ${item.unit.replaceAll("_", " ")}.`,
      `Access is ${input.access || "unknown"}, condition is ${input.condition || "unknown"}, and complexity is ${input.complexity || "unknown"}.`,
      ...(typeof item.assumptions === "object" && item.assumptions?.included
        ? [`Baseline includes ${item.assumptions.included}.`]
        : []),
      "Installed planning baselines include normal labor, material, business overhead and profit.",
    ],
    unknowns: [
      ...(input.access === "unknown" ? ["Exact job-site access"] : []),
      ...(input.condition === "unknown" ? ["Concealed damage and existing condition"] : []),
      ...(input.complexity === "unknown" ? ["Final project complexity"] : []),
      ...(photoMode
        ? ["Measurements and concealed conditions not verifiable from photos"]
        : []),
    ],
    sourceKeys: item.source_keys ?? [],
    calculationInput: {
      ...input,
      quantity,
      unknownCount,
      pricingItemId: item.id,
    },
  };
}

export function formatPlannerCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
