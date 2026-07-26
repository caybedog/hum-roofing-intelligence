const REQUIRED_CODES = [
  "shingle_material",
  "underlayment",
  "accessories",
  "fasteners_misc",
  "labor_hours_install",
  "labor_hour_rate",
  "tearoff_per_layer",
  "disposal_per_layer",
  "permit_allowance",
  "delivery_allowance",
  "decking_sheet",
  "flashing_allowance",
  "waste_factor",
  "pitch_adjustment",
  "story_adjustment",
  "access_adjustment",
  "complexity_adjustment",
  "overhead_rate",
  "contingency_rate",
  "target_margin",
  "geographic_adjustment",
];

const PITCH_AREA_FACTORS = {
  low: 1.03,
  moderate: 1.12,
  steep: 1.27,
};

const round = (value, places = 0) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function itemMap(items) {
  const map = new Map(items.map((item) => [item.code, item]));
  const missing = REQUIRED_CODES.filter((code) => !map.has(code));
  if (missing.length) {
    throw new Error(`Pricing version is missing: ${missing.join(", ")}`);
  }
  return map;
}

function price(map, code, scenario) {
  const row = map.get(code);
  const key = `${scenario}_value`;
  return number(row[key]);
}

function fieldConfirmed(project, field) {
  if (!project.homeowner_facts) return true;
  const confirmed = project.homeowner_facts.confirmed_fields ?? {};
  const deferred = new Set(project.homeowner_facts.deferred_fields ?? []);
  return Boolean(confirmed[field]) && !deferred.has(field);
}

function resolvedConditions(project, scenarioName, roofAreaSqft) {
  const pitch = fieldConfirmed(project, "roof_pitch")
    ? project.roof_pitch
    : scenarioName === "low"
      ? "low"
      : scenarioName === "high"
        ? "steep"
        : "moderate";
  const existingLayers = fieldConfirmed(project, "existing_layers")
    ? number(project.existing_layers, 1)
    : scenarioName === "high"
      ? Math.max(2, number(project.existing_layers, 1))
      : 1;
  const accessLevel = fieldConfirmed(project, "access_level")
    ? project.access_level
    : scenarioName === "low"
      ? "easy"
      : scenarioName === "high"
        ? "difficult"
        : "standard";
  const complexity = fieldConfirmed(project, "complexity")
    ? project.complexity
    : scenarioName === "low"
      ? "simple"
      : scenarioName === "high"
        ? "complex"
        : "standard";
  const contractorDeckingQuantity =
    project.homeowner_facts?.decking_allowance_method ===
    "contractor_quantity";
  const deckingSheets = contractorDeckingQuantity
    ? number(project.decking_allowance_sheets)
    : scenarioName === "low"
      ? 0
      : scenarioName === "high"
        ? Math.max(
            8,
            Math.ceil((roofAreaSqft * 0.2) / 32),
          )
        : Math.max(4, number(project.decking_allowance_sheets, 4));

  return {
    pitch,
    existingLayers,
    accessLevel,
    complexity,
    deckingSheets,
    contractorDeckingQuantity,
  };
}

function projectMissingInformation(project) {
  const missing = [];
  const confirmed = project.homeowner_facts?.confirmed_fields ?? {};
  const deferred = new Set(project.homeowner_facts?.deferred_fields ?? []);
  if (!project.footprint_sqft) {
    missing.push("Roof footprint or measured roof area");
  }
  if (!project.postal_code) {
    missing.push("Project ZIP code");
  }
  if (project.roof_material === "unknown") {
    missing.push("Existing and preferred roof material");
  }
  if (project.project_type === "unknown") {
    missing.push("Whether the project is repair, replacement, or inspection");
  }
  if (!confirmed.roof_pitch || deferred.has("roof_pitch")) {
    missing.push("On-site confirmation of roof pitch");
  }
  if (!confirmed.existing_layers || deferred.has("existing_layers")) {
    missing.push("On-site confirmation of existing roof layers");
  }
  if (!confirmed.access_level || deferred.has("access_level")) {
    missing.push("Contractor confirmation of staging and property access");
  }
  if (!confirmed.complexity || deferred.has("complexity")) {
    missing.push("Contractor confirmation of roof shape and complexity");
  }
  if (project.homeowner_facts?.decking_allowance_method !== "contractor_quantity") {
    missing.push(
      "Damaged decking is concealed; HUM carries a range instead of requiring a homeowner guess",
    );
  }
  if (project.chimney_count === 0 && project.skylight_count === 0) {
    missing.push("Confirmation of roof penetrations and flashing details");
  }
  if (!project.homeowner_notes?.trim()) {
    missing.push("Homeowner description of symptoms, age, and known damage");
  }
  return missing;
}

