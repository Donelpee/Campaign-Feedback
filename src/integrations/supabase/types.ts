export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          campaign_id: string | null;
          company_id: string | null;
          created_at: string;
          id: string;
          message: string;
          metadata: Json;
          notification_type: string;
          read_at: string | null;
          response_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          campaign_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          metadata?: Json;
          notification_type?: string;
          read_at?: string | null;
          response_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          campaign_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          metadata?: Json;
          notification_type?: string;
          read_at?: string | null;
          response_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_notifications_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_notifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_notifications_response_id_fkey";
            columns: ["response_id"];
            isOneToOne: false;
            referencedRelation: "feedback_responses";
            referencedColumns: ["id"];
          },
        ];
      };
      app_modules: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          module_key: string;
          module_name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          module_key: string;
          module_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          module_key?: string;
          module_name?: string;
        };
        Relationships: [];
      };
      app_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          role_key: string;
          role_name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          role_key: string;
          role_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          role_key?: string;
          role_name?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          entity_id: string | null;
          entity_name: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          summary: string;
          tenant_id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_id?: string | null;
          entity_name?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          summary: string;
          tenant_id: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_name?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          summary?: string;
          tenant_id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          campaign_type: string | null;
          company_id: string | null;
          created_at: string;
          created_by_user_id: string | null;
          description: string | null;
          end_date: string;
          id: string;
          name: string;
          questions: Json | null;
          start_date: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          campaign_type?: string | null;
          company_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          end_date: string;
          id?: string;
          name: string;
          questions?: Json | null;
          start_date: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          campaign_type?: string | null;
          company_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          end_date?: string;
          id?: string;
          name?: string;
          questions?: Json | null;
          start_date?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_templates: {
        Row: {
          campaign_type: string;
          created_at: string;
          created_by_user_id: string | null;
          description: string | null;
          id: string;
          name: string;
          questions: Json;
          source_campaign_id: string | null;
          tenant_id: string;
          updated_at: string;
          visibility_scope: string;
        };
        Insert: {
          campaign_type?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          questions?: Json;
          source_campaign_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
          visibility_scope?: string;
        };
        Update: {
          campaign_type?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          questions?: Json;
          source_campaign_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
          visibility_scope?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_templates_source_campaign_id_fkey";
            columns: ["source_campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          tenant_id: string;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Relationships: [];
      };
      company_campaign_links: {
        Row: {
          access_count: number;
          campaign_id: string;
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          unique_code: string;
        };
        Insert: {
          access_count?: number;
          campaign_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          unique_code: string;
        };
        Update: {
          access_count?: number;
          campaign_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          unique_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_campaign_links_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_campaign_links_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_responses: {
        Row: {
          additional_comments: string | null;
          answers: Json;
          created_at: string;
          id: string;
          improvement_areas: string[] | null;
          link_id: string;
          overall_satisfaction: number;
          recommendation_likelihood: number;
          service_quality: number;
          submission_payload_hash: string | null;
          submission_token: string | null;
        };
        Insert: {
          additional_comments?: string | null;
          answers?: Json;
          created_at?: string;
          id?: string;
          improvement_areas?: string[] | null;
          link_id: string;
          overall_satisfaction: number;
          recommendation_likelihood: number;
          service_quality: number;
          submission_payload_hash?: string | null;
          submission_token?: string | null;
        };
        Update: {
          additional_comments?: string | null;
          answers?: Json;
          created_at?: string;
          id?: string;
          improvement_areas?: string[] | null;
          link_id?: string;
          overall_satisfaction?: number;
          recommendation_likelihood?: number;
          service_quality?: number;
          submission_payload_hash?: string | null;
          submission_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_responses_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "company_campaign_links";
            referencedColumns: ["id"];
          },
        ];
      };
      system_health_events: {
        Row: {
          area: string;
          campaign_id: string | null;
          company_id: string | null;
          created_at: string;
          event_type: string;
          fingerprint: string;
          id: string;
          link_id: string | null;
          message: string;
          metadata: Json;
          route: string | null;
          severity: string;
          source: string;
          status_code: number | null;
        };
        Insert: {
          area: string;
          campaign_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          event_type: string;
          fingerprint: string;
          id?: string;
          link_id?: string | null;
          message: string;
          metadata?: Json;
          route?: string | null;
          severity?: string;
          source?: string;
          status_code?: number | null;
        };
        Update: {
          area?: string;
          campaign_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          event_type?: string;
          fingerprint?: string;
          id?: string;
          link_id?: string | null;
          message?: string;
          metadata?: Json;
          route?: string | null;
          severity?: string;
          source?: string;
          status_code?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "system_health_events_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_health_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_health_events_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "company_campaign_links";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: string;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          organization_name: string | null;
          respondent_name_preference: string;
          show_thank_you_signoff: boolean;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          account_type?: string;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          organization_name?: string | null;
          respondent_name_preference?: string;
          show_thank_you_signoff?: boolean;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          account_type?: string;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          organization_name?: string | null;
          respondent_name_preference?: string;
          show_thank_you_signoff?: boolean;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      onboarding_invites: {
        Row: {
          company_ids: string[];
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          invite_email: string;
          module_keys: string[];
          role_key: string;
          token_hash: string;
          used_at: string | null;
          username: string | null;
        };
        Insert: {
          company_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          invite_email: string;
          module_keys?: string[];
          role_key: string;
          token_hash: string;
          used_at?: string | null;
          username?: string | null;
        };
        Update: {
          company_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          invite_email?: string;
          module_keys?: string[];
          role_key?: string;
          token_hash?: string;
          used_at?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      role_module_permissions: {
        Row: {
          created_at: string;
          id: string;
          module_key: string;
          role_key: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          module_key: string;
          role_key: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          module_key?: string;
          role_key?: string;
        };
        Relationships: [];
      };
      user_permissions: {
        Row: {
          created_at: string;
          id: string;
          permission: Database["public"]["Enums"]["admin_permission"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          permission: Database["public"]["Enums"]["admin_permission"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          permission?: Database["public"]["Enums"]["admin_permission"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_campaign_permissions: {
        Row: {
          campaign_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_campaign_permissions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      user_module_permissions: {
        Row: {
          created_at: string;
          id: string;
          module_key: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          module_key: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          module_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_company_permissions: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_company_permissions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          color_theme: string;
          compact_view: boolean;
          created_at: string;
          default_creation_mode: string;
          dark_mode_enabled: boolean;
          email_notifications: boolean;
          id: string;
          in_app_campaign_notifications: boolean;
          show_response_timestamps: boolean;
          updated_at: string;
          user_id: string;
          weekly_summary: boolean;
        };
        Insert: {
          color_theme?: string;
          compact_view?: boolean;
          created_at?: string;
          default_creation_mode?: string;
          dark_mode_enabled?: boolean;
          email_notifications?: boolean;
          id?: string;
          in_app_campaign_notifications?: boolean;
          show_response_timestamps?: boolean;
          updated_at?: string;
          user_id: string;
          weekly_summary?: boolean;
        };
        Update: {
          color_theme?: string;
          compact_view?: boolean;
          created_at?: string;
          default_creation_mode?: string;
          dark_mode_enabled?: boolean;
          email_notifications?: boolean;
          id?: string;
          in_app_campaign_notifications?: boolean;
          show_response_timestamps?: boolean;
          updated_at?: string;
          user_id?: string;
          weekly_summary?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_feedback_link_data: { Args: { p_code: string }; Returns: Json };
      get_feedback_question_infographics: {
        Args: { p_campaign_id: string; p_company_id?: string | null };
        Returns: Json;
      };
      get_feedback_response_page: {
        Args: {
          p_campaign_id?: string | null;
          p_company_id?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          additional_comments: string | null;
          answers: Json;
          campaign_id: string;
          campaign_name: string;
          campaign_questions: Json;
          campaign_type: string;
          company_id: string;
          company_logo_url: string | null;
          company_name: string;
          created_at: string;
          id: string;
          improvement_areas: string[];
          link_id: string;
          overall_satisfaction: number;
          recommendation_likelihood: number;
          service_quality: number;
          total_count: number;
        }[];
      };
      get_feedback_response_summary: {
        Args: { p_campaign_id?: string | null; p_company_id?: string | null };
        Returns: Json;
      };
      get_email_by_username: { Args: { p_username: string }; Returns: string };
      get_campaign_response_counts: {
        Args: { p_company_id?: string | null };
        Returns: {
          campaign_id: string;
          response_count: number;
        }[];
      };
      get_audit_log_page: {
        Args: {
          p_action?: string | null;
          p_entity_type?: string | null;
          p_from_date?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_search?: string | null;
          p_to_date?: string | null;
          p_user_id?: string | null;
        };
        Returns: {
          action: string;
          created_at: string;
          entity_id: string | null;
          entity_name: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          summary: string;
          tenant_id: string;
          total_count: number;
          user_email: string | null;
          user_id: string | null;
          user_name: string;
        }[];
      };
      get_audit_log_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activity_count: number;
          last_activity_at: string;
          user_email: string | null;
          user_id: string;
          user_name: string;
        }[];
      };
      get_companies_with_activity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          created_by_email: string | null;
          created_by_name: string;
          created_by_user_id: string | null;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          updated_at: string;
          updated_by_email: string | null;
          updated_by_name: string;
          updated_by_user_id: string | null;
        }[];
      };
      has_permission: {
        Args: {
          _permission: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      has_campaign_access: {
        Args: {
          _campaign_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      has_company_access: {
        Args: {
          _company_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_access_count: {
        Args: { link_code: string };
        Returns: undefined;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      submit_feedback_response: {
        Args: {
          p_code: string;
          p_payload: Json;
          p_submission_payload_hash?: string | null;
          p_submission_token?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      admin_permission:
        | "overview"
        | "companies"
        | "campaigns"
        | "links"
        | "responses"
        | "audit_logs"
        | "users"
        | "settings";
      app_role: "admin" | "super_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_permission: [
        "overview",
        "companies",
        "campaigns",
        "links",
        "responses",
        "users",
        "settings",
      ],
      app_role: ["admin", "super_admin"],
    },
  },
} as const;
