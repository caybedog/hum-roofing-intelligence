const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateQuoteBuilder(input) {
  const roofAreaSqft = asNumber(input.roofAreaSqft);
  const wastePercent = Math.min(asNumber(input.wastePercent), 50);
  const roofingSquares =
    roofAreaSqft > 0
      ? Math.ceil((roofAreaSqft / 100) * (1 + wastePercent / 100) * 10) / 10
      : 0;
  const layers = Math.max(1, asNumber(input.existingLayers));

  const materialAmount = roundMoney(
    roofingSquares * asNumber(input.materialPerSquare),
  );
  const laborAmount = roundMoney(
    asNumber(input.crewSize) *
      asNumber(input.laborDays) *
      asNumber(input.hoursPerDay) *
      asNumber(input.hourlyRate),
  );
  const tearoffDisposalAmount = roundMoney(
    roofingSquares * layers * asNumber(input.tearoffPerSquare) +
      asNumber(input.disposalFee),
  );
  const permitDeliveryAmount = roundMoney(
    asNumber(input.permitFee) + asNumber(input.deliveryFee),
  );
  const allowanceAmount = roundMoney(
    asNumber(input.deckingSheets) * asNumber(input.deckingSheetCost) +
      asNumber(input.allowance),
  );
  const baseOtherAmount = roundMoney(asNumber(input.other));
  const directCost = roundMoney(
    materialAmount +
      laborAmount +
      tearoffDisposalAmount +
      permitDeliveryAmount +
      allowanceAmount +
      baseOtherAmount,
  );
  const overheadAmount = roundMoney(
    directCost * (Math.min(asNumber(input.overheadPercent), 100) / 100),
  );
  const costWithOverhead = directCost + overheadAmount;
  const marginPercent = Math.min(asNumber(input.profitMarginPercent), 80);
  const profitAmount = roundMoney(
    marginPercent > 0
      ? costWithOverhead / (1 - marginPercent / 100) - costWithOverhead
      : 0,
  );
  const otherAmount = roundMoney(
    baseOtherAmount + overheadAmount + profitAmount,
  );

  return {
    roofingSquares,
    materialAmount,
    laborAmount,
    tearoffDisposalAmount,
    permitDeliveryAmount,
    allowanceAmount,
    baseOtherAmount,
    directCost,
    overheadAmount,
    profitAmount,
    otherAmount,
    totalAmount: roundMoney(directCost + overheadAmount + profitAmount),
  };
}

export function buildScopeSummary({
  materialSystem,
  roofingSquares,
  selections,
}) {
  const labels = {
    protect_property: "Protect landscaping, siding, and work areas",
    tear_off: "Remove and dispose of the existing roof system",
    inspect_deck: "Inspect the exposed roof deck and document concealed damage",
    replace_decking: "Replace deteriorated decking using the stated allowance",
    underlayment: "Install code-compliant roof underlayment",
    ice_water: "Install ice-and-water protection at required vulnerable areas",
    flashing: "Install or replace required flashing and pipe boots",
    ventilation: "Complete the stated roof ventilation work",
    roofing: `Install ${String(materialSystem || "selected roofing").replaceAll("_", " ")}`,
    cleanup: "Complete magnetic nail sweep, cleanup, and debris haul-off",
    warranty: "Provide the stated workmanship and manufacturer warranty documents",
  };
  const selected = Array.isArray(selections) ? selections : [];
  const scopeLines = selected.map((key) => labels[key]).filter(Boolean);
  const quantity =
    asNumber(roofingSquares) > 0
      ? `Approximately ${asNumber(roofingSquares).toFixed(1)} roofing squares.`
      : "";
  return [quantity, ...scopeLines].filter(Boolean).join("\n");
}
