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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_interviews: {
        Row: {
          candidate_id: string
          created_at: string | null
          expectations: Json | null
          expires_at: string
          feedback: string | null
          id: string
          job_id: string
          link_hash: string
          score: number | null
          status: string
          transcript: Json | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          expectations?: Json | null
          expires_at: string
          feedback?: string | null
          id?: string
          job_id: string
          link_hash: string
          score?: number | null
          status?: string
          transcript?: Json | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          expectations?: Json | null
          expires_at?: string
          feedback?: string | null
          id?: string
          job_id?: string
          link_hash?: string
          score?: number | null
          status?: string
          transcript?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          employee_id: string
          id: string
          read_at: string | null
        }
        Insert: {
          announcement_id: string
          employee_id: string
          id?: string
          read_at?: string | null
        }
        Update: {
          announcement_id?: string
          employee_id?: string
          id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean | null
          published_at: string | null
          target_audience: string | null
          target_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          published_at?: string | null
          target_audience?: string | null
          target_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          published_at?: string | null
          target_audience?: string | null
          target_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          break_minutes: number | null
          clock_in: string | null
          clock_in_ip: string | null
          clock_in_location: Json | null
          clock_out: string | null
          company_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          is_regularized: boolean | null
          overtime_hours: number | null
          regularization_reason: string | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_in_ip?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          company_id: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_regularized?: boolean | null
          overtime_hours?: number | null
          regularization_reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_in_ip?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_regularized?: boolean | null
          overtime_hours?: number | null
          regularization_reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_offers: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          custom_variable_values: Json | null
          expires_at: string | null
          html_content: string
          id: string
          is_predefined_html: boolean | null
          job_id: string
          joining_date: string
          offer_number: string
          payout: number
          pdf_url: string | null
          status: string
          template_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          custom_variable_values?: Json | null
          expires_at?: string | null
          html_content: string
          id?: string
          is_predefined_html?: boolean | null
          job_id: string
          joining_date: string
          offer_number: string
          payout: number
          pdf_url?: string | null
          status?: string
          template_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          custom_variable_values?: Json | null
          expires_at?: string | null
          html_content?: string
          id?: string
          is_predefined_html?: boolean | null
          job_id?: string
          joining_date?: string
          offer_number?: string
          payout?: number
          pdf_url?: string | null
          status?: string
          template_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_offers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "offer_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ai_analysis: Json | null
          ai_interview_result: Json | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          candidate_user_id: string | null
          company_id: string
          cover_letter: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_id: string
          parsed_data: Json | null
          phone: string | null
          recruiter_notes: string | null
          rejection_reason: string | null
          resume_url: string | null
          score: number | null
          source: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_interview_result?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          candidate_user_id?: string | null
          company_id: string
          cover_letter?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_id: string
          parsed_data?: Json | null
          phone?: string | null
          recruiter_notes?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          score?: number | null
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_interview_result?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          candidate_user_id?: string | null
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_id?: string
          parsed_data?: Json | null
          phone?: string | null
          recruiter_notes?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          score?: number | null
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          about_company: string | null
          company_culture: string | null
          compensation_structure: Json | null
          country: string | null
          created_at: string
          currency: string | null
          custom_domain: string | null
          deleted_at: string | null
          domain_config: Json | null
          domain_verified: boolean | null
          employee_id_next_number: number | null
          employee_id_prefix: string | null
          id: string
          id_card_primary_color: string | null
          id_card_template: string | null
          industry: string | null
          is_active: boolean | null
          license_limit: number | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          offer_sequence_current: number | null
          offer_sequence_prefix: string | null
          plan: string | null
          plan_expires_at: string | null
          price_per_license: number | null
          senddesk_sequence_current: number | null
          senddesk_sequence_prefix: string | null
          setup_completed: boolean | null
          size: string | null
          slug: string
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_user: string | null
          timezone: string | null
          updated_at: string
          wallet_balance: number | null
          website: string | null
          work_days: string[] | null
        }
        Insert: {
          about_company?: string | null
          company_culture?: string | null
          compensation_structure?: Json | null
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          domain_config?: Json | null
          domain_verified?: boolean | null
          employee_id_next_number?: number | null
          employee_id_prefix?: string | null
          id?: string
          id_card_primary_color?: string | null
          id_card_template?: string | null
          industry?: string | null
          is_active?: boolean | null
          license_limit?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          offer_sequence_current?: number | null
          offer_sequence_prefix?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          price_per_license?: number | null
          senddesk_sequence_current?: number | null
          senddesk_sequence_prefix?: string | null
          setup_completed?: boolean | null
          size?: string | null
          slug: string
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          timezone?: string | null
          updated_at?: string
          wallet_balance?: number | null
          website?: string | null
          work_days?: string[] | null
        }
        Update: {
          about_company?: string | null
          company_culture?: string | null
          compensation_structure?: Json | null
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          domain_config?: Json | null
          domain_verified?: boolean | null
          employee_id_next_number?: number | null
          employee_id_prefix?: string | null
          id?: string
          id_card_primary_color?: string | null
          id_card_template?: string | null
          industry?: string | null
          is_active?: boolean | null
          license_limit?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          offer_sequence_current?: number | null
          offer_sequence_prefix?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          price_per_license?: number | null
          senddesk_sequence_current?: number | null
          senddesk_sequence_prefix?: string | null
          setup_completed?: boolean | null
          size?: string | null
          slug?: string
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          timezone?: string | null
          updated_at?: string
          wallet_balance?: number | null
          website?: string | null
          work_days?: string[] | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          file_path: string
          id: string
          name: string
          size: number
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          file_path: string
          id?: string
          name: string
          size: number
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          file_path?: string
          id?: string
          name?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          assigned_by: string | null
          certificate_url: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          employee_id: string
          enrolled_at: string | null
          id: string
          progress: number | null
          status: Database["public"]["Enums"]["course_enrollment_status"] | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          certificate_url?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          employee_id: string
          enrolled_at?: string | null
          id?: string
          progress?: number | null
          status?:
            | Database["public"]["Enums"]["course_enrollment_status"]
            | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          certificate_url?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          employee_id?: string
          enrolled_at?: string | null
          id?: string
          progress?: number | null
          status?:
            | Database["public"]["Enums"]["course_enrollment_status"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          company_id: string
          content_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          skills_covered: string[] | null
          thumbnail_url: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          skills_covered?: string[] | null
          thumbnail_url?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          skills_covered?: string[] | null
          thumbnail_url?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          company_id: string
          created_at: string
          date: string
          evening_summary: string | null
          id: string
          mood: string | null
          morning_plan: Json | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date?: string
          evening_summary?: string | null
          id?: string
          mood?: string | null
          morning_plan?: Json | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          evening_summary?: string | null
          id?: string
          mood?: string | null
          morning_plan?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          head_id: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          head_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          head_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          level: number | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          level?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          level?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_amount: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_amount?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_amount?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      employee_exits: {
        Row: {
          assets_checklist: Json | null
          assets_returned: boolean | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          exit_interview: boolean | null
          exit_interview_answers: Json | null
          id: string
          last_working_day: string | null
          reason: string | null
          resignation_date: string | null
          settlement_done: boolean | null
          settlement_summary: Json | null
          status: Database["public"]["Enums"]["exit_status"] | null
          updated_at: string
        }
        Insert: {
          assets_checklist?: Json | null
          assets_returned?: boolean | null
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          exit_interview?: boolean | null
          exit_interview_answers?: Json | null
          id?: string
          last_working_day?: string | null
          reason?: string | null
          resignation_date?: string | null
          settlement_done?: boolean | null
          settlement_summary?: Json | null
          status?: Database["public"]["Enums"]["exit_status"] | null
          updated_at?: string
        }
        Update: {
          assets_checklist?: Json | null
          assets_returned?: boolean | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          exit_interview?: boolean | null
          exit_interview_answers?: Json | null
          id?: string
          last_working_day?: string | null
          reason?: string | null
          resignation_date?: string | null
          settlement_done?: boolean | null
          settlement_summary?: Json | null
          status?: Database["public"]["Enums"]["exit_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_exits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_to: string | null
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: Json | null
          avatar_url: string | null
          bank_details: Json | null
          blood_group: string | null
          company_id: string
          created_at: string
          custom_fields: Json | null
          date_of_birth: string | null
          date_of_joining: string | null
          deleted_at: string | null
          department_id: string | null
          designation_id: string | null
          emergency_contact: Json | null
          employee_code: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          first_name: string
          gender: string | null
          id: string
          id_card_image_history: Json | null
          last_name: string
          nationality: string | null
          personal_email: string | null
          phone: string | null
          probation_end_date: string | null
          public_id: string | null
          reporting_manager_id: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          updated_at: string
          user_id: string | null
          work_email: string | null
          work_location: string | null
        }
        Insert: {
          address?: Json | null
          avatar_url?: string | null
          bank_details?: Json | null
          blood_group?: string | null
          company_id: string
          created_at?: string
          custom_fields?: Json | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          deleted_at?: string | null
          department_id?: string | null
          designation_id?: string | null
          emergency_contact?: Json | null
          employee_code?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          first_name: string
          gender?: string | null
          id?: string
          id_card_image_history?: Json | null
          last_name: string
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          probation_end_date?: string | null
          public_id?: string | null
          reporting_manager_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          updated_at?: string
          user_id?: string | null
          work_email?: string | null
          work_location?: string | null
        }
        Update: {
          address?: Json | null
          avatar_url?: string | null
          bank_details?: Json | null
          blood_group?: string | null
          company_id?: string
          created_at?: string
          custom_fields?: Json | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          deleted_at?: string | null
          department_id?: string | null
          designation_id?: string | null
          emergency_contact?: Json | null
          employee_code?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          first_name?: string
          gender?: string | null
          id?: string
          id_card_image_history?: Json | null
          last_name?: string
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          probation_end_date?: string | null
          public_id?: string | null
          reporting_manager_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          updated_at?: string
          user_id?: string | null
          work_email?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          amount: number
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_redeemed: boolean | null
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_redeemed?: boolean | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_redeemed?: boolean | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          key_results: Json | null
          progress: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"] | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          key_results?: Json | null
          progress?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"] | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          key_results?: Json | null
          progress?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"] | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          name: string
          type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_id: string
          created_at: string
          duration_minutes: number | null
          feedback: Json | null
          id: string
          interviewers: string[] | null
          meeting_link: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"] | null
          type: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          duration_minutes?: number | null
          feedback?: Json | null
          id?: string
          interviewers?: string[] | null
          meeting_link?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          duration_minutes?: number | null
          feedback?: Json | null
          id?: string
          interviewers?: string[] | null
          meeting_link?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role_id: string | null
          status: Database["public"]["Enums"]["invitation_status"] | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          ai_interview_enabled: boolean | null
          company_id: string
          created_at: string
          department_id: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          id: string
          job_slug: string | null
          location: string | null
          max_salary: number | null
          min_salary: number | null
          openings: number | null
          pipeline_stages: Json | null
          posted_by: string | null
          published_at: string | null
          requirements: string | null
          stage_ai_settings: Json | null
          stage_automations: Json | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at: string
          work_type: string | null
        }
        Insert: {
          ai_interview_enabled?: boolean | null
          company_id: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string
          job_slug?: string | null
          location?: string | null
          max_salary?: number | null
          min_salary?: number | null
          openings?: number | null
          pipeline_stages?: Json | null
          posted_by?: string | null
          published_at?: string | null
          requirements?: string | null
          stage_ai_settings?: Json | null
          stage_automations?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          ai_interview_enabled?: boolean | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string
          job_slug?: string | null
          location?: string | null
          max_salary?: number | null
          min_salary?: number | null
          openings?: number | null
          pipeline_stages?: Json | null
          posted_by?: string | null
          published_at?: string | null
          requirements?: string | null
          stage_ai_settings?: Json | null
          stage_automations?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          pending_days: number | null
          total_days: number | null
          updated_at: string
          used_days: number | null
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          pending_days?: number | null
          total_days?: number | null
          updated_at?: string
          used_days?: number | null
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          pending_days?: number | null
          total_days?: number | null
          updated_at?: string
          used_days?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          company_id: string
          created_at: string
          document_url: string | null
          employee_id: string
          end_date: string
          half_day: boolean | null
          half_day_period: string | null
          id: string
          leave_type_id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"] | null
          total_days: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          company_id: string
          created_at?: string
          document_url?: string | null
          employee_id: string
          end_date: string
          half_day?: boolean | null
          half_day_period?: string | null
          id?: string
          leave_type_id: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_days?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          company_id?: string
          created_at?: string
          document_url?: string | null
          employee_id?: string
          end_date?: string
          half_day?: boolean | null
          half_day_period?: string | null
          id?: string
          leave_type_id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_type: string | null
          applicable_gender: string | null
          carry_forward: boolean | null
          code: string | null
          color: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          max_carry_forward_days: number | null
          max_days_per_year: number | null
          name: string
          requires_document: boolean | null
          updated_at: string
        }
        Insert: {
          accrual_type?: string | null
          applicable_gender?: string | null
          carry_forward?: boolean | null
          code?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_carry_forward_days?: number | null
          max_days_per_year?: number | null
          name: string
          requires_document?: boolean | null
          updated_at?: string
        }
        Update: {
          accrual_type?: string | null
          applicable_gender?: string | null
          carry_forward?: boolean | null
          code?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_carry_forward_days?: number | null
          max_days_per_year?: number | null
          name?: string
          requires_document?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_templates: {
        Row: {
          company_id: string
          created_at: string
          custom_variables: Json | null
          email_body: string | null
          email_subject: string | null
          html_content: string
          id: string
          is_predefined_html: boolean | null
          letterhead_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_variables?: Json | null
          email_body?: string | null
          email_subject?: string | null
          html_content: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_variables?: Json | null
          email_body?: string | null
          email_subject?: string | null
          html_content?: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_automations: {
        Row: {
          company_id: string | null
          created_at: string | null
          email_body: string | null
          email_subject: string | null
          event: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          event: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          event?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_document_requirements: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean | null
          title: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          title: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_document_requirements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_document_requirements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_document_submissions: {
        Row: {
          employee_id: string
          file_url: string | null
          id: string
          requirement_id: string
          status: string
          text_content: string | null
          uploaded_at: string
        }
        Insert: {
          employee_id: string
          file_url?: string | null
          id?: string
          requirement_id: string
          status?: string
          text_content?: string | null
          uploaded_at?: string
        }
        Update: {
          employee_id?: string
          file_url?: string | null
          id?: string
          requirement_id?: string
          status?: string
          text_content?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_document_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_document_submissions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "onboarding_document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          step_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          step_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_mandatory: boolean | null
          order_index: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_grades: {
        Row: {
          company_id: string
          created_at: string
          id: string
          max_salary: number | null
          min_salary: number | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          max_salary?: number | null
          min_salary?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          max_salary?: number | null
          min_salary?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_grades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_grades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          company_id: string
          created_at: string
          finalized_at: string | null
          id: string
          period_end: string
          period_start: string
          processed_by: string | null
          status: Database["public"]["Enums"]["payroll_status"] | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          finalized_at?: string | null
          id?: string
          period_end: string
          period_start: string
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"] | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          finalized_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"] | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          breakdown: Json | null
          company_id: string
          created_at: string
          employee_id: string
          gross_salary: number | null
          id: string
          lop_days: number | null
          net_salary: number | null
          paid_days: number | null
          payroll_run_id: string
          pdf_url: string | null
          total_deductions: number | null
          updated_at: string
          working_days: number | null
        }
        Insert: {
          breakdown?: Json | null
          company_id: string
          created_at?: string
          employee_id: string
          gross_salary?: number | null
          id?: string
          lop_days?: number | null
          net_salary?: number | null
          paid_days?: number | null
          payroll_run_id: string
          pdf_url?: string | null
          total_deductions?: number | null
          updated_at?: string
          working_days?: number | null
        }
        Update: {
          breakdown?: Json | null
          company_id?: string
          created_at?: string
          employee_id?: string
          gross_salary?: number | null
          id?: string
          lop_days?: number | null
          net_salary?: number | null
          paid_days?: number | null
          payroll_run_id?: string
          pdf_url?: string | null
          total_deductions?: number | null
          updated_at?: string
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          overall_rating: number | null
          responses: Json | null
          reviewee_id: string
          reviewer_id: string | null
          reviewer_type: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          overall_rating?: number | null
          responses?: Json | null
          reviewee_id: string
          reviewer_id?: string | null
          reviewer_type?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          overall_rating?: number | null
          responses?: Json | null
          reviewee_id?: string
          reviewer_id?: string | null
          reviewer_type?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          manager_id: string | null
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          manager_id?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          manager_id?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_team_members: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_team_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cycles: {
        Row: {
          company_id: string
          created_at: string
          form_template: Json | null
          id: string
          name: string
          period_end: string | null
          period_start: string | null
          review_deadline: string | null
          status: Database["public"]["Enums"]["review_status"] | null
          type: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          form_template?: Json | null
          id?: string
          name: string
          period_end?: string | null
          period_start?: string | null
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          form_template?: Json | null
          id?: string
          name?: string
          period_end?: string | null
          period_start?: string | null
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_approve: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_view: boolean | null
          created_at: string
          id: string
          module: string
          role_id: string
          updated_at: string
          view_scope: string | null
        }
        Insert: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module: string
          role_id: string
          updated_at?: string
          view_scope?: string | null
        }
        Update: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module?: string
          role_id?: string
          updated_at?: string
          view_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          company_id: string
          components: Json | null
          created_at: string
          effective_from: string | null
          employee_id: string
          gross_salary: number | null
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          components?: Json | null
          created_at?: string
          effective_from?: string | null
          employee_id: string
          gross_salary?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          components?: Json | null
          created_at?: string
          effective_from?: string | null
          employee_id?: string
          gross_salary?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      senddesk_documents: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          document_number: string
          employee_id: string | null
          html_content: string
          id: string
          is_predefined_html: boolean | null
          letterhead_url: string | null
          name: string
          pdf_url: string | null
          status: string
          sub_category: string | null
          template_id: string | null
          updated_at: string
          variable_values: Json | null
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          document_number: string
          employee_id?: string | null
          html_content: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name: string
          pdf_url?: string | null
          status?: string
          sub_category?: string | null
          template_id?: string | null
          updated_at?: string
          variable_values?: Json | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_number?: string
          employee_id?: string | null
          html_content?: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name?: string
          pdf_url?: string | null
          status?: string
          sub_category?: string | null
          template_id?: string | null
          updated_at?: string
          variable_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "senddesk_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "senddesk_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      senddesk_emails: {
        Row: {
          attachments: Json | null
          body_html: string
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          employee_id: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          attachments?: Json | null
          body_html: string
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          employee_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          employee_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "senddesk_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_emails_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "senddesk_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_emails_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      senddesk_templates: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          custom_variables: Json | null
          email_body: string | null
          email_subject: string | null
          html_content: string
          id: string
          is_predefined_html: boolean | null
          letterhead_url: string | null
          name: string
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_variables?: Json | null
          email_body?: string | null
          email_subject?: string | null
          html_content?: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name: string
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_variables?: Json | null
          email_body?: string | null
          email_subject?: string | null
          html_content?: string
          id?: string
          is_predefined_html?: boolean | null
          letterhead_url?: string | null
          name?: string
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "senddesk_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "senddesk_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number | null
          company_id: string
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          company_id: string
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          company_id?: string
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json | null
          id: string
          respondent_id: string | null
          submitted_at: string | null
          survey_id: string
        }
        Insert: {
          answers?: Json | null
          id?: string
          respondent_id?: string | null
          submitted_at?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json | null
          id?: string
          respondent_id?: string | null
          submitted_at?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          is_anonymous: boolean | null
          questions: Json | null
          status: Database["public"]["Enums"]["survey_status"] | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean | null
          questions?: Json | null
          status?: Database["public"]["Enums"]["survey_status"] | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean | null
          questions?: Json | null
          status?: Database["public"]["Enums"]["survey_status"] | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          end_time: string | null
          id: string
          start_time: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          company_id: string
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          priority: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sprint_id: string | null
          status: string | null
          title: string
          type: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          company_id: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sprint_id?: string | null
          status?: string | null
          title: string
          type?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          company_id?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sprint_id?: string | null
          status?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          attachments: string[] | null
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean | null
          ticket_id: string
        }
        Insert: {
          attachments?: string[] | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id: string
        }
        Update: {
          attachments?: string[] | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          company_id: string
          created_at: string
          csat_rating: number | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          raised_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          ticket_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          csat_rating?: number | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          ticket_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          csat_rating?: number | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject?: string
          ticket_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_companies: {
        Row: {
          about_company: string | null
          country: string | null
          custom_domain: string | null
          id: string | null
          industry: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string | null
          size: string | null
          slug: string | null
          website: string | null
        }
        Insert: {
          about_company?: string | null
          country?: string | null
          custom_domain?: string | null
          id?: string | null
          industry?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string | null
          size?: string | null
          slug?: string | null
          website?: string | null
        }
        Update: {
          about_company?: string | null
          country?: string | null
          custom_domain?: string | null
          id?: string | null
          industry?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string | null
          size?: string | null
          slug?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_seats: {
        Args: { p_company_id: string; p_seats: number; p_user_id: string }
        Returns: Json
      }
      apply_discount_code: { Args: { p_code_id: string }; Returns: undefined }
      extend_subscription: {
        Args: { p_company_id: string; p_months: number; p_user_id: string }
        Returns: Json
      }
      get_employee_by_public_id: {
        Args: { p_public_id: string }
        Returns: Json
      }
      get_offer_by_token: {
        Args: { p_token: string }
        Returns: {
          candidate_id: string
          company_id: string
          created_at: string
          custom_variable_values: Json | null
          expires_at: string | null
          html_content: string
          id: string
          is_predefined_html: boolean | null
          job_id: string
          joining_date: string
          offer_number: string
          payout: number
          pdf_url: string | null
          status: string
          template_id: string | null
          token: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "candidate_offers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_employee_id: { Args: never; Returns: string }
      get_user_platform_role: {
        Args: never
        Returns: Database["public"]["Enums"]["platform_role"]
      }
      increment_offer_sequence: {
        Args: { p_company_id: string }
        Returns: number
      }
      is_company_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      redeem_gift_card: {
        Args: { p_code: string; p_company_id: string; p_user_id: string }
        Returns: Json
      }
      validate_discount_code: {
        Args: { p_amount: number; p_code: string }
        Returns: Json
      }
      wallet_credit: {
        Args: {
          p_amount: number
          p_company_id: string
          p_created_by?: string
          p_description: string
          p_razorpay_order_id?: string
          p_razorpay_payment_id?: string
        }
        Returns: undefined
      }
      wallet_debit: {
        Args: {
          p_amount: number
          p_company_id: string
          p_created_by?: string
          p_description: string
        }
        Returns: undefined
      }
    }
    Enums: {
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "on_leave"
        | "holiday"
        | "weekend"
      candidate_stage:
        | "applied"
        | "screening"
        | "interview"
        | "assessment"
        | "offer"
        | "hired"
        | "rejected"
      course_enrollment_status: "enrolled" | "in_progress" | "completed"
      employee_status:
        | "active"
        | "probation"
        | "on_leave"
        | "resigned"
        | "terminated"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
      exit_status: "initiated" | "in_progress" | "completed"
      goal_status: "active" | "completed" | "missed" | "on_track" | "at_risk"
      interview_status: "scheduled" | "completed" | "cancelled"
      invitation_status: "pending" | "accepted" | "expired"
      job_status: "draft" | "open" | "paused" | "closed"
      leave_request_status: "pending" | "approved" | "rejected" | "cancelled"
      payroll_status: "draft" | "processing" | "review" | "finalized" | "paid"
      platform_role:
        | "super_admin"
        | "company_admin"
        | "user"
        | "hr_manager"
        | "recruiter"
      review_status: "draft" | "active" | "completed"
      survey_status: "draft" | "active" | "closed"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "pending_reply"
        | "resolved"
        | "closed"
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
    Enums: {
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "on_leave",
        "holiday",
        "weekend",
      ],
      candidate_stage: [
        "applied",
        "screening",
        "interview",
        "assessment",
        "offer",
        "hired",
        "rejected",
      ],
      course_enrollment_status: ["enrolled", "in_progress", "completed"],
      employee_status: [
        "active",
        "probation",
        "on_leave",
        "resigned",
        "terminated",
      ],
      employment_type: ["full_time", "part_time", "contract", "intern"],
      exit_status: ["initiated", "in_progress", "completed"],
      goal_status: ["active", "completed", "missed", "on_track", "at_risk"],
      interview_status: ["scheduled", "completed", "cancelled"],
      invitation_status: ["pending", "accepted", "expired"],
      job_status: ["draft", "open", "paused", "closed"],
      leave_request_status: ["pending", "approved", "rejected", "cancelled"],
      payroll_status: ["draft", "processing", "review", "finalized", "paid"],
      platform_role: [
        "super_admin",
        "company_admin",
        "user",
        "hr_manager",
        "recruiter",
      ],
      review_status: ["draft", "active", "completed"],
      survey_status: ["draft", "active", "closed"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "pending_reply",
        "resolved",
        "closed",
      ],
    },
  },
} as const
