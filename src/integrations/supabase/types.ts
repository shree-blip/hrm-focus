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
          status: string | null
          total_break_minutes: number | null
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
          status?: string | null
          total_break_minutes?: number | null
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
          status?: string | null
          total_break_minutes?: number | null
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
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          income_tax: number | null
          job_title: string | null
          last_name: string
          line_manager_id: string | null
          location: string | null
          manager_id: string | null
          org_id: string | null
          pay_type: string | null
          phone: string | null
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
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          income_tax?: number | null
          job_title?: string | null
          last_name: string
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          org_id?: string | null
          pay_type?: string | null
          phone?: string | null
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
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          income_tax?: number | null
          job_title?: string | null
          last_name?: string
          line_manager_id?: string | null
          location?: string | null
          manager_id?: string | null
          org_id?: string | null
          pay_type?: string | null
          phone?: string | null
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
          department: string | null
          email: string
          first_name: string
          hire_date: string | null
          id: string
          job_title: string | null
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
          department?: string | null
          email: string
          first_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
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
          department?: string | null
          email?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
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
      tasks: {
        Row: {
          assignee_id: string | null
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
          hire_date: string | null
          hourly_rate: number | null
          id: string | null
          income_tax: number | null
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
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          income_tax?: never
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
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          income_tax?: never
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
      auto_clock_out_after_8_hours: { Args: never; Returns: number }
      can_create_employee: { Args: { _user_id: string }; Returns: boolean }
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
      get_employee_id_for_user: { Args: { _user_id: string }; Returns: string }
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
      is_direct_manager: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_line_manager: { Args: { _user_id: string }; Returns: boolean }
      is_org_vp: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_security_monitor: { Args: { _user_id: string }; Returns: boolean }
      mark_signup_used: { Args: { check_email: string }; Returns: boolean }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
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
    },
  },
} as const
