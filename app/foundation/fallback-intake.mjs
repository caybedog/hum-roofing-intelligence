const clip = (value, limit = 240) =>
  String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);

const findSource = (text, pattern) => {
  const match = text.match(pattern);
  return match ? clip(match[0], 160) : "";
};

const numberWords = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

const intakePriorities = [
  ["project_type", "Are you looking for a repair, a full replacement, or are you not sure yet?", "This sets the basic scope.", ["Repair", "Full replacement", "I’m not sure"]],
  ["active_leak", "Is water getting inside the home right now or after rain?", "An active leak changes urgency and lowers estimate confidence.", ["Yes, it is leaking", "No active leak", "I’m not sure"]],
  ["footprint_sqft", "About how many square feet is the part of the home covered by this roof?", "HUM uses the ground-floor footprint to estimate roof area.", ["Use a real-estate listing", "Length × width of the home", "I’m not sure"]],
  ["roof_material", "What is currently on the roof: shingles, metal, tile, or something else?", "Material affects removal and replacement scope.", ["Asphalt shingles", "Metal", "Tile / other"]],
  ["stories", "How many stories are directly below this roof?", "Height affects access, setup, and labor.", ["One story", "Two stories", "Three or more"]],
  ["roof_pitch", "From the ground, does the roof look low, normally sloped, or very steep?", "Slope changes roof area and working difficulty.", ["Low / nearly flat", "Normal slope", "Very steep"]],
  ["existing_layers", "Do you know whether there is one roof layer or more than one?", "Each existing layer adds removal and disposal work.", ["One layer", "Two or more", "I’m not sure"]],
  ["complexity", "Is the roof mostly two simple slopes, or does it have several peaks, valleys, or dormers?", "More roof sections usually add cutting, flashing, and labor.", ["Mostly simple", "Several sections", "I’m not sure"]],
  ["access_level", "Can a contractor park and stage materials close to the house?", "Long carries, tight gates, and limited staging can add labor.", ["Easy access", "Some limitations", "Difficult access"]],
];

