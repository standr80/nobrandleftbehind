export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_reviewer_id: string | null
          auto_scheduled: boolean | null
          body_mdx: string | null
          created_at: string | null
          created_by: string | null
          drafted_at: string | null
          excerpt: string | null
          git_merge_sha: string | null
          git_pr_number: number | null
          git_pr_url: string | null
          hero_image_alt: string | null
          hero_image_credit: string | null
          hero_image_url: string | null
          id: string
          image_suggestions: Json | null
          meta_description: string | null
          published_at: string | null
          reviewer_notes: string | null
          scheduled_for: string | null
          slug: string
          status: string | null
          submitted_for_review_at: string | null
          suggested_at: string | null
          suggestion_id: string | null
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_reviewer_id?: string | null
          auto_scheduled?: boolean | null
          body_mdx?: string | null
          created_at?: string | null
          created_by?: string | null
          drafted_at?: string | null
          excerpt?: string | null
          git_merge_sha?: string | null
          git_pr_number?: number | null
          git_pr_url?: string | null
          hero_image_alt?: string | null
          hero_image_credit?: string | null
          hero_image_url?: string | null
          id?: string
          image_suggestions?: Json | null
          meta_description?: string | null
          published_at?: string | null
          reviewer_notes?: string | null
          scheduled_for?: string | null
          slug: string
          status?: string | null
          submitted_for_review_at?: string | null
          suggested_at?: string | null
          suggestion_id?: string | null
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_reviewer_id?: string | null
          auto_scheduled?: boolean | null
          body_mdx?: string | null
          created_at?: string | null
          created_by?: string | null
          drafted_at?: string | null
          excerpt?: string | null
          git_merge_sha?: string | null
          git_pr_number?: number | null
          git_pr_url?: string | null
          hero_image_alt?: string | null
          hero_image_credit?: string | null
          hero_image_url?: string | null
          id?: string
          image_suggestions?: Json | null
          meta_description?: string | null
          published_at?: string | null
          reviewer_notes?: string | null
          scheduled_for?: string | null
          slug?: string
          status?: string | null
          submitted_for_review_at?: string | null
          suggested_at?: string | null
          suggestion_id?: string | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_assigned_reviewer_id_fkey"
            columns: ["assigned_reviewer_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_log: {
        Row: {
          action: string | null
          attempted_at: string | null
          error_message: string | null
          git_pr_url: string | null
          id: string
          post_id: string | null
          response_data: Json | null
          success: boolean | null
          tenant_id: string
        }
        Insert: {
          action?: string | null
          attempted_at?: string | null
          error_message?: string | null
          git_pr_url?: string | null
          id?: string
          post_id?: string | null
          response_data?: Json | null
          success?: boolean | null
          tenant_id: string
        }
        Update: {
          action?: string | null
          attempted_at?: string | null
          error_message?: string | null
          git_pr_url?: string | null
          id?: string
          post_id?: string | null
          response_data?: Json | null
          success?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_crawl_cache: {
        Row: {
          crawled_at: string | null
          existing_topics: string[] | null
          expires_at: string | null
          id: string
          page_count: number | null
          reference_summaries: Json
          summary: string | null
          tenant_id: string
        }
        Insert: {
          crawled_at?: string | null
          existing_topics?: string[] | null
          expires_at?: string | null
          id?: string
          page_count?: number | null
          reference_summaries?: Json
          summary?: string | null
          tenant_id: string
        }
        Update: {
          crawled_at?: string | null
          existing_topics?: string[] | null
          expires_at?: string | null
          id?: string
          page_count?: number | null
          reference_summaries?: Json
          summary?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_crawl_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string | null
          id: string
          proposed_title: string
          rationale: string | null
          status: string | null
          target_keywords: string[] | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposed_title: string
          rationale?: string | null
          status?: string | null
          target_keywords?: string[] | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposed_title?: string
          rationale?: string | null
          status?: string | null
          target_keywords?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          clerk_user_id: string
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string
          tenant_id: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role: string
          tenant_id: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          auto_merge: boolean | null
          billing_tier: string | null
          blog_theme: Json | null
          brand_voice: string | null
          cms_type: string | null
          created_at: string | null
          domain: string
          forbidden_words: string[] | null
          git_blog_path: string | null
          git_branch: string | null
          git_installation_id: string | null
          git_repo: string | null
          id: string
          logo_url: string | null
          name: string
          post_cadence_active: boolean | null
          publish_cadence: string | null
          publish_days: string[] | null
          publish_time: string | null
          reference_urls: string[]
          stripe_customer_id: string | null
          target_audience: string | null
          white_label: boolean | null
          white_label_domain: string | null
          theme_extract_url: string | null
          blog_footer: string | null
        }
        Insert: {
          auto_merge?: boolean | null
          billing_tier?: string | null
          blog_theme?: Json | null
          brand_voice?: string | null
          cms_type?: string | null
          created_at?: string | null
          domain: string
          forbidden_words?: string[] | null
          git_blog_path?: string | null
          git_branch?: string | null
          git_installation_id?: string | null
          git_repo?: string | null
          id?: string
          logo_url?: string | null
          name: string
          post_cadence_active?: boolean | null
          publish_cadence?: string | null
          publish_days?: string[] | null
          publish_time?: string | null
          reference_urls?: string[]
          stripe_customer_id?: string | null
          target_audience?: string | null
          white_label?: boolean | null
          white_label_domain?: string | null
          theme_extract_url?: string | null
          blog_footer?: string | null
        }
        Update: {
          auto_merge?: boolean | null
          billing_tier?: string | null
          blog_theme?: Json | null
          brand_voice?: string | null
          cms_type?: string | null
          created_at?: string | null
          domain?: string
          forbidden_words?: string[] | null
          git_blog_path?: string | null
          git_branch?: string | null
          git_installation_id?: string | null
          git_repo?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          post_cadence_active?: boolean | null
          publish_cadence?: string | null
          publish_days?: string[] | null
          publish_time?: string | null
          reference_urls?: string[]
          stripe_customer_id?: string | null
          target_audience?: string | null
          white_label?: boolean | null
          white_label_domain?: string | null
          theme_extract_url?: string | null
          blog_footer?: string | null
        }
        Relationships: []
      }
      workspace_quotas: {
        Row: {
          id: string
          clerk_user_id: string
          max_workspaces: number
          granted_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          max_workspaces?: number
          granted_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          max_workspaces?: number
          granted_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_invitations: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: string
          token: string
          invited_by: string | null
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          role?: string
          token: string
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: string
          token?: string
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