function scenario(project, map, scenarioName) {
  const footprint = number(project.footprint_sqft);
  const initialPitch = fieldConfirmed(project, "roof_pitch")
    ? project.roof_pitch
    : scenarioName === "low"
      ? "low"
      : scenarioName === "high"
        ? "steep"
        : "moderate";
  const pitchFactor = PITCH_AREA_FACTORS[initialPitch] ?? 1.12;
  const wasteFactor = price(map, "waste_factor", scenarioName);
  const roofAreaSqft = footprint * pitchFactor;
  const conditions = resolvedConditions(project, scenarioName, roofAreaSqft);
  const roofingSquares = (roofAreaSqft * (1 + wasteFactor)) / 100;

  const materialPerSquare =
    price(map, "shingle_material", scenarioName) +
    price(map, "underlayment", scenarioName) +
    price(map, "accessories", scenarioName) +
    price(map, "fasteners_misc", scenarioName);

  const pitchAdjustment =
    conditions.pitch === "steep"
      ? price(map, "pitch_adjustment", scenarioName)
      : conditions.pitch === "moderate"
        ? price(map, "pitch_adjustment", scenarioName) * 0.35
        : 0;
  const storyAdjustment =
    Math.max(0, number(project.stories, 1) - 1) *
    price(map, "story_adjustment", scenarioName);
  const accessAdjustment =
    conditions.accessLevel === "difficult"
      ? price(map, "access_adjustment", scenarioName)
      : conditions.accessLevel === "easy"
        ? -0.025
        : 0;
  const complexityAdjustment =
    conditions.complexity === "complex"
      ? price(map, "complexity_adjustment", scenarioName)
      : conditions.complexity === "simple"
        ? -0.03
        : 0;
  const laborMultiplier = Math.max(
    0.8,
    1 +
      pitchAdjustment +
      storyAdjustment +
      accessAdjustment +
      complexityAdjustment,
  );

  const materialCost = roofingSquares * materialPerSquare;
  const laborHours =
    roofingSquares *
    price(map, "labor_hours_install", scenarioName) *
    laborMultiplier;
  const laborCost =
    laborHours * price(map, "labor_hour_rate", scenarioName);
  const tearOffCost =
    roofingSquares *
    conditions.existingLayers *
    price(map, "tearoff_per_layer", scenarioName) *
    laborMultiplier;
  const disposalCost =
    roofingSquares *
    conditions.existingLayers *
    price(map, "disposal_per_layer", scenarioName);
  const deckingAllowance =
    conditions.deckingSheets *
    price(map, "decking_sheet", scenarioName);
  const penetrationCount =
    number(project.chimney_count) + number(project.skylight_count);
  const flashingAllowance =
    price(map, "flashing_allowance", scenarioName) *
    (1 + Math.max(0, penetrationCount - 1) * 0.25);
  const permitAllowance = price(map, "permit_allowance", scenarioName);
  const deliveryAllowance = price(map, "delivery_allowance", scenarioName);
  const directBeforeGeography =
    materialCost +
    laborCost +
    tearOffCost +
    disposalCost +
    deckingAllowance +
    flashingAllowance +
    permitAllowance +
    deliveryAllowance;
  const directCost =
    directBeforeGeography *
    price(map, "geographic_adjustment", scenarioName);
  const overhead =
    directCost * price(map, "overhead_rate", scenarioName);
  const contingency =
    (directCost + overhead) *
    price(map, "contingency_rate", scenarioName);
  const costBasis = directCost + overhead + contingency;
  const targetMargin = Math.min(
    0.75,
    price(map, "target_margin", scenarioName),
  );
  const planningPrice = costBasis / (1 - targetMargin);

  return {
    scenario: scenarioName,
    roofAreaSqft: round(roofAreaSqft),
    roofingSquares: round(roofingSquares, 2),
    materialCost: round(materialCost),
    laborHours: round(laborHours, 1),
    laborCost: round(laborCost),
    tearOffCost: round(tearOffCost),
    disposalCost: round(disposalCost),
    deckingAllowance: round(deckingAllowance),
    flashingAllowance: round(flashingAllowance),
    permitAllowance: round(permitAllowance),
    deliveryAllowance: round(deliveryAllowance),
    directCost: round(directCost),
    overhead: round(overhead),
    contingency: round(contingency),
    costBasis: round(costBasis),
    targetMargin: round(targetMargin, 4),
    planningPrice: round(planningPrice),
    assumptions: {
      roofPitch: conditions.pitch,
      existingLayers: conditions.existingLayers,
      accessLevel: conditions.accessLevel,
      complexity: conditions.complexity,
      deckingSheets: conditions.deckingSheets,
    },
  };
}

