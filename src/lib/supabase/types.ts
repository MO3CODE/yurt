// أنواع TypeScript مولّدة تلقائياً من مشروع Supabase الحقيقي (hnxhtjbprgsmndfsvent)
// عبر: npx supabase gen types typescript --project-id hnxhtjbprgsmndfsvent
// لا تُعدّلها يدوياً — أعد توليدها بعد أي تغيير في supabase/migrations/*.sql

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
      academic_support_requests: {
        Row: {
          admin_notes: string | null
          assigned_to_name: string | null
          assigned_to_profile_id: string | null
          created_at: string
          description: string | null
          id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"]
          student_id: string
          subject: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to_name?: string | null
          assigned_to_profile_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          student_id: string
          subject: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to_name?: string | null
          assigned_to_profile_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          student_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_support_requests_assigned_to_profile_id_fkey"
            columns: ["assigned_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_support_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "academic_support_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "academic_support_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          apartment_id: string | null
          category: string
          created_at: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          student_id: string | null
        }
        Insert: {
          apartment_id?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          student_id?: string | null
        }
        Update: {
          apartment_id?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "alerts_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          capacity: number
          created_at: string
          floor_number: number
          id: string
          name: string
          notes: string | null
          supervisor_id: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          floor_number: number
          id?: string
          name: string
          notes?: string | null
          supervisor_id?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          floor_number?: number
          id?: string
          name?: string
          notes?: string | null
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          note: string | null
          record_date: string
          recorded_by: string | null
          source: Database["public"]["Enums"]["record_source"]
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          record_date: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["record_source"]
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          record_date?: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_entries: {
        Row: {
          course_name: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          location: string | null
          start_time: string
          student_id: string
        }
        Insert: {
          course_name: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          location?: string | null
          start_time: string
          student_id: string
        }
        Update: {
          course_name?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          location?: string | null
          start_time?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "class_schedule_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "class_schedule_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_assignments: {
        Row: {
          created_at: string
          id: string
          photo_url: string | null
          status: Database["public"]["Enums"]["cleaning_status"]
          student_id: string | null
          task_id: string
          verified_at: string | null
          verified_by: string | null
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          student_id?: string | null
          task_id: string
          verified_at?: string | null
          verified_by?: string | null
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          student_id?: string | null
          task_id?: string
          verified_at?: string | null
          verified_by?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "cleaning_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "cleaning_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_assignments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          apartment_id: string | null
          created_at: string
          facility_id: string | null
          id: string
          name: string
          scope: Database["public"]["Enums"]["cleaning_scope"]
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string
          facility_id?: string | null
          id?: string
          name: string
          scope: Database["public"]["Enums"]["cleaning_scope"]
        }
        Update: {
          apartment_id?: string | null
          created_at?: string
          facility_id?: string | null
          id?: string
          name?: string
          scope?: Database["public"]["Enums"]["cleaning_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_response: string | null
          apartment_id: string | null
          attachment_url: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at: string
          description: string
          escalated_at: string | null
          id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          student_id: string | null
          subject: string
          supervisor_response: string | null
        }
        Insert: {
          admin_response?: string | null
          apartment_id?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description: string
          escalated_at?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          student_id?: string | null
          subject: string
          supervisor_response?: string | null
        }
        Update: {
          admin_response?: string | null
          apartment_id?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description?: string
          escalated_at?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          student_id?: string | null
          subject?: string
          supervisor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "complaints_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "complaints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "complaints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          created_at: string
          facility_type: string | null
          floor_number: number | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          facility_type?: string | null
          floor_number?: number | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          facility_type?: string | null
          floor_number?: number | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      facility_issues: {
        Row: {
          created_at: string
          description: string
          facility_id: string
          id: string
          photo_url: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          reported_by: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["facility_issue_status"]
        }
        Insert: {
          created_at?: string
          description: string
          facility_id: string
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reported_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["facility_issue_status"]
        }
        Update: {
          created_at?: string
          description?: string
          facility_id?: string
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reported_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["facility_issue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "facility_issues_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          file_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          report_type: string
          scope_id: string | null
        }
        Insert: {
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          report_type: string
          scope_id?: string | null
        }
        Update: {
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          scope_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          condition_description: string
          created_at: string
          end_date: string | null
          id: string
          needs_followup: boolean
          reported_by: string | null
          severity: Database["public"]["Enums"]["health_severity"]
          start_date: string
          status: Database["public"]["Enums"]["health_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          condition_description: string
          created_at?: string
          end_date?: string | null
          id?: string
          needs_followup?: boolean
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["health_severity"]
          start_date?: string
          status?: Database["public"]["Enums"]["health_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          condition_description?: string
          created_at?: string
          end_date?: string | null
          id?: string
          needs_followup?: boolean
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["health_severity"]
          start_date?: string
          status?: Database["public"]["Enums"]["health_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          notification_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          notification_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          target_apartment_id: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_student_id: string | null
          target_type: Database["public"]["Enums"]["notification_target"]
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_apartment_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_student_id?: string | null
          target_type: Database["public"]["Enums"]["notification_target"]
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_apartment_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_student_id?: string | null
          target_type?: Database["public"]["Enums"]["notification_target"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_apartment_id_fkey"
            columns: ["target_apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "notifications_target_apartment_id_fkey"
            columns: ["target_apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_student_id_fkey"
            columns: ["target_student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "notifications_target_student_id_fkey"
            columns: ["target_student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "notifications_target_student_id_fkey"
            columns: ["target_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      points_entries: {
        Row: {
          category: Database["public"]["Enums"]["points_category"]
          created_at: string
          created_by: string | null
          id: string
          points: number
          reason: string | null
          student_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["points_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          points: number
          reason?: string | null
          student_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["points_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          points?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "points_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "points_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_records: {
        Row: {
          created_at: string
          id: string
          prayer: Database["public"]["Enums"]["prayer_name"]
          record_date: string
          status: Database["public"]["Enums"]["prayer_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prayer: Database["public"]["Enums"]["prayer_name"]
          record_date: string
          status: Database["public"]["Enums"]["prayer_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prayer?: Database["public"]["Enums"]["prayer_name"]
          record_date?: string
          status?: Database["public"]["Enums"]["prayer_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "prayer_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "prayer_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          manage_academic: boolean
          manage_facilities: boolean
          manage_religious: boolean
          manage_reports: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          manage_academic?: boolean
          manage_facilities?: boolean
          manage_religious?: boolean
          manage_reports?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          manage_academic?: boolean
          manage_facilities?: boolean
          manage_religious?: boolean
          manage_reports?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quran_wird_logs: {
        Row: {
          created_at: string
          id: string
          memorization: boolean
          note: string | null
          pages: number | null
          range_description: string | null
          record_date: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memorization?: boolean
          note?: string | null
          pages?: number | null
          range_description?: string | null
          record_date: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memorization?: boolean
          note?: string | null
          pages?: number | null
          range_description?: string | null
          record_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quran_wird_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "quran_wird_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "quran_wird_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string | null
          apartment_id: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          major: string | null
          notes: string | null
          scholarship_reference: string | null
          status: Database["public"]["Enums"]["student_status"]
          university_name: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          apartment_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id: string
          major?: string | null
          notes?: string | null
          scholarship_reference?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          university_name?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          apartment_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          major?: string | null
          notes?: string | null
          scholarship_reference?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          university_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          student_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          student_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "points_leaderboard"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profile_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      apartment_health: {
        Row: {
          apartment_id: string | null
          attendance_score: number | null
          cleaning_score: number | null
          floor_number: number | null
          name: string | null
          open_complaints: number | null
          overall_score: number | null
          prayer_score: number | null
          supervisor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_leaderboard: {
        Row: {
          apartment_id: string | null
          full_name: string | null
          month: string | null
          student_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profile_summary: {
        Row: {
          apartment_id: string | null
          apartment_name: string | null
          full_name: string | null
          major: string | null
          ongoing_health_issues: number | null
          status: Database["public"]["Enums"]["student_status"] | null
          student_id: string | null
          total_absences: number | null
          total_complaints: number | null
          total_points: number | null
          university_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_health"
            referencedColumns: ["apartment_id"]
          },
          {
            foreignKeyName: "students_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_apartment_supervisor: { Args: { apt_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      supervised_apartment_id: { Args: never; Returns: string }
      supervises_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "super_admin" | "admin" | "student"
      attendance_status: "present" | "absent" | "excused" | "late"
      cleaning_scope: "apartment" | "facility"
      cleaning_status: "pending" | "done" | "missed"
      complaint_category: "complaint" | "suggestion"
      complaint_status:
        | "new"
        | "triaged"
        | "in_progress"
        | "escalated"
        | "resolved"
        | "rejected"
      facility_issue_status: "open" | "in_progress" | "resolved"
      health_severity: "mild" | "moderate" | "severe"
      health_status: "ongoing" | "recovered"
      notification_target: "all" | "apartment" | "student" | "role"
      points_category:
        | "prayer"
        | "quran"
        | "attendance"
        | "cleaning"
        | "academic"
        | "other"
      prayer_name: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"
      prayer_status: "mosque" | "prayed" | "missed"
      priority_level: "low" | "medium" | "high" | "urgent"
      record_source: "self" | "supervisor" | "admin"
      student_status: "active" | "on_leave" | "graduated" | "withdrawn"
      support_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
      task_status: "pending" | "done"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      alert_severity: ["info", "warning", "critical"],
      app_role: ["super_admin", "admin", "student"],
      attendance_status: ["present", "absent", "excused", "late"],
      cleaning_scope: ["apartment", "facility"],
      cleaning_status: ["pending", "done", "missed"],
      complaint_category: ["complaint", "suggestion"],
      complaint_status: [
        "new",
        "triaged",
        "in_progress",
        "escalated",
        "resolved",
        "rejected",
      ],
      facility_issue_status: ["open", "in_progress", "resolved"],
      health_severity: ["mild", "moderate", "severe"],
      health_status: ["ongoing", "recovered"],
      notification_target: ["all", "apartment", "student", "role"],
      points_category: [
        "prayer",
        "quran",
        "attendance",
        "cleaning",
        "academic",
        "other",
      ],
      prayer_name: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
      prayer_status: ["mosque", "prayed", "missed"],
      priority_level: ["low", "medium", "high", "urgent"],
      record_source: ["self", "supervisor", "admin"],
      student_status: ["active", "on_leave", "graduated", "withdrawn"],
      support_status: ["open", "assigned", "in_progress", "resolved", "closed"],
      task_status: ["pending", "done"],
    },
  },
} as const

// ----------------------------------------------------------------------------
// اختصارات مريحة تُستخدم في كل أنحاء التطبيق (تُشتق من الأنواع المولّدة أعلاه)
// ----------------------------------------------------------------------------
export type AppRole = Database["public"]["Enums"]["app_role"]
export type StudentStatus = Database["public"]["Enums"]["student_status"]
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"]
export type RecordSource = Database["public"]["Enums"]["record_source"]
export type PrayerName = Database["public"]["Enums"]["prayer_name"]
export type PrayerStatus = Database["public"]["Enums"]["prayer_status"]
export type HealthSeverity = Database["public"]["Enums"]["health_severity"]
export type HealthStatus = Database["public"]["Enums"]["health_status"]
export type SupportStatus = Database["public"]["Enums"]["support_status"]
export type ComplaintCategory = Database["public"]["Enums"]["complaint_category"]
export type ComplaintStatus = Database["public"]["Enums"]["complaint_status"]
export type CleaningScope = Database["public"]["Enums"]["cleaning_scope"]
export type CleaningStatus = Database["public"]["Enums"]["cleaning_status"]
export type FacilityIssueStatus = Database["public"]["Enums"]["facility_issue_status"]
export type PriorityLevel = Database["public"]["Enums"]["priority_level"]
export type NotificationTarget = Database["public"]["Enums"]["notification_target"]
export type TaskStatus = Database["public"]["Enums"]["task_status"]
export type PointsCategory = Database["public"]["Enums"]["points_category"]
export type AlertSeverity = Database["public"]["Enums"]["alert_severity"]
