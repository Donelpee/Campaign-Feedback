// Type definitions for our Supabase tables
// These extend the auto-generated types for better type safety

export type AppRole = "admin" | "super_admin";
export type AdminPermission =
  | "overview"
  | "companies"
  | "campaigns"
  | "links"
  | "responses"
  | "users"
  | "settings";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignType =
  | "feedback"
  | "employee_survey"
  | "product_research"
  | "event_evaluation";

export interface CampaignQuestion {
  id: string;
  type:
    | "rating"
    | "scale"
    | "multiple_choice"
    | "single_choice"
    | "label"
    | "textbox"
    | "textarea"
    | "combobox"
    | "checkbox_matrix"
    | "radio_matrix"
    | "date"
    | "file_upload"
    | "rank"
    | "text"
    | "nps";
  question: string;
  required: boolean;
  options?: string[];
  rows?: string[];
  columns?: string[];
  min?: number;
  max?: number;
  showIfQuestionId?: string;
  showIfOperator?: "equals" | "not_equals" | "contains";
  showIfValue?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  questions: CampaignQuestion[];
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyCampaignLink {
  id: string;
  company_id: string;
  campaign_id: string;
  unique_code: string;
  is_active: boolean;
  access_count: number;
  created_at: string;
  // Joined data
  company?: Company;
  campaign?: Campaign;
}

export interface FeedbackResponse {
  id: string;
  link_id: string;
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string | null;
  answers?: Record<string, unknown>;
  created_at: string;
  // Joined data
  link?: CompanyCampaignLink;
}

export interface UserSettings {
  id: string;
  user_id: string;
  in_app_campaign_notifications: boolean;
  default_creation_mode:
    | "guided_buddy"
    | "quick_start"
    | "template_story"
    | "conversation_builder";
  dark_mode_enabled: boolean;
  color_theme: "ocean" | "meadow";
  email_notifications: boolean;
  weekly_summary: boolean;
  compact_view: boolean;
  show_response_timestamps: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminNotification {
  id: string;
  user_id: string;
  response_id: string | null;
  campaign_id: string | null;
  company_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

// Form data types
export interface FeedbackFormData {
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalResponses: number;
  averageSatisfaction: number;
  averageServiceQuality: number;
  averageRecommendation: number;
  responsesByCompany: { company: string; count: number }[];
  satisfactionTrend: { date: string; score: number }[];
}
