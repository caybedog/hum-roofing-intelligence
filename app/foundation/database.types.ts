import type {
  AiInterpretation,
  ContractorReview,
  EstimateRecord,
  HumRole,
  PricingItem,
  PricingVersion,
  PricingSource,
  ContractorMarketRecord,
  PublicProjectEvidence,
  Profile,
  Project,
  ProjectPhoto,
  ProjectShare,
  PilotEnrollment,
  PilotContractorProfile,
  PilotInvitation,
  ContractorQuote,
  QuoteDifferenceReason,
  PilotFeedback,
  PilotOutcome,
  PilotSupportIssue,
  PilotEvent,
  PilotSettings,
  QaRun,
} from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type PricingObservationRow = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  observed_by: string;
  pricing_code: string;
  observed_value: number;
  source_note: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AiRequestRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  status: string;
  model: string;
  input_chars: number;
  latency_ms: number | null;
  provider_request_id: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
};

type AuditEventRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProjectRow = Omit<Project, "ai_interpretation"> & {
  ai_interpretation: AiInterpretation | null;
};

type ProjectPhotoRow = Omit<ProjectPhoto, "signedUrl">;

type PlannerPricingCatalogRow = {
  id: string;
  version_code: string;
  region: string;
  status: "proposed" | "approved" | "retired";
  effective_date: string;
  verified_at: string;
  summary: string;
  limitation_note: string;
  created_at: string;
  approved_at: string | null;
};

type PlannerPricingItemRow = {
  id: string;
  catalog_id: string;
  category: string;
  variant: string;
  label: string;
  unit: "square_foot" | "linear_foot" | "each" | "room" | "labor_hour";
  low_unit_cost: number;
  expected_unit_cost: number;
  high_unit_cost: number;
  minimum_job: number;
  permit_low: number;
  permit_expected: number;
  permit_high: number;
  confidence: "low" | "medium" | "high";
  source_keys: string[];
  assumptions: Json;
  created_at: string;
};

type PlannerProjectRow = {
  id: string;
  owner_id: string;
  mode: "photo" | "guided";
  status: "draft" | "estimated" | "completed" | "archived";
  category: string;
  variant: string;
  title: string;
  description: string;
  postal_code: string;
  facts: Json;
  ai_summary: string;
  confidence: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
};

type PlannerEstimateRow = {
  id: string;
  project_id: string;
  owner_id: string;
  pricing_catalog_id: string;
  low_total: number;
  expected_total: number;
  high_total: number;
  line_items: Json;
  assumptions: Json;
  unknowns: Json;
  calculation_input: Json;
  confidence: "low" | "medium" | "high";
  created_at: string;
};

type PlannerUploadRow = {
  id: string;
  project_id: string;
  owner_id: string;
  kind: "project_photo" | "actual_quote";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
};

type PlannerCalibrationRow = {
  id: string;
  project_id: string;
  estimate_id: string;
  upload_id: string | null;
  owner_id: string;
  consent_to_anonymous_calibration: boolean;
  project_completed: boolean;
  actual_quote_total: number | null;
  actual_final_total: number | null;
  normalized_scope: Json;
  homeowner_notes: string;
  review_status: "pending" | "accepted" | "excluded";
  created_at: string;
  reviewed_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      ai_requests: Table<AiRequestRow>;
      audit_events: Table<AuditEventRow>;
      contractor_reviews: Table<ContractorReview & { created_at: string }>;
      estimates: Table<EstimateRecord & { created_by: string }>;
      pricing_items: Table<PricingItem & {
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      pricing_sources: Table<PricingSource>;
      pricing_item_sources: Table<{
        id: string;
        pricing_item_id: string;
        pricing_source_id: string;
        evidence_role: "primary" | "supporting" | "assumption";
        evidence_note: string;
        created_at: string;
      }>;
      contractor_market_records: Table<ContractorMarketRecord>;
      public_project_evidence: Table<PublicProjectEvidence>;
      pricing_observations: Table<PricingObservationRow>;
      pricing_versions: Table<PricingVersion>;
      profiles: Table<Profile & {
        created_at: string;
        updated_at: string;
      }>;
      pilot_enrollments: Table<PilotEnrollment>;
      pilot_contractor_profiles: Table<PilotContractorProfile>;
      pilot_invitations: Table<PilotInvitation & { token_digest: string }>;
      contractor_quotes: Table<ContractorQuote>;
      quote_difference_reasons: Table<QuoteDifferenceReason>;
      pilot_feedback: Table<PilotFeedback>;
      pilot_outcomes: Table<PilotOutcome>;
      pilot_support_issues: Table<PilotSupportIssue>;
      pilot_events: Table<PilotEvent>;
      pilot_settings: Table<PilotSettings>;
      qa_runs: Table<QaRun>;
      project_photos: Table<ProjectPhotoRow>;
      project_shares: Table<ProjectShare>;
      projects: Table<ProjectRow>;
      planner_pricing_catalogs: Table<PlannerPricingCatalogRow>;
      planner_pricing_items: Table<PlannerPricingItemRow>;
      planner_projects: Table<PlannerProjectRow>;
      planner_estimates: Table<PlannerEstimateRow>;
      planner_uploads: Table<PlannerUploadRow>;
      planner_calibration_submissions: Table<PlannerCalibrationRow>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_user_role: {
        Args: { p_user_id: string; p_role: HumRole };
        Returns: string;
      };
      approve_pricing_version: {
        Args: { p_version_id: string };
        Returns: string;
      };
      claim_ai_request: {
        Args: {
          p_project_id: string;
          p_model: string;
          p_input_chars: number;
        };
        Returns: Array<{ allowed: boolean; request_id: string }>;
      };
      complete_ai_request: {
        Args: {
          p_request_id: string;
          p_status: "completed" | "fallback" | "error";
          p_latency_ms: number;
          p_provider_request_id: string | null;
          p_error_code: string | null;
        };
        Returns: string;
      };
      share_project_with_contractor_email: {
        Args: { p_project_id: string; p_contractor_email: string };
        Returns: string;
      };
      create_pilot_invitation: {
        Args: { p_project_id: string; p_expires_days?: number };
        Returns: Array<{
          invitation_id: string;
          invitation_token: string;
          invitation_expires_at: string;
        }>;
      };
      accept_pilot_invitation: {
        Args: { p_invitation_token: string };
        Returns: string;
      };
      set_pilot_contractor_status: {
        Args: {
          p_contractor_id: string;
          p_company_name: string;
          p_license_number: string | null;
          p_service_area: string;
          p_status: "pending" | "approved" | "paused";
          p_onboarding_notes?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      hum_role: HumRole;
      pricing_status: "proposed" | "approved" | "retired";
      project_status: "draft" | "ready_for_estimate" | "estimated" | "archived";
      review_status: "draft" | "submitted";
      planner_project_mode: "photo" | "guided";
      planner_project_status: "draft" | "estimated" | "completed" | "archived";
      planner_catalog_status: "proposed" | "approved" | "retired";
      planner_confidence: "low" | "medium" | "high";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