function firstNumber(value) {
  const match = String(value).match(/\d[\d,]*(?:\.\d+)?/);
  const numeric = match ? Number(match[0].replaceAll(",", "")) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function storyValue(source) {
  const word = source.toLowerCase().match(/\b(one|two|three|four)\b/)?.[1];
  return word ? numberWords[word] : firstNumber(source);
}

function nextQuestion(known, deferred) {
  const next = intakePriorities.find(
    ([field]) => !known.has(field) && !deferred.has(field),
  );
  if (!next) {
    return {
      field: "complete",
      question: "You have enough information for a first planning estimate. Review the filled fields before generating it.",
      why_it_matters: "Your review keeps assumptions separate from facts.",
      answer_help: [],
    };
  }
  return {
    field: next[0],
    question: next[1],
    why_it_matters: next[2],
    answer_help: next[3],
  };
}

export function deterministicIntake(narrative, context = {}) {
  const text = clip(narrative, 4000);
  const lower = text.toLowerCase();
  const facts = [];
  const confirmedUpdates = [];
  const known = new Set(context.confirmed_fields ?? []);
  const deferred = new Set(context.deferred_fields ?? []);

  const projectType = /\breplace|replacement|new roof|reroof\b/.test(lower)
    ? "replacement"
    : /\brepair|patch|fix\b/.test(lower)
      ? "repair"
      : /\binspect|inspection|evaluate\b/.test(lower)
        ? "inspection"
        : "unknown";
  if (projectType !== "unknown") {
    const source = findSource(
      text,
      /\b(?:replace(?:ment)?|new roof|reroof|repair|patch|fix|inspect(?:ion)?|evaluate)\b/i,
    );
    confirmedUpdates.push({
      field: "project_type",
      value: projectType,
      source_text: source,
    });
    known.add("project_type");
  }

  const urgency = /\b(no leak|not leaking|no active leak)\b/.test(lower)
    ? "no_active_leak"
    : /\b(active leak|leaking now|currently leaking|water coming|dripping)\b/.test(
          lower,
        )
      ? "active_leak"
      : /\b(damage|missing shingles|wind damage|soft spot|rotted|rot)\b/.test(
          lower,
        )
        ? "damage"
        : "unknown";
  if (urgency === "active_leak" || urgency === "no_active_leak") {
    const source = findSource(
      text,
      /\b(?:no leak|not leaking|no active leak|active leak|leaking now|currently leaking|water coming|dripping)\b/i,
    );
    confirmedUpdates.push({
      field: "active_leak",
      value: urgency === "active_leak" ? "true" : "false",
      source_text: source,
    });
    known.add("active_leak");
  }

  const areaSource = findSource(
    text,
    /\b(?:\d{1,2},\d{3}|\d{3,5})\s*(?:sq\.?\s*ft\.?|square feet)\b/i,
  );
  if (areaSource) {
    facts.push({
      field: "reported_area",
      value: areaSource.replace(/[^\d]/g, ""),
      source_text: areaSource,
    });
    confirmedUpdates.push({
      field: "footprint_sqft",
      value: String(firstNumber(areaSource) ?? ""),
      source_text: areaSource,
    });
    known.add("footprint_sqft");
  }

  const pitchSource = findSource(text, /\b\d{1,2}\s*[:/]\s*12\b/i);
  if (pitchSource) {
    const rise = firstNumber(pitchSource) ?? 0;
    const pitch = rise < 4 ? "low" : rise <= 7 ? "moderate" : "steep";
    facts.push({
      field: "reported_pitch",
      value: pitchSource.replace(/\s+/g, ""),
      source_text: pitchSource,
    });
    confirmedUpdates.push({
      field: "roof_pitch",
      value: pitch,
      source_text: pitchSource,
    });
    known.add("roof_pitch");
  }

  const storySource = findSource(
    text,
    /\b(?:one|two|three|four|1|2|3|4)[ -]?stor(?:y|ies)\b/i,
  );
  if (storySource) {
    facts.push({
      field: "reported_stories",
      value: storySource,
      source_text: storySource,
    });
    confirmedUpdates.push({
      field: "stories",
      value: String(storyValue(storySource) ?? ""),
      source_text: storySource,
    });
    known.add("stories");
  }

  const layerSource = findSource(
    text,
    /\b(?:one|two|three|four|1|2|3|4)\s+(?:roof\s+)?layers?\b/i,
  );
  if (layerSource) {
    facts.push({
      field: "reported_layers",
      value: layerSource,
      source_text: layerSource,
    });
    confirmedUpdates.push({
      field: "existing_layers",
      value: String(storyValue(layerSource) ?? ""),
      source_text: layerSource,
    });
    known.add("existing_layers");
  }

  const material = ["architectural shingle", "three-tab", "asphalt", "metal", "tile"].find(
    (value) => lower.includes(value),
  );
  if (material) {
    facts.push({
      field: "reported_material",
      value: material,
      source_text: findSource(
        text,
        new RegExp(`\\b${material.replace(" ", "\\s+")}\\b`, "i"),
      ),
    });
    const normalizedMaterial =
      material === "metal"
        ? "metal"
        : material === "tile"
          ? "tile"
          : material === "three-tab"
            ? "three_tab"
            : "architectural_shingle";
    confirmedUpdates.push({
      field: "roof_material",
      value: normalizedMaterial,
      source_text: facts.at(-1)?.source_text ?? material,
    });
    known.add("roof_material");
  }

  if (
    context.current_question &&
    /\b(?:i\s+do(?:n't| not)\s+know|not sure|unsure|no idea)\b/i.test(lower)
  ) {
    deferred.add(context.current_question);
  }

  const next = nextQuestion(known, deferred);
  const missingLabels = {
    project_type: "project type",
    active_leak: "whether an active leak exists",
    footprint_sqft: "roof footprint or measured roof area",
    roof_material: "existing roof material",
    stories: "number of stories",
    roof_pitch: "roof pitch",
    existing_layers: "number of existing roof layers",
    complexity: "roof shape and complexity",
    access_level: "property access",
  };
  const missing = intakePriorities
    .filter(([field]) => !known.has(field))
    .map(([field]) => missingLabels[field]);

  return {
    summary:
      text.length > 0
        ? `HUM recognized a ${projectType === "unknown" ? "roofing" : projectType} project description and preserved only facts that were stated directly.`
        : "No project description was provided.",
    assistant_message:
      confirmedUpdates.length > 0
        ? `I filled ${confirmedUpdates.length} project ${confirmedUpdates.length === 1 ? "field" : "fields"} from what you said. I will keep asking one short question at a time.`
        : "I saved your answer. If you are unsure about something, say so and HUM will keep it as an assumption for review.",
    project_type: projectType,
    urgency,
    facts,
    confirmed_updates: confirmedUpdates,
    deferred_fields: [...deferred],
    next_question: next,
    interpretations: [
      {
        label: "Fallback mode",
        explanation:
          "The live AI interpreter was unavailable, so HUM used deterministic keyword and pattern checks. Review every field before estimating.",
        confidence: "high",
      },
    ],
    missing_information: missing,
    follow_up_questions:
      next.field === "complete" ? [] : [next.question],
    can_estimate:
      known.has("footprint_sqft") && known.has("project_type"),
  };
}
