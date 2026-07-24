export type HumRole = "homeowner" | "contractor" | "administrator";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: HumRole;
  service_area: string | null;
  deactivated_at: string | null;
};

export type Project = {
  id: string;
  homeowner_id: string;
  title: string;
  status: "draft" | "ready_for_estimate" | "estimated" | "archived";
  intake_step: number;
  city: string;
  county: string;
  postal_code: string | null;
  project_type: "repair" | "replacement" | "inspection" | "unknown";
  footprint_sqft: number | null;
  roof_pitch: "low" | "moderate" | "steep";
  stories: number;
  existing_layers: number;
  roof_material:
    | "architectural_shingle"
    | "three_tab"
    | "metal"
    | "tile"
    | "unknown";
  access_level: "easy" | "standard" | "difficult";
  complexity: "simple" | "standard" | "complex";
  active_leak: boolean;
  chimney_count: number;
  skylight_count: number;
  decking_allowance_sheets: number;
  homeowner_notes: string;
  homeowner_facts: Record<string, unknown>;
  ai_interpretation: AiInterpretation | null;
  ai_source: "openai" | "deterministic_fallback" | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingVersion = {
  id: string;
  version_code: string;
  region: string;
  category: string;
  status: "proposed" | "approved" | "retired";
  effective_date: string;
  source_summary: string;
  confidence: "low" | "medium" | "high";
  change_summary: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingItem = {
  id: string;
  pricing_version_id: string;
  code: string;
  category: string;
  label: string;
  unit: string;
  low_value: number;
  expected_value: number;
  high_value: number;
  source_name: string;
  source_url: string | null;
  verified_at: string;
  confidence: "low" | "medium" | "high";
  change_note: string;
};

export type EstimateScenario = {
  scenario: "low" | "expected" | "high";
  roofAreaSqft: number;
  roofingSquares: number;
  materialCost: number;
  laborHours: number;
  laborCost: number;
  tearOffCost: number;
  disposalCost: number;
  deckingAllowance: number;
  flashingAllowance: number;
  permitAllowance: number;
  deliveryAllowance: number;
  directCost: number;
  overhead: number;
  contingency: number;
  costBasis: number;
  targetMargin: number;
  planningPrice: number;
};

export type EstimateResult = {
  projectSummary: string;
  pricingVersionCode: string;
  pricingEffectiveDate: string;
  confidenceScore: number;
  missingInformation: string[];
  majorCostDrivers: string[];
  questionsForContractor: string[];
  scenarios: {
    low: EstimateScenario;
    expected: EstimateScenario;
    high: EstimateScenario;
  };
  audit: Array<{
    label: string;
    source: "homeowner" | "calculator" | "pricing";
    value: string;
  }>;
};

export type EstimateRecord = {
  id: string;
  project_id: string;
  version_number: number;
  pricing_version_id: string;
  homeowner_inputs: Record<string, unknown>;
  ai_interpretation: AiInterpretation | null;
  calculation_inputs: Record<string, unknown>;
  calculation_result: EstimateResult;
  confidence_score: number;
  missing_information: string[];
  created_at: string;
};

export type AiFact = {
  field: string;
  value: string;
  source_text: string;
};

export type AiInterpretation = {
  summary: string;
  project_type: "repair" | "replacement" | "inspection" | "unknown";
  urgency: "active_leak" | "damage" | "no_active_leak" | "unknown";
  facts: AiFact[];
  interpretations: Array<{
    label: string;
    explanation: string;
    confidence: "low" | "medium" | "high";
  }>;
  missing_information: string[];
  follow_up_questions: string[];
  can_estimate: boolean;
};

export type ProjectPhoto = {
  id: string;
  project_id: string;
  owner_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  ai_observation: Record<string, unknown> | null;
  created_at: string;
  signedUrl?: string;
};

export type ProjectShare = {
  id: string;
  project_id: string;
  contractor_id: string;
  shared_by: string;
  granted_at: string;
  revoked_at: string | null;
};

export type ContractorReview = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  contractor_id: string;
  status: "draft" | "submitted";
  measurement_corrections: Record<string, unknown>;
  scope_corrections: string[];
  pricing_observations: Array<Record<string, unknown>>;
  notes: string;
  submitted_at: string | null;
  updated_at: string;
};

export type PricingObservation = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  observed_by: string;
  pricing_code: string;
  observed_value: number;
  source_note: string;
  status: "proposed" | "reviewed" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PilotEnrollment = {
  id: string;
  project_id: string;
  homeowner_id: string;
  status:
    | "preparing"
    | "contractor_review"
    | "quote_received"
    | "comparison_ready"
    | "closed"
    | "withdrawn";
  homeowner_consent: boolean;
  consented_at: string | null;
  intake_started_at: string | null;
  intake_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PilotContractorProfile = {
  contractor_id: string;
  company_name: string;
  license_number: string | null;
  service_area: string;
  status: "pending" | "approved" | "paused";
  onboarding_notes: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PilotInvitation = {
  id: string;
  project_id: string;
  created_by: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type ContractorQuote = {
  id: string;
  project_id: string;
  estimate_id: string;
  contractor_id: string;
  status: "draft" | "submitted" | "withdrawn";
  material_amount: number;
  labor_amount: number;
  tearoff_disposal_amount: number;
  permit_delivery_amount: number;
  allowance_amount: number;
  other_amount: number;
  total_amount: number;
  scope_summary: string;
  exclusions: string;
  quote_reference: string | null;
  valid_until: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteDifferenceReason = {
  id: string;
  quote_id: string;
  project_id: string;
  contractor_id: string;
  reason_code:
    | "material_price"
    | "labor_rate"
    | "scope_added"
    | "scope_removed"
    | "measurement"
    | "access"
    | "permit"
    | "disposal"
    | "warranty"
    | "market_conditions"
    | "allowance"
    | "other";
  direction: "higher" | "lower" | "neutral";
  amount_effect: number | null;
  explanation: string;
  created_at: string;
  updated_at: string;
};

export type PilotFeedback = {
  id: string;
  project_id: string;
  submitted_by: string;
  audience: "homeowner" | "contractor";
  understanding_rating: number | null;
  usefulness_rating: number | null;
  completion_ease_rating: number | null;
  feedback_text: string;
  created_at: string;
  updated_at: string;
};

export type PilotOutcome = {
  id: string;
  project_id: string;
  recorded_by: string;
  accepted_quote_id: string | null;
  final_contract_amount: number | null;
  change_order_total: number;
  outcome_status:
    | "undecided"
    | "contractor_selected"
    | "contract_signed_elsewhere"
    | "project_paused"
    | "project_cancelled";
  notes: string;
  recorded_at: string;
  updated_at: string;
};

export type PilotSupportIssue = {
  id: string;
  project_id: string | null;
  reported_by: string;
  category:
    | "privacy"
    | "authorization"
    | "estimate"
    | "photos"
    | "quote"
    | "intake"
    | "usability"
    | "other";
  severity: "low" | "normal" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "closed";
  description: string;
  resolution: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PilotEvent = {
  id: string;
  project_id: string | null;
  actor_id: string;
  event_name:
    | "pilot_enrolled"
    | "intake_completed"
    | "estimate_generated"
    | "brief_printed"
    | "invitation_created"
    | "invitation_accepted"
    | "contractor_review_submitted"
    | "quote_submitted"
    | "comparison_viewed"
    | "feedback_submitted"
    | "outcome_recorded";
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