export function calculateEstimate(project, pricingVersion, pricingItems) {
  if (!project?.id || !pricingVersion?.id) {
    throw new Error("A project and pricing version are required.");
  }
  if (!number(project.footprint_sqft)) {
    throw new Error("A roof footprint is required before estimating.");
  }
  if (["metal", "tile"].includes(project.roof_material)) {
    throw new Error(
      "The current source-backed catalog supports asphalt roofing. Metal and tile pricing remain locked until their own regional data versions are approved.",
    );
  }

  const map = itemMap(pricingItems);
  const low = scenario(project, map, "low");
  const expected = scenario(project, map, "expected");
  const high = scenario(project, map, "high");
  const missingInformation = projectMissingInformation(project);

  let confidenceScore = 92;
  confidenceScore -= missingInformation.length * 6;
  const lowConfidenceInputs = pricingItems.filter(
    (item) => item.confidence === "low",
  ).length;
  confidenceScore -= Math.min(12, Math.round(lowConfidenceInputs / 2));
  if (project.ai_source === "deterministic_fallback") confidenceScore -= 5;
  if (project.complexity === "complex") confidenceScore -= 4;
  if (project.active_leak) confidenceScore -= 3;
  confidenceScore = Math.max(35, Math.min(95, confidenceScore));

  const majorCostDrivers = [
    `${expected.roofingSquares} estimated roofing squares after pitch and waste`,
    `${expected.assumptions.existingLayers} expected roof layer${expected.assumptions.existingLayers === 1 ? "" : "s"} carried for removal`,
    `${expected.laborHours} expected labor hours after access, pitch, story, and complexity adjustments`,
    `${expected.assumptions.deckingSheets} decking sheets carried in the expected scenario, with ${low.assumptions.deckingSheets} in low and ${high.assumptions.deckingSheets} in high because the deck is concealed`,
    `${Math.round(expected.targetMargin * 100)}% target gross-margin scenario from the approved pricing version`,
  ];

  if (project.active_leak) {
    majorCostDrivers.push(
      "Active leak reported; hidden moisture damage remains an on-site unknown",
    );
  }

  const confidenceCounts = pricingItems.reduce(
    (counts, item) => {
      counts[item.confidence] += 1;
      return counts;
    },
    { low: 0, medium: 0, high: 0 },
  );
  const verifiedDates = pricingItems
    .map((item) => item.verified_at)
    .filter(Boolean)
    .sort();
  const assumptionNotes = [];
  for (const [field, label] of [
    ["roof_pitch", "Roof slope"],
    ["existing_layers", "Existing layers"],
    ["access_level", "Property access"],
    ["complexity", "Roof shape"],
  ]) {
    if (!fieldConfirmed(project, field)) {
      assumptionNotes.push(
        `${label} is not confirmed, so low, expected, and high scenarios use different safe planning conditions.`,
      );
    }
  }
  if (
    project.homeowner_facts?.decking_allowance_method !==
    "contractor_quantity"
  ) {
    assumptionNotes.push(
      "Decking is not required from the homeowner: HUM carries zero sheets in low, a small reserve in expected, and a 20% planning allowance in high.",
    );
  }

  return {
    projectSummary: `${project.title}: ${project.project_type} planning estimate for a ${project.stories}-story ${project.roof_material.replaceAll("_", " ")} roof in ${project.city}, ${project.county} County.`,
    pricingVersionCode: pricingVersion.version_code,
    pricingEffectiveDate: pricingVersion.effective_date,
    confidenceScore,
    dataStrength: {
      label:
        confidenceCounts.low > confidenceCounts.medium + confidenceCounts.high
          ? "Early local baseline"
          : "Developing local baseline",
      totalInputs: pricingItems.length,
      sourcedInputs: pricingItems.filter((item) => item.source_url).length,
      highConfidenceInputs: confidenceCounts.high,
      mediumConfidenceInputs: confidenceCounts.medium,
      lowConfidenceInputs: confidenceCounts.low,
      newestVerificationDate:
        verifiedDates.at(-1) ?? pricingVersion.effective_date,
      limitation:
        "Retail materials, official disposal, permit requirements, and public scopes are sourced. Humboldt contractor productivity, burden, overhead, and margin remain controlled assumptions until the pilot calibrates them.",
    },
    assumptions: assumptionNotes,
    missingInformation,
    majorCostDrivers,
    questionsForContractor: [
      "Will field measurements change the roofing-square quantity?",
      "How many roof layers and decking sheets are included before a change order?",
      "Which shingle system, underlayment, flashing, ventilation, and accessories are included?",
      "Who obtains the permit, and is the actual fee included?",
      "What written unit prices apply to concealed decking or flashing work?",
      "What workmanship warranty, cleanup process, and start window are included?",
    ],
    scenarios: { low, expected, high },
    audit: [
      {
        label: "Footprint",
        source: "homeowner",
        value: `${number(project.footprint_sqft)} sq ft`,
      },
      {
        label: "Pitch factor",
        source: "calculator",
        value: fieldConfirmed(project, "roof_pitch")
          ? `${project.roof_pitch} (${PITCH_AREA_FACTORS[project.roof_pitch] ?? 1.12}×)`
          : `Unconfirmed: ${low.assumptions.roofPitch}, ${expected.assumptions.roofPitch}, and ${high.assumptions.roofPitch} scenarios`,
      },
      {
        label: "Waste factor",
        source: "pricing",
        value: `${Math.round(price(map, "waste_factor", "expected") * 100)}%`,
      },
      {
        label: "Pricing version",
        source: "pricing",
        value: pricingVersion.version_code,
      },
      {
        label: "Decking quantity",
        source: "calculator",
        value:
          project.homeowner_facts?.decking_allowance_method ===
          "contractor_quantity"
            ? `${project.decking_allowance_sheets} contractor-reported sheets`
            : `${low.assumptions.deckingSheets} low / ${expected.assumptions.deckingSheets} expected / ${high.assumptions.deckingSheets} high; no homeowner guess required`,
      },
      {
        label: "Quote requirement",
        source: "calculator",
        value:
          "No contractor quote or contractor pricing is required to generate this planning range.",
      },
      {
        label: "Calculation rule",
        source: "calculator",
        value:
          "AI interpretations are excluded from all monetary calculations.",
      },
    ],
  };
}

export function pricingCodesRequired() {
  return [...REQUIRED_CODES];
}
