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
      campaigns: {
        Row: {
          campaign_type: string | null;
          created_at: string;
          description: string | null;
          end_date: string;
          id: string;
          name: string;
          questions: Json | null;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          campaign_type?: string | null;
          created_at?: string;
          description?: string | null;
          end_date: string;
          id?: string;
          name: string;
          questions?: Json | null;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          campaign_type?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          name?: string;
          questions?: Json | null;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          updated_at?: string;
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
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
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
      get_email_by_username: { Args: { p_username: string }; Returns: string };
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
        Args: { p_code: string; p_payload: Json };
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
