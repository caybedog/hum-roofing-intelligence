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
