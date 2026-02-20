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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowed_signups: {
        Row: {
          created_at: string
          email: string
          employee_id: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_used: boolean | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          employee_id?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_used?: boolean | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          employee_id?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allowed_signups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowed_signups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowed_signups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_publishers: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_pinned: boolean | null
          org_id: string | null
          title: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          org_id?: string | null
          title: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          org_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string
          id: string
          org_id: string | null
          rejection_reason: string | null
          request_type: string
          status: Database["public"]["Enums"]["request_status"] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description: string
          id?: string
          org_id?: string | null
          rejection_reason?: string | null
          request_type?: string
          status?: Database["public"]["Enums"]["request_status"] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string
          id?: string
          org_id?: string | null
          rejection_reason?: string | null
          request_type?: string
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          break_end: string | null
          break_start: string | null
          client_id: string | null
          clock_in: string
          clock_out: string | null
          clock_type: string | null
          created_at: string
          employee_id: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          notes: string | null
          org_id: string | null
          pause_end: string | null
          pause_start: string | null
          status: string | null
          total_break_minutes: number | null
          total_pause_minutes: number | null
          user_id: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          client_id?: string | null
          clock_in: string
          clock_out?: string | null
          clock_type?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          notes?: string | null
          org_id?: string | null
          pause_end?: string | null
          pause_start?: string | null
          status?: string | null
          total_break_minutes?: number | null
          total_pause_minutes?: number | null
          user_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          client_id?: string | null
          clock_in?: string
          clock_out?: string | null
          clock_type?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          notes?: string | null
          org_id?: string | null
          pause_end?: string | null
          pause_start?: string | null
          status?: string | null
          total_break_minutes?: number | null
          total_pause_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          org_id: string | null
          screenshot_url: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          org_id?: string | null
          screenshot_url?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          org_id?: string | null
          screenshot_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          is_active: boolean
          org_id: string | null
          reminder_sent: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          reminder_sent?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          reminder_sent?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversation_keys: {
        Row: {
          conversation_id: string
          created_at: string
          encrypted_key: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          encrypted_key: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          encrypted_key?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_keys_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_group: boolean
          name: string | null
          org_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          encrypted_content: string | null
          id: string
          is_encrypted: boolean | null
          is_read: boolean
          nonce: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          encrypted_content?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean
          nonce?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          encrypted_content?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean
          nonce?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_alerts: {
        Row: {
          alert_type: string
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          org_id: string | null
          show_on_selection: boolean
          title: string
        }
        Insert: {
          alert_type?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          org_id?: string | null
          show_on_selection?: boolean
          title: string
        }
        Update: {
          alert_type?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          org_id?: string | null
          show_on_selection?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_recurring: boolean | null
          name: string
          region: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          region?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      document_shares: {
        Row: {
          created_at: string
          document_id: string
          id: string
          is_read: boolean | null
          message: string | null
          org_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          org_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          org_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          employee_id: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          org_id: string | null
          requires_signature: boolean | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          employee_id?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          org_id?: string | null
          requires_signature?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          employee_id?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          org_id?: string | null
          requires_signature?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string
          employee_id: string | null
          employment_type: string | null
          first_name: string
          gender: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          include_dashain_bonus: boolean | null
          income_tax: number | null
          insurance_premium: number | null
          job_title: string | null
          last_name: string
          line_manager_id: string | null
          location: string | null
          manager_id: string | null
          org_id: string | null
          pay_type: string | null
          phone: string | null
          position_level: string | null
          probation_completed: boolean | null
          profile_id: string | null
          provident_fund: number | null
          salary: number | null
          social_security: number | null
          status: string | null
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          employee_id?: string | null
          employment_type?: string | null
          first_name: string
          gender?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          include_dashain_bonus?: boolean | null
          income_tax?: number | null
          insurance_premium?: number | null
          job_title?: string | null
          last_name: string
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          org_id?: string | null
          pay_type?: string | null
          phone?: string | null
          position_level?: string | null
          probation_completed?: boolean | null
          profile_id?: string | null
          provident_fund?: number | null
          salary?: number | null
          social_security?: number | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          employee_id?: string | null
          employment_type?: string | null
          first_name?: string
          gender?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          include_dashain_bonus?: boolean | null
          income_tax?: number | null
          insurance_premium?: number | null
          job_title?: string | null
          last_name?: string
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          org_id?: string | null
          pay_type?: string | null
          phone?: string | null
          position_level?: string | null
          probation_completed?: boolean | null
          profile_id?: string | null
          provident_fund?: number | null
          salary?: number | null
          social_security?: number | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grievance_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          grievance_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          grievance_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          grievance_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grievance_attachments_grievance_id_fkey"
            columns: ["grievance_id"]
            isOneToOne: false
            referencedRelation: "grievances"
            referencedColumns: ["id"]
          },
        ]
      }
      grievance_comments: {
        Row: {
          content: string
          created_at: string
          grievance_id: string
          id: string
          is_internal: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          grievance_id: string
          id?: string
          is_internal?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          grievance_id?: string
          id?: string
          is_internal?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grievance_comments_grievance_id_fkey"
            columns: ["grievance_id"]
            isOneToOne: false
            referencedRelation: "grievances"
            referencedColumns: ["id"]
          },
        ]
      }
      grievances: {
        Row: {
          anonymous_visibility: string
          assigned_to: string | null
          category: string
          created_at: string
          details: string
          employee_id: string | null
          id: string
          is_anonymous: boolean
          org_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymous_visibility?: string
          assigned_to?: string | null
          category: string
          created_at?: string
          details: string
          employee_id?: string | null
          id?: string
          is_anonymous?: boolean
          org_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymous_visibility?: string
          assigned_to?: string | null
          category?: string
          created_at?: string
          details?: string
          employee_id?: string | null
          id?: string
          is_anonymous?: boolean
          org_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grievances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          id: string
          leave_type: string
          org_id: string | null
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          leave_type: string
          org_id?: string | null
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          leave_type?: string
          org_id?: string | null
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: string
          org_id: string | null
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days: number
          end_date: string
          id?: string
          leave_type: string
          org_id?: string | null
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          org_id?: string | null
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_agreements: {
        Row: {
          agreement_doc_path: string | null
          agreement_text: string | null
          ceo_signature: string | null
          ceo_signed_at: string | null
          created_at: string
          disbursement_amount: number | null
          disbursement_date: string | null
          disbursement_sla_deadline: string | null
          employee_signature: string | null
          employee_signed_at: string | null
          first_deduction_month: string
          hr_signature: string | null
          hr_signed_at: string | null
          id: string
          interest_rate: number
          loan_request_id: string
          monthly_installment: number
          principal: number
          repayment_schedule: Json
          sla_alert_sent: boolean | null
          status: string
          term_months: number
          updated_at: string
        }
        Insert: {
          agreement_doc_path?: string | null
          agreement_text?: string | null
          ceo_signature?: string | null
          ceo_signed_at?: string | null
          created_at?: string
          disbursement_amount?: number | null
          disbursement_date?: string | null
          disbursement_sla_deadline?: string | null
          employee_signature?: string | null
          employee_signed_at?: string | null
          first_deduction_month: string
          hr_signature?: string | null
          hr_signed_at?: string | null
          id?: string
          interest_rate?: number
          loan_request_id: string
          monthly_installment: number
          principal: number
          repayment_schedule: Json
          sla_alert_sent?: boolean | null
          status?: string
          term_months: number
          updated_at?: string
        }
        Update: {
          agreement_doc_path?: string | null
          agreement_text?: string | null
          ceo_signature?: string | null
          ceo_signed_at?: string | null
          created_at?: string
          disbursement_amount?: number | null
          disbursement_date?: string | null
          disbursement_sla_deadline?: string | null
          employee_signature?: string | null
          employee_signed_at?: string | null
          first_deduction_month?: string
          hr_signature?: string | null
          hr_signed_at?: string | null
          id?: string
          interest_rate?: number
          loan_request_id?: string
          monthly_installment?: number
          principal?: number
          repayment_schedule?: Json
          sla_alert_sent?: boolean | null
          status?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_agreements_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_approvals: {
        Row: {
          approval_step: string
          budget_available: boolean | null
          cashflow_approved: boolean | null
          ceo_decision_notes: string | null
          created_at: string
          decision: string | null
          eligibility_verified: boolean | null
          finalized_installment: number | null
          finalized_schedule: Json | null
          hr_recommendation: string | null
          id: string
          loan_request_id: string
          notes: string | null
          outstanding_checked: boolean | null
          position_verified: boolean | null
          prioritization_applied: boolean | null
          repayment_finalized: boolean | null
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          approval_step: string
          budget_available?: boolean | null
          cashflow_approved?: boolean | null
          ceo_decision_notes?: string | null
          created_at?: string
          decision?: string | null
          eligibility_verified?: boolean | null
          finalized_installment?: number | null
          finalized_schedule?: Json | null
          hr_recommendation?: string | null
          id?: string
          loan_request_id: string
          notes?: string | null
          outstanding_checked?: boolean | null
          position_verified?: boolean | null
          prioritization_applied?: boolean | null
          repayment_finalized?: boolean | null
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          approval_step?: string
          budget_available?: boolean | null
          cashflow_approved?: boolean | null
          ceo_decision_notes?: string | null
          created_at?: string
          decision?: string | null
          eligibility_verified?: boolean | null
          finalized_installment?: number | null
          finalized_schedule?: Json | null
          hr_recommendation?: string | null
          id?: string
          loan_request_id?: string
          notes?: string | null
          outstanding_checked?: boolean | null
          position_verified?: boolean | null
          prioritization_applied?: boolean | null
          repayment_finalized?: boolean | null
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_approvals_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_accessed: string | null
          id: string
          loan_request_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_accessed?: string | null
          id?: string
          loan_request_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_accessed?: string | null
          id?: string
          loan_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_audit_logs_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_default_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          flagged_for_hr: boolean | null
          id: string
          loan_request_id: string
          repayment_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          flagged_for_hr?: boolean | null
          id?: string
          loan_request_id: string
          repayment_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          flagged_for_hr?: boolean | null
          id?: string
          loan_request_id?: string
          repayment_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_default_events_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_default_events_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_monthly_budgets: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          month: number
          notes: string | null
          org_id: string | null
          set_by: string
          total_budget: number
          updated_at: string
          year: number
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          org_id?: string | null
          set_by: string
          total_budget: number
          updated_at?: string
          year: number
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          org_id?: string | null
          set_by?: string
          total_budget?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_monthly_budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_officer_roles: {
        Row: {
          created_at: string
          id: string
          loan_role: string
          org_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loan_role: string
          org_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loan_role?: string
          org_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_officer_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          agreement_id: string | null
          created_at: string
          deducted_at: string | null
          due_date: string
          employee_id: string | null
          id: string
          interest_amount: number
          loan_request_id: string
          month_number: number
          payroll_export_id: string | null
          principal_amount: number
          remaining_balance: number
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string
          deducted_at?: string | null
          due_date: string
          employee_id?: string | null
          id?: string
          interest_amount: number
          loan_request_id: string
          month_number: number
          payroll_export_id?: string | null
          principal_amount: number
          remaining_balance: number
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agreement_id?: string | null
          created_at?: string
          deducted_at?: string | null
          due_date?: string
          employee_id?: string | null
          id?: string
          interest_amount?: number
          loan_request_id?: string
          month_number?: number
          payroll_export_id?: string | null
          principal_amount?: number
          remaining_balance?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "loan_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_request_confidential: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          loan_request_id: string
          reason_details: string | null
          supporting_doc_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          loan_request_id: string
          reason_details?: string | null
          supporting_doc_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          loan_request_id?: string
          reason_details?: string | null
          supporting_doc_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_request_confidential_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_requests: {
        Row: {
          amount: number
          auto_deduction_consent: boolean
          created_at: string
          declaration_signed: boolean
          e_signature: string | null
          employee_id: string | null
          estimated_monthly_installment: number | null
          has_prior_outstanding: boolean | null
          id: string
          interest_rate: number
          max_eligible_amount: number | null
          org_id: string | null
          position_level: string | null
          prior_outstanding_amount: number | null
          reason_type: string
          signed_at: string | null
          status: string
          submitted_at: string | null
          term_months: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_deduction_consent?: boolean
          created_at?: string
          declaration_signed?: boolean
          e_signature?: string | null
          employee_id?: string | null
          estimated_monthly_installment?: number | null
          has_prior_outstanding?: boolean | null
          id?: string
          interest_rate?: number
          max_eligible_amount?: number | null
          org_id?: string | null
          position_level?: string | null
          prior_outstanding_amount?: number | null
          reason_type: string
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          term_months: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_deduction_consent?: boolean
          created_at?: string
          declaration_signed?: boolean
          e_signature?: string | null
          employee_id?: string | null
          estimated_monthly_installment?: number | null
          has_prior_outstanding?: boolean | null
          id?: string
          interest_rate?: number
          max_eligible_amount?: number | null
          org_id?: string | null
          position_level?: string | null
          prior_outstanding_amount?: number | null
          reason_type?: string
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          term_months?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_waiting_list: {
        Row: {
          created_at: string
          deferred_month: number | null
          deferred_year: number | null
          hire_date: string | null
          id: string
          loan_request_id: string
          priority_score: number
          reason_type: string | null
          reconfirm_required: boolean | null
          reconfirmed: boolean | null
          reconfirmed_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deferred_month?: number | null
          deferred_year?: number | null
          hire_date?: string | null
          id?: string
          loan_request_id: string
          priority_score?: number
          reason_type?: string | null
          reconfirm_required?: boolean | null
          reconfirmed?: boolean | null
          reconfirmed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deferred_month?: number | null
          deferred_year?: number | null
          hire_date?: string | null
          id?: string
          loan_request_id?: string
          priority_score?: number
          reason_type?: string | null
          reconfirm_required?: boolean | null
          reconfirmed?: boolean | null
          reconfirmed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_waiting_list_loan_request_id_fkey"
            columns: ["loan_request_id"]
            isOneToOne: false
            referencedRelation: "loan_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          org_id: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          org_id?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          org_id?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_workflows: {
        Row: {
          access_revoked: boolean | null
          assets_recovered: boolean | null
          created_at: string
          created_by: string
          employee_id: string
          exit_interview_completed: boolean | null
          final_settlement_processed: boolean | null
          id: string
          last_working_date: string
          reason: string | null
          resignation_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          access_revoked?: boolean | null
          assets_recovered?: boolean | null
          created_at?: string
          created_by: string
          employee_id: string
          exit_interview_completed?: boolean | null
          final_settlement_processed?: boolean | null
          id?: string
          last_working_date: string
          reason?: string | null
          resignation_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          access_revoked?: boolean | null
          assets_recovered?: boolean | null
          created_at?: string
          created_by?: string
          employee_id?: string
          exit_interview_completed?: boolean | null
          final_settlement_processed?: boolean | null
          id?: string
          last_working_date?: string
          reason?: string | null
          resignation_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          sort_order: number | null
          task_type: string | null
          title: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_type?: string | null
          title: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_type?: string | null
          title?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "onboarding_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_workflows: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          employee_id: string
          id: string
          start_date: string
          status: string | null
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          employee_id: string
          id?: string
          start_date: string
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          start_date?: string
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_org_admin: boolean | null
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_org_admin?: boolean | null
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_org_admin?: boolean | null
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allowed_email_domains: string[]
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          allowed_email_domains?: string[]
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          allowed_email_domains?: string[]
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          created_at: string
          employee_count: number | null
          id: string
          org_id: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          processed_by: string | null
          region: string | null
          status: string | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
        }
        Insert: {
          created_at?: string
          employee_count?: number | null
          id?: string
          org_id?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          processed_by?: string | null
          region?: string | null
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Update: {
          created_at?: string
          employee_count?: number | null
          id?: string
          org_id?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          processed_by?: string | null
          region?: string | null
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_files: {
        Row: {
          created_at: string
          employee_id: string | null
          file_name: string
          file_path: string
          id: string
          month: number | null
          org_id: string | null
          period_end: string
          period_start: string
          period_type: string
          quarter: number | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          file_name: string
          file_path: string
          id?: string
          month?: number | null
          org_id?: string | null
          period_end: string
          period_start: string
          period_type: string
          quarter?: number | null
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          month?: number | null
          org_id?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          quarter?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslip_files_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_files_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_files_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          created_at: string
          deductions: Json | null
          employee_id: string
          gross_pay: number
          hours_worked: number | null
          id: string
          net_pay: number
          org_id: string | null
          overtime_hours: number | null
          payroll_run_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deductions?: Json | null
          employee_id: string
          gross_pay: number
          hours_worked?: number | null
          id?: string
          net_pay: number
          org_id?: string | null
          overtime_hours?: number | null
          payroll_run_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deductions?: Json | null
          employee_id?: string
          gross_pay?: number
          hours_worked?: number | null
          id?: string
          net_pay?: number
          org_id?: string | null
          overtime_hours?: number | null
          payroll_run_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
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
            foreignKeyName: "payslips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          email: string
          first_name: string
          hire_date: string | null
          id: string
          job_title: string | null
          joining_date: string | null
          last_name: string
          location: string | null
          org_id: string | null
          phone: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email: string
          first_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          joining_date?: string | null
          last_name: string
          location?: string | null
          org_id?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          joining_date?: string | null
          last_name?: string
          location?: string | null
          org_id?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rpc_rate_limits: {
        Row: {
          call_count: number | null
          identifier: string
          window_start: string | null
        }
        Insert: {
          call_count?: number | null
          identifier: string
          window_start?: string | null
        }
        Update: {
          call_count?: number | null
          identifier?: string
          window_start?: string | null
        }
        Relationships: []
      }
      spam_users: {
        Row: {
          email: string
          flagged_at: string | null
          flagged_by: string | null
          id: string
          is_blocked: boolean | null
          notes: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          email: string
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          email?: string
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          sort_order: number | null
          task_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean | null
          org_id: string | null
          parent_task_id: string | null
          priority: string | null
          recurrence_pattern: string | null
          status: string | null
          time_estimate: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          org_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          recurrence_pattern?: string | null
          status?: string | null
          time_estimate?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          org_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          recurrence_pattern?: string | null
          status?: string | null
          time_estimate?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_encryption_keys: {
        Row: {
          created_at: string
          id: string
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          id?: string
          permission: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_digest: boolean | null
          id: string
          leave_notifications: boolean | null
          payroll_notifications: boolean | null
          performance_notifications: boolean | null
          task_notifications: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_digest?: boolean | null
          id?: string
          leave_notifications?: boolean | null
          payroll_notifications?: boolean | null
          performance_notifications?: boolean | null
          task_notifications?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_digest?: boolean | null
          id?: string
          leave_notifications?: boolean | null
          payroll_notifications?: boolean | null
          performance_notifications?: boolean | null
          task_notifications?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          org_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          org_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          org_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_log_history: {
        Row: {
          change_type: string
          changed_at: string
          id: string
          new_log_date: string | null
          new_notes: string | null
          new_task_description: string | null
          new_time_spent_minutes: number | null
          previous_log_date: string | null
          previous_notes: string | null
          previous_task_description: string | null
          previous_time_spent_minutes: number | null
          user_id: string
          work_log_id: string
        }
        Insert: {
          change_type?: string
          changed_at?: string
          id?: string
          new_log_date?: string | null
          new_notes?: string | null
          new_task_description?: string | null
          new_time_spent_minutes?: number | null
          previous_log_date?: string | null
          previous_notes?: string | null
          previous_task_description?: string | null
          previous_time_spent_minutes?: number | null
          user_id: string
          work_log_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          id?: string
          new_log_date?: string | null
          new_notes?: string | null
          new_task_description?: string | null
          new_time_spent_minutes?: number | null
          previous_log_date?: string | null
          previous_notes?: string | null
          previous_task_description?: string | null
          previous_time_spent_minutes?: number | null
          user_id?: string
          work_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_log_history_work_log_id_fkey"
            columns: ["work_log_id"]
            isOneToOne: false
            referencedRelation: "work_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_logs: {
        Row: {
          client_id: string | null
          created_at: string
          department: string | null
          employee_id: string | null
          end_time: string | null
          id: string
          log_date: string
          notes: string | null
          org_id: string | null
          start_time: string | null
          status: string | null
          task_description: string
          task_id: string | null
          time_spent_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          department?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          org_id?: string | null
          start_time?: string | null
          status?: string | null
          task_description: string
          task_id?: string | null
          time_spent_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          department?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          org_id?: string | null
          start_time?: string | null
          status?: string | null
          task_description?: string
          task_id?: string | null
          time_spent_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_directory: {
        Row: {
          department: string | null
          email: string | null
          first_name: string | null
          hire_date: string | null
          id: string | null
          job_title: string | null
          last_name: string | null
          line_manager_id: string | null
          location: string | null
          manager_id: string | null
          profile_id: string | null
          status: string | null
        }
        Insert: {
          department?: string | null
          email?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          profile_id?: string | null
          status?: string | null
        }
        Update: {
          department?: string | null
          email?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          profile_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_view: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          employee_id: string | null
          first_name: string | null
          gender: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string | null
          include_dashain_bonus: boolean | null
          income_tax: number | null
          insurance_premium: number | null
          job_title: string | null
          last_name: string | null
          line_manager_id: string | null
          location: string | null
          manager_id: string | null
          pay_type: string | null
          phone: string | null
          profile_id: string | null
          provident_fund: number | null
          salary: number | null
          social_security: number | null
          status: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          gender?: string | null
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          include_dashain_bonus?: boolean | null
          income_tax?: never
          insurance_premium?: never
          job_title?: string | null
          last_name?: string | null
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          pay_type?: string | null
          phone?: string | null
          profile_id?: string | null
          provident_fund?: never
          salary?: never
          social_security?: never
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          gender?: string | null
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          include_dashain_bonus?: boolean | null
          income_tax?: never
          insurance_premium?: never
          job_title?: string | null
          last_name?: string | null
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          pay_type?: string | null
          phone?: string | null
          profile_id?: string | null
          provident_fund?: never
          salary?: never
          social_security?: never
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_salary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_group_member: {
        Args: { _conversation_id: string; _new_member_id: string }
        Returns: boolean
      }
      auto_clock_out_after_8_hours: { Args: never; Returns: number }
      can_create_employee: { Args: { _user_id: string }; Returns: boolean }
      can_manage_announcements: { Args: { _user_id: string }; Returns: boolean }
      can_manage_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_grievance: {
        Args: { _grievance_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_salary: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          func_name: string
          identifier: string
          max_calls: number
          window_seconds: number
        }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_dm_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
      }
      get_all_user_ids_for_sharing: { Args: never; Returns: string[] }
      get_employee_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_management_user_ids: { Args: never; Returns: string[] }
      get_org_by_slug: {
        Args: { _slug: string }
        Returns: {
          allowed_email_domains: string[]
          id: string
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_todays_milestones: {
        Args: never
        Returns: {
          first_name: string
          last_name: string
          milestone_type: string
          user_id: string
          years: number
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_visible_employee_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_loan_officer_role: {
        Args: { _loan_role: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_direct_manager: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_it_team: { Args: { _user_id: string }; Returns: boolean }
      is_line_manager: { Args: { _user_id: string }; Returns: boolean }
      is_loan_officer: { Args: { _user_id: string }; Returns: boolean }
      is_org_vp: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_security_monitor: { Args: { _user_id: string }; Returns: boolean }
      is_task_assignee: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      mark_signup_used: { Args: { check_email: string }; Returns: boolean }
      sync_profile_with_employee: { Args: never; Returns: undefined }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_conversation_ids: { Args: { _user_id: string }; Returns: string[] }
      validate_email_domain: {
        Args: { _email: string; _org_id: string }
        Returns: boolean
      }
      verify_signup_email: { Args: { check_email: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "vp"
        | "manager"
        | "employee"
        | "supervisor"
        | "line_manager"
      request_status: "pending" | "approved" | "declined"
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
      app_role: [
        "admin",
        "vp",
        "manager",
        "employee",
        "supervisor",
        "line_manager",
      ],
      request_status: ["pending", "approved", "declined"],
    },
  },
} as const
