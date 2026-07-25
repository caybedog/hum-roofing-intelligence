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
    missing.push("Actual damaged decking quantity after tear-off");
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
  const pitchFactor = PITCH_AREA_FACTORS[project.roof_pitch] ?? 1.12;
  const wasteFactor = price(map, "waste_factor", scenarioName);
  const roofAreaSqft = footprint * pitchFactor;
  const roofingSquares = (roofAreaSqft * (1 + wasteFactor)) / 100;

  const materialPerSquare =
    price(map, "shingle_material", scenarioName) +
    price(map, "underlayment", scenarioName) +
    price(map, "accessories", scenarioName) +
    price(map, "fasteners_misc", scenarioName);

  const pitchAdjustment =
    project.roof_pitch === "steep"
      ? price(map, "pitch_adjustment", scenarioName)
      : project.roof_pitch === "moderate"
        ? price(map, "pitch_adjustment", scenarioName) * 0.35
        : 0;
  const storyAdjustment =
    Math.max(0, number(project.stories, 1) - 1) *
    price(map, "story_adjustment", scenarioName);
  const accessAdjustment =
    project.access_level === "difficult"
      ? price(map, "access_adjustment", scenarioName)
      : project.access_level === "easy"
        ? -0.025
        : 0;
  const complexityAdjustment =
    project.complexity === "complex"
      ? price(map, "complexity_adjustment", scenarioName)
      : project.complexity === "simple"
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
    number(project.existing_layers, 1) *
    price(map, "tearoff_per_layer", scenarioName) *
    laborMultiplier;
  const disposalCost =
    roofingSquares *
    number(project.existing_layers, 1) *
    price(map, "disposal_per_layer", scenarioName);
  const deckingAllowance =
    number(project.decking_allowance_sheets) *
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
  };
}

export function calculateEstimate(project, pricingVersion, pricingItems) {
  if (!project?.id || !pricingVersion?.id) {
    throw new Error("A project and pricing version are required.");
  }
  if (!number(project.footprint_sqft)) {
    throw new Error("A roof footprint is required before estimating.");
  }

  const map = itemMap(pricingItems);
  const low = scenario(project, map, "low");
  const expected = scenario(project, map, "expected");
  const high = scenario(project, map, "high");
  const missingInformation = projectMissingInformation(project);

  let confidenceScore = 92;
  confidenceScore -= missingInformation.length * 6;
  if (project.ai_source === "deterministic_fallback") confidenceScore -= 5;
  if (project.complexity === "complex") confidenceScore -= 4;
  if (project.active_leak) confidenceScore -= 3;
  confidenceScore = Math.max(35, Math.min(95, confidenceScore));

  const majorCostDrivers = [
    `${expected.roofingSquares} estimated roofing squares after pitch and waste`,
    `${project.existing_layers} existing roof layer${project.existing_layers === 1 ? "" : "s"} carried for removal`,
    `${expected.laborHours} expected labor hours after access, pitch, story, and complexity adjustments`,
    `${project.decking_allowance_sheets} decking sheets carried as a temporary allowance, not a hidden-damage finding`,
    `${Math.round(expected.targetMargin * 100)}% target gross-margin scenario from the approved pricing version`,
  ];

  if (project.active_leak) {
    majorCostDrivers.push(
      "Active leak reported; hidden moisture damage remains an on-site unknown",
    );
  }

  return {
    projectSummary: `${project.title}: ${project.project_type} planning estimate for a ${project.stories}-story ${project.roof_material.replaceAll("_", " ")} roof in ${project.city}, ${project.county} County.`,
    pricingVersionCode: pricingVersion.version_code,
    pricingEffectiveDate: pricingVersion.effective_date,
    confidenceScore,
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
        value: `${project.roof_pitch} (${PITCH_AREA_FACTORS[project.roof_pitch] ?? 1.12}×)`,
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
            : `${project.decking_allowance_sheets} temporary allowance sheets`,
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
