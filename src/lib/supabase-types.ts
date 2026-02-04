// Type definitions for our Supabase tables
// These extend the auto-generated types for better type safety

export type AppRole = 'admin' | 'super_admin';

export interface Company {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
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
  created_at: string;
  // Joined data
  link?: CompanyCampaignLink;
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
