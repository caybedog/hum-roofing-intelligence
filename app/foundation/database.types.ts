import type {
  AiInterpretation,
  ContractorReview,
  EstimateRecord,
  HumRole,
  PricingItem,
  PricingVersion,
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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
