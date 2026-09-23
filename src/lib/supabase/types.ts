// أنواع TypeScript مطابقة لمخطط قاعدة البيانات في supabase/migrations.
// بعد ربط مشروع Supabase الحقيقي، يُفضّل توليدها تلقائياً عبر:
//   npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/supabase/types.ts
// هذا الملف مكتوب يدوياً ليطابق المخطط الحالي كنقطة بداية آمنة.

export type AppRole = "super_admin" | "admin" | "student";
export type StudentStatus = "active" | "on_leave" | "graduated" | "withdrawn";
export type AttendanceStatus = "present" | "absent" | "excused" | "late";
export type RecordSource = "self" | "supervisor" | "admin";
export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerStatus = "mosque" | "prayed" | "missed";
export type HealthSeverity = "mild" | "moderate" | "severe";
export type HealthStatus = "ongoing" | "recovered";
export type SupportStatus = "open" | "assigned" | "in_progress" | "resolved" | "closed";
export type ComplaintCategory = "complaint" | "suggestion";
export type ComplaintStatus = "new" | "triaged" | "in_progress" | "escalated" | "resolved" | "rejected";
export type CleaningScope = "apartment" | "facility";
export type CleaningStatus = "pending" | "done" | "missed";
export type FacilityIssueStatus = "open" | "in_progress" | "resolved";
export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type NotificationTarget = "all" | "apartment" | "student" | "role";
export type TaskStatus = "pending" | "done";
export type PointsCategory = "prayer" | "quran" | "attendance" | "cleaning" | "academic" | "other";
export type AlertSeverity = "info" | "warning" | "critical";

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update = Partial<Insert>, Relationships extends readonly Rel[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type ViewTable<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: AppRole;
          manage_academic: boolean;
          manage_religious: boolean;
          manage_facilities: boolean;
          manage_reports: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: AppRole;
          manage_academic?: boolean;
          manage_religious?: boolean;
          manage_facilities?: boolean;
          manage_reports?: boolean;
        }
      >;
      apartments: Table<
        {
          id: string;
          floor_number: number;
          name: string;
          supervisor_id: string | null;
          capacity: number;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          floor_number: number;
          name: string;
          supervisor_id?: string | null;
          capacity?: number;
          notes?: string | null;
        },
        Partial<{
          id: string;
          floor_number: number;
          name: string;
          supervisor_id: string | null;
          capacity: number;
          notes: string | null;
        }>,
        [
          {
            foreignKeyName: "apartments_supervisor_id_fkey";
            columns: ["supervisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      students: Table<
        {
          id: string;
          apartment_id: string | null;
          university_name: string | null;
          major: string | null;
          academic_year: string | null;
          scholarship_reference: string | null;
          status: StudentStatus;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          apartment_id?: string | null;
          university_name?: string | null;
          major?: string | null;
          academic_year?: string | null;
          scholarship_reference?: string | null;
          status?: StudentStatus;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          notes?: string | null;
        },
        Partial<{
          id: string;
          apartment_id: string | null;
          university_name: string | null;
          major: string | null;
          academic_year: string | null;
          scholarship_reference: string | null;
          status: StudentStatus;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          notes: string | null;
        }>,
        [
          {
            foreignKeyName: "students_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_apartment_id_fkey";
            columns: ["apartment_id"];
            isOneToOne: false;
            referencedRelation: "apartments";
            referencedColumns: ["id"];
          },
        ]
      >;
      class_schedule_entries: Table<
        {
          id: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          course_name: string;
          location: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          course_name: string;
          location?: string | null;
        }
      >;
      tasks: Table<
        {
          id: string;
          student_id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          status: TaskStatus;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          status?: TaskStatus;
        }
      >;
      attendance_records: Table<
        {
          id: string;
          student_id: string;
          record_date: string;
          status: AttendanceStatus;
          source: RecordSource;
          note: string | null;
          recorded_by: string | null;
          approved_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          record_date: string;
          status: AttendanceStatus;
          source?: RecordSource;
          note?: string | null;
          recorded_by?: string | null;
          approved_by?: string | null;
        }
      >;
      prayer_records: Table<
        {
          id: string;
          student_id: string;
          record_date: string;
          prayer: PrayerName;
          status: PrayerStatus;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          record_date: string;
          prayer: PrayerName;
          status: PrayerStatus;
        }
      >;
      quran_wird_logs: Table<
        {
          id: string;
          student_id: string;
          record_date: string;
          range_description: string | null;
          pages: number | null;
          memorization: boolean;
          note: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          record_date: string;
          range_description?: string | null;
          pages?: number | null;
          memorization?: boolean;
          note?: string | null;
        }
      >;
      health_records: Table<
        {
          id: string;
          student_id: string;
          reported_by: string | null;
          start_date: string;
          end_date: string | null;
          condition_description: string;
          severity: HealthSeverity;
          status: HealthStatus;
          needs_followup: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          student_id: string;
          reported_by?: string | null;
          start_date?: string;
          end_date?: string | null;
          condition_description: string;
          severity?: HealthSeverity;
          status?: HealthStatus;
          needs_followup?: boolean;
        },
        Partial<{
          id: string;
          student_id: string;
          reported_by: string | null;
          start_date: string;
          end_date: string | null;
          condition_description: string;
          severity: HealthSeverity;
          status: HealthStatus;
          needs_followup: boolean;
        }>,
        [
          {
            foreignKeyName: "health_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ]
      >;
      academic_support_requests: Table<
        {
          id: string;
          student_id: string;
          subject: string;
          description: string | null;
          status: SupportStatus;
          assigned_to_name: string | null;
          assigned_to_profile_id: string | null;
          admin_notes: string | null;
          created_at: string;
          resolved_at: string | null;
        },
        {
          id?: string;
          student_id: string;
          subject: string;
          description?: string | null;
          status?: SupportStatus;
          assigned_to_name?: string | null;
          assigned_to_profile_id?: string | null;
          admin_notes?: string | null;
          resolved_at?: string | null;
        },
        Partial<{
          id: string;
          student_id: string;
          subject: string;
          description: string | null;
          status: SupportStatus;
          assigned_to_name: string | null;
          assigned_to_profile_id: string | null;
          admin_notes: string | null;
          resolved_at: string | null;
        }>,
        [
          {
            foreignKeyName: "academic_support_requests_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ]
      >;
      complaints: Table<
        {
          id: string;
          student_id: string | null;
          apartment_id: string | null;
          category: ComplaintCategory;
          subject: string;
          description: string;
          status: ComplaintStatus;
          attachment_url: string | null;
          supervisor_response: string | null;
          admin_response: string | null;
          escalated_at: string | null;
          resolved_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id?: string | null;
          apartment_id?: string | null;
          category?: ComplaintCategory;
          subject: string;
          description: string;
          status?: ComplaintStatus;
          attachment_url?: string | null;
          supervisor_response?: string | null;
          admin_response?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
        },
        Partial<{
          id: string;
          student_id: string | null;
          apartment_id: string | null;
          category: ComplaintCategory;
          subject: string;
          description: string;
          status: ComplaintStatus;
          attachment_url: string | null;
          supervisor_response: string | null;
          admin_response: string | null;
          escalated_at: string | null;
          resolved_at: string | null;
        }>,
        [
          {
            foreignKeyName: "complaints_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "complaints_apartment_id_fkey";
            columns: ["apartment_id"];
            isOneToOne: false;
            referencedRelation: "apartments";
            referencedColumns: ["id"];
          },
        ]
      >;
      facilities: Table<
        {
          id: string;
          name: string;
          facility_type: string | null;
          floor_number: number | null;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          name: string;
          facility_type?: string | null;
          floor_number?: number | null;
          notes?: string | null;
        }
      >;
      cleaning_tasks: Table<
        {
          id: string;
          scope: CleaningScope;
          apartment_id: string | null;
          facility_id: string | null;
          name: string;
          created_at: string;
        },
        {
          id?: string;
          scope: CleaningScope;
          apartment_id?: string | null;
          facility_id?: string | null;
          name: string;
        }
      >;
      cleaning_assignments: Table<
        {
          id: string;
          task_id: string;
          student_id: string | null;
          week_start_date: string;
          status: CleaningStatus;
          photo_url: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          task_id: string;
          student_id?: string | null;
          week_start_date: string;
          status?: CleaningStatus;
          photo_url?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
        }
      >;
      facility_issues: Table<
        {
          id: string;
          facility_id: string;
          reported_by: string | null;
          description: string;
          status: FacilityIssueStatus;
          priority: PriorityLevel;
          photo_url: string | null;
          resolved_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          facility_id: string;
          reported_by?: string | null;
          description: string;
          status?: FacilityIssueStatus;
          priority?: PriorityLevel;
          photo_url?: string | null;
          resolved_at?: string | null;
        },
        Partial<{
          id: string;
          facility_id: string;
          reported_by: string | null;
          description: string;
          status: FacilityIssueStatus;
          priority: PriorityLevel;
          photo_url: string | null;
          resolved_at: string | null;
        }>,
        [
          {
            foreignKeyName: "facility_issues_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ]
      >;
      notifications: Table<
        {
          id: string;
          title: string;
          body: string;
          target_type: NotificationTarget;
          target_apartment_id: string | null;
          target_student_id: string | null;
          target_role: AppRole | null;
          created_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          title: string;
          body: string;
          target_type: NotificationTarget;
          target_apartment_id?: string | null;
          target_student_id?: string | null;
          target_role?: AppRole | null;
          created_by?: string | null;
        },
        Partial<{
          id: string;
          title: string;
          body: string;
          target_type: NotificationTarget;
          target_apartment_id: string | null;
          target_student_id: string | null;
          target_role: AppRole | null;
          created_by: string | null;
        }>,
        [
          {
            foreignKeyName: "notifications_target_apartment_id_fkey";
            columns: ["target_apartment_id"];
            isOneToOne: false;
            referencedRelation: "apartments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_target_student_id_fkey";
            columns: ["target_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ]
      >;
      notification_reads: Table<
        { notification_id: string; profile_id: string; read_at: string },
        { notification_id: string; profile_id: string; read_at?: string }
      >;
      push_subscriptions: Table<
        {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at: string;
        },
        {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
        }
      >;
      points_entries: Table<
        {
          id: string;
          student_id: string;
          category: PointsCategory;
          points: number;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          category: PointsCategory;
          points: number;
          reason?: string | null;
          created_by?: string | null;
        }
      >;
      alerts: Table<
        {
          id: string;
          student_id: string | null;
          apartment_id: string | null;
          severity: AlertSeverity;
          category: string;
          message: string;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          student_id?: string | null;
          apartment_id?: string | null;
          severity?: AlertSeverity;
          category: string;
          message: string;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
        },
        Partial<{
          id: string;
          student_id: string | null;
          apartment_id: string | null;
          severity: AlertSeverity;
          category: string;
          message: string;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
        }>,
        [
          {
            foreignKeyName: "alerts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_apartment_id_fkey";
            columns: ["apartment_id"];
            isOneToOne: false;
            referencedRelation: "apartments";
            referencedColumns: ["id"];
          },
        ]
      >;
      generated_reports: Table<
        {
          id: string;
          report_type: string;
          scope_id: string | null;
          period_start: string;
          period_end: string;
          file_url: string | null;
          generated_by: string | null;
          generated_at: string;
        },
        {
          id?: string;
          report_type: string;
          scope_id?: string | null;
          period_start: string;
          period_end: string;
          file_url?: string | null;
          generated_by?: string | null;
        }
      >;
    };
    Views: {
      apartment_health: ViewTable<{
        apartment_id: string;
        name: string;
        floor_number: number;
        supervisor_id: string | null;
        cleaning_score: number;
        prayer_score: number;
        attendance_score: number;
        open_complaints: number;
        overall_score: number;
      }>;
      points_leaderboard: ViewTable<{
        student_id: string;
        full_name: string;
        apartment_id: string | null;
        month: string;
        total_points: number;
      }>;
      student_profile_summary: ViewTable<{
        student_id: string;
        full_name: string;
        apartment_id: string | null;
        apartment_name: string | null;
        university_name: string | null;
        major: string | null;
        status: StudentStatus;
        total_absences: number;
        total_complaints: number;
        total_points: number;
        ongoing_health_issues: number;
      }>;
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      student_status: StudentStatus;
      attendance_status: AttendanceStatus;
      prayer_status: PrayerStatus;
      complaint_status: ComplaintStatus;
    };
  };
}
