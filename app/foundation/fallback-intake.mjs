const clip = (value, limit = 240) =>
  String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);

const findSource = (text, pattern) => {
  const match = text.match(pattern);
  return match ? clip(match[0], 160) : "";
};

export function deterministicIntake(narrative) {
  const text = clip(narrative, 4000);
  const lower = text.toLowerCase();
  const facts = [];

  const projectType = /\breplace|replacement|new roof|reroof\b/.test(lower)
    ? "replacement"
    : /\brepair|patch|fix\b/.test(lower)
      ? "repair"
      : /\binspect|inspection|evaluate\b/.test(lower)
        ? "inspection"
        : "unknown";

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
  }

  const pitchSource = findSource(text, /\b\d{1,2}\s*[:/]\s*12\b/i);
  if (pitchSource) {
    facts.push({
      field: "reported_pitch",
      value: pitchSource.replace(/\s+/g, ""),
      source_text: pitchSource,
    });
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
  }

  const material = ["architectural shingle", "asphalt", "metal", "tile"].find(
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
  }

  const missing = [];
  if (!areaSource) missing.push("roof footprint or measured roof area");
  if (!pitchSource) missing.push("roof pitch");
  if (!storySource) missing.push("number of stories");
  if (!layerSource) missing.push("number of existing roof layers");
  if (!material) missing.push("existing roof material");
  if (urgency === "unknown") missing.push("whether an active leak exists");

  return {
    summary:
      text.length > 0
        ? `HUM recognized a ${projectType === "unknown" ? "roofing" : projectType} project description and preserved only facts that were stated directly.`
        : "No project description was provided.",
    project_type: projectType,
    urgency,
    facts,
    interpretations: [
      {
        label: "Fallback mode",
        explanation:
          "The live AI interpreter was unavailable, so HUM used deterministic keyword and pattern checks. Review every field before estimating.",
        confidence: "high",
      },
    ],
    missing_information: missing,
    follow_up_questions: missing.slice(0, 6).map((item) => `What is the ${item}?`),
    can_estimate: Boolean(areaSource && projectType !== "unknown"),
  };
}
