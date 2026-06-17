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
      authors: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          job_title: string | null
          links: Json | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          job_title?: string | null
          links?: Json | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          job_title?: string | null
          links?: Json | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      blog_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_reviewer_id: string | null
          author_id: string | null
          auto_scheduled: boolean | null
          body_mdx: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
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
          author_id?: string | null
          auto_scheduled?: boolean | null
          body_mdx?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
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
          author_id?: string | null
          auto_scheduled?: boolean | null
          body_mdx?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
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
      scout_alerts: {
        Row: {
          actioned: boolean | null
          actioned_at: string | null
          alert_type: string
          briefing_id: string | null
          created_at: string | null
          data: Json | null
          detail: string | null
          id: string
          severity: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          actioned?: boolean | null
          actioned_at?: string | null
          alert_type: string
          briefing_id?: string | null
          created_at?: string | null
          data?: Json | null
          detail?: string | null
          id?: string
          severity?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          actioned?: boolean | null
          actioned_at?: string | null
          alert_type?: string
          briefing_id?: string | null
          created_at?: string | null
          data?: Json | null
          detail?: string | null
          id?: string
          severity?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: []
      }
      scout_briefings: {
        Row: {
          briefing_html: string | null
          briefing_json: Json | null
          clem_suggestions_added: number | null
          created_at: string | null
          email_sent_at: string | null
          id: string
          status: string | null
          tenant_id: string
          urgent_count: number | null
          watch_count: number | null
          week_starting: string
          wins_count: number | null
        }
        Insert: {
          briefing_html?: string | null
          briefing_json?: Json | null
          clem_suggestions_added?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          status?: string | null
          tenant_id: string
          urgent_count?: number | null
          watch_count?: number | null
          week_starting: string
          wins_count?: number | null
        }
        Update: {
          briefing_html?: string | null
          briefing_json?: Json | null
          clem_suggestions_added?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          status?: string | null
          tenant_id?: string
          urgent_count?: number | null
          watch_count?: number | null
          week_starting?: string
          wins_count?: number | null
        }
        Relationships: []
      }
      scout_competitor_snapshots: {
        Row: {
          changed_pages: Json | null
          competitor_url: string
          created_at: string | null
          id: string
          keyword_gaps: Json | null
          new_backlinks: Json | null
          new_blog_posts: Json | null
          new_pages: Json | null
          page_count: number | null
          page_urls: Json | null
          pricing_change_summary: string | null
          pricing_changed: boolean | null
          pricing_page_content: string | null
          ranking_keywords: Json | null
          raw_crawl_hash: string | null
          removed_pages: Json | null
          snapshot_date: string
          tech_stack: Json | null
          tenant_id: string
        }
        Insert: {
          changed_pages?: Json | null
          competitor_url: string
          created_at?: string | null
          id?: string
          keyword_gaps?: Json | null
          new_backlinks?: Json | null
          new_blog_posts?: Json | null
          new_pages?: Json | null
          page_count?: number | null
          page_urls?: Json | null
          pricing_change_summary?: string | null
          pricing_changed?: boolean | null
          pricing_page_content?: string | null
          ranking_keywords?: Json | null
          raw_crawl_hash?: string | null
          removed_pages?: Json | null
          snapshot_date: string
          tech_stack?: Json | null
          tenant_id: string
        }
        Update: {
          changed_pages?: Json | null
          competitor_url?: string
          created_at?: string | null
          id?: string
          keyword_gaps?: Json | null
          new_backlinks?: Json | null
          new_blog_posts?: Json | null
          new_pages?: Json | null
          page_count?: number | null
          page_urls?: Json | null
          pricing_change_summary?: string | null
          pricing_changed?: boolean | null
          pricing_page_content?: string | null
          ranking_keywords?: Json | null
          raw_crawl_hash?: string | null
          removed_pages?: Json | null
          snapshot_date?: string
          tech_stack?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      scout_config: {
        Row: {
          auto_run_enabled: boolean | null
          brand_terms: string[] | null
          briefing_day: string | null
          briefing_time: string | null
          competitor_urls: string[] | null
          created_at: string | null
          dataforseo_enabled: boolean | null
          enabled: boolean | null
          ga4_access_token_enc: string | null
          ga4_connected: boolean | null
          ga4_property_id: string | null
          ga4_refresh_token_enc: string | null
          gsc_access_token_enc: string | null
          gsc_connected: boolean | null
          gsc_property_id: string | null
          gsc_refresh_token_enc: string | null
          id: string
          location_code: number | null
          rank_alert_threshold: number | null
          rank_devices: string[] | null
          rank_location_codes: number[] | null
          tenant_id: string
          track_competitors: boolean | null
          track_keywords: boolean | null
          track_rankings: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_run_enabled?: boolean | null
          brand_terms?: string[] | null
          briefing_day?: string | null
          briefing_time?: string | null
          competitor_urls?: string[] | null
          created_at?: string | null
          dataforseo_enabled?: boolean | null
          enabled?: boolean | null
          ga4_access_token_enc?: string | null
          ga4_connected?: boolean | null
          ga4_property_id?: string | null
          ga4_refresh_token_enc?: string | null
          gsc_access_token_enc?: string | null
          gsc_connected?: boolean | null
          gsc_property_id?: string | null
          gsc_refresh_token_enc?: string | null
          id?: string
          location_code?: number | null
          rank_alert_threshold?: number | null
          rank_devices?: string[] | null
          rank_location_codes?: number[] | null
          tenant_id: string
          track_competitors?: boolean | null
          track_keywords?: boolean | null
          track_rankings?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_run_enabled?: boolean | null
          brand_terms?: string[] | null
          briefing_day?: string | null
          briefing_time?: string | null
          competitor_urls?: string[] | null
          created_at?: string | null
          dataforseo_enabled?: boolean | null
          enabled?: boolean | null
          ga4_access_token_enc?: string | null
          ga4_connected?: boolean | null
          ga4_property_id?: string | null
          ga4_refresh_token_enc?: string | null
          gsc_access_token_enc?: string | null
          gsc_connected?: boolean | null
          gsc_property_id?: string | null
          gsc_refresh_token_enc?: string | null
          id?: string
          location_code?: number | null
          rank_alert_threshold?: number | null
          rank_devices?: string[] | null
          rank_location_codes?: number[] | null
          tenant_id?: string
          track_competitors?: boolean | null
          track_keywords?: boolean | null
          track_rankings?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scout_keyword_opportunities: {
        Row: {
          ai_overview_snippet: string | null
          clem_suggestion_id: string | null
          competitor_ranking_url: string | null
          created_at: string | null
          discovered_at: string | null
          has_ai_overview: boolean | null
          id: string
          keyword: string
          keyword_difficulty: number | null
          opportunity_type: string | null
          search_volume: number | null
          seasonal_peak_month: number | null
          status: string | null
          tenant_id: string
          weeks_until_peak: number | null
        }
        Insert: {
          ai_overview_snippet?: string | null
          clem_suggestion_id?: string | null
          competitor_ranking_url?: string | null
          created_at?: string | null
          discovered_at?: string | null
          has_ai_overview?: boolean | null
          id?: string
          keyword: string
          keyword_difficulty?: number | null
          opportunity_type?: string | null
          search_volume?: number | null
          seasonal_peak_month?: number | null
          status?: string | null
          tenant_id: string
          weeks_until_peak?: number | null
        }
        Update: {
          ai_overview_snippet?: string | null
          clem_suggestion_id?: string | null
          competitor_ranking_url?: string | null
          created_at?: string | null
          discovered_at?: string | null
          has_ai_overview?: boolean | null
          id?: string
          keyword?: string
          keyword_difficulty?: number | null
          opportunity_type?: string | null
          search_volume?: number | null
          seasonal_peak_month?: number | null
          status?: string | null
          tenant_id?: string
          weeks_until_peak?: number | null
        }
        Relationships: []
      }
      scout_rank_history: {
        Row: {
          id: string
          tenant_id: string
          keyword: string
          location_code: number
          device: string
          snapshot_date: string
          position: number | null
          previous_position: number | null
          position_change: number | null
          url: string | null
          search_volume: number | null
          source: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          keyword: string
          location_code?: number
          device?: string
          snapshot_date: string
          position?: number | null
          previous_position?: number | null
          position_change?: number | null
          url?: string | null
          search_volume?: number | null
          source?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          keyword?: string
          location_code?: number
          device?: string
          snapshot_date?: string
          position?: number | null
          previous_position?: number | null
          position_change?: number | null
          url?: string | null
          search_volume?: number | null
          source?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      scout_paa_cache: {
        Row: {
          expires_at: string | null
          fetched_at: string | null
          id: string
          questions: Json | null
          seed_keyword: string
          tenant_id: string
        }
        Insert: {
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          questions?: Json | null
          seed_keyword: string
          tenant_id: string
        }
        Update: {
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          questions?: Json | null
          seed_keyword?: string
          tenant_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          created_at: string | null
          id: string
          proposed_title: string
          rationale: string | null
          source: string | null
          source_type: string | null
          status: string | null
          target_keywords: string[] | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposed_title: string
          rationale?: string | null
          source?: string | null
          source_type?: string | null
          status?: string | null
          target_keywords?: string[] | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposed_title?: string
          rationale?: string | null
          source?: string | null
          source_type?: string | null
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
      tenant_sites: {
        Row: {
          created_at: string | null
          id: string
          is_competitor: boolean
          is_reference: boolean
          label: string | null
          tenant_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_competitor?: boolean
          is_reference?: boolean
          label?: string | null
          tenant_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_competitor?: boolean
          is_reference?: boolean
          label?: string | null
          tenant_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sites_tenant_id_fkey"
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
          git_access_token: string | null
          git_blog_path: string | null
          git_branch: string | null
          git_image_library: string[] | null
          git_installation_id: string | null
          git_repo: string | null
          id: string
          logo_url: string | null
          name: string
          post_cadence_active: boolean | null
          public_slug: string | null
          content_api_key: string | null
          deploy_hook_url: string | null
          internal_links: Json | null
          publish_cadence: string | null
          publish_days: string[] | null
          publish_time: string | null
          max_competitor_sites: number
          max_reference_sites: number
          reference_urls: string[]
          stripe_customer_id: string | null
          target_audience: string | null
          white_label: boolean | null
          white_label_domain: string | null
          theme_extract_url: string | null
          blog_footer: string | null
          ideogram_api_key: string | null
          image_gen_enabled: boolean | null
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
          git_access_token?: string | null
          git_blog_path?: string | null
          git_branch?: string | null
          git_image_library?: string[] | null
          git_installation_id?: string | null
          git_repo?: string | null
          id?: string
          logo_url?: string | null
          name: string
          post_cadence_active?: boolean | null
          public_slug?: string | null
          content_api_key?: string | null
          deploy_hook_url?: string | null
          internal_links?: Json | null
          publish_cadence?: string | null
          publish_days?: string[] | null
          publish_time?: string | null
          max_competitor_sites?: number
          max_reference_sites?: number
          reference_urls?: string[]
          stripe_customer_id?: string | null
          target_audience?: string | null
          white_label?: boolean | null
          white_label_domain?: string | null
          theme_extract_url?: string | null
          blog_footer?: string | null
          ideogram_api_key?: string | null
          image_gen_enabled?: boolean | null
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
          git_access_token?: string | null
          git_blog_path?: string | null
          git_branch?: string | null
          git_image_library?: string[] | null
          git_installation_id?: string | null
          git_repo?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          post_cadence_active?: boolean | null
          public_slug?: string | null
          content_api_key?: string | null
          deploy_hook_url?: string | null
          internal_links?: Json | null
          publish_cadence?: string | null
          publish_days?: string[] | null
          publish_time?: string | null
          max_competitor_sites?: number
          max_reference_sites?: number
          reference_urls?: string[]
          stripe_customer_id?: string | null
          target_audience?: string | null
          white_label?: boolean | null
          white_label_domain?: string | null
          theme_extract_url?: string | null
          blog_footer?: string | null
          ideogram_api_key?: string | null
          image_gen_enabled?: boolean | null
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
