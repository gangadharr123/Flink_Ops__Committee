// Database types in the format of `supabase gen types typescript`.
// Generated from supabase/migrations. Don't edit by hand: after changing the
// schema, regenerate with `npm run db:types` (see README).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      hubs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      issue_updates: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          note: string | null
          state: Database["public"]["Enums"]["issue_update_state"]
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          note?: string | null
          state: Database["public"]["Enums"]["issue_update_state"]
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          note?: string | null
          state?: Database["public"]["Enums"]["issue_update_state"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_updates_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_updates_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          category: Database["public"]["Enums"]["issue_category"]
          created_at: string
          description: string | null
          exclude_from_outputs: boolean
          first_seen_visit_id: string | null
          hub_id: string
          id: string
          issue_key: string
          resolved_visit_id: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          exclude_from_outputs?: boolean
          first_seen_visit_id?: string | null
          hub_id: string
          id?: string
          issue_key: string
          resolved_visit_id?: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          exclude_from_outputs?: boolean
          first_seen_visit_id?: string | null
          hub_id?: string
          id?: string
          issue_key?: string
          resolved_visit_id?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_first_seen_visit_id_fkey"
            columns: ["first_seen_visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_visit_id_fkey"
            columns: ["resolved_visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          issue_id: string | null
          storage_path: string
          visit_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          issue_id?: string | null
          storage_path: string
          visit_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          issue_id?: string | null
          storage_path?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shelf_checks: {
        Row: {
          comment: string | null
          condition: Database["public"]["Enums"]["shelf_condition"]
          created_at: string
          id: string
          score_5: number | null
          shelf_id: string
          visit_id: string
        }
        Insert: {
          comment?: string | null
          condition: Database["public"]["Enums"]["shelf_condition"]
          created_at?: string
          id?: string
          score_5?: number | null
          shelf_id: string
          visit_id: string
        }
        Update: {
          comment?: string | null
          condition?: Database["public"]["Enums"]["shelf_condition"]
          created_at?: string
          id?: string
          score_5?: number | null
          shelf_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_checks_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_checks_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      shelves: {
        Row: {
          created_at: string
          hub_id: string
          id: string
          note: string | null
          number: number
          zone: Database["public"]["Enums"]["shelf_zone"]
          zone_confidence: Database["public"]["Enums"]["zone_confidence"]
        }
        Insert: {
          created_at?: string
          hub_id: string
          id?: string
          note?: string | null
          number: number
          zone?: Database["public"]["Enums"]["shelf_zone"]
          zone_confidence?: Database["public"]["Enums"]["zone_confidence"]
        }
        Update: {
          created_at?: string
          hub_id?: string
          id?: string
          note?: string | null
          number?: number
          zone?: Database["public"]["Enums"]["shelf_zone"]
          zone_confidence?: Database["public"]["Enums"]["zone_confidence"]
        }
        Relationships: [
          {
            foreignKeyName: "shelves_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_feedback: {
        Row: {
          created_at: string
          id: string
          points: string | null
          returning: boolean
          staff_role: Database["public"]["Enums"]["staff_role"]
          tenure_note: string | null
          topics: string[]
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: string | null
          returning?: boolean
          staff_role: Database["public"]["Enums"]["staff_role"]
          tenure_note?: string | null
          topics?: string[]
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: string | null
          returning?: boolean
          staff_role?: Database["public"]["Enums"]["staff_role"]
          tenure_note?: string | null
          topics?: string[]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_feedback_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          created_at: string
          current_step: Database["public"]["Enums"]["visit_step"]
          date_is_placeholder: boolean
          hub_id: string
          id: string
          inspector_id: string
          label: string | null
          manager_present: boolean | null
          notes: string | null
          overall_impression: string | null
          previous_visit_id: string | null
          status: Database["public"]["Enums"]["visit_status"]
          submitted_at: string | null
          updated_at: string
          visit_date: string
          visit_number: number
        }
        Insert: {
          created_at?: string
          current_step?: Database["public"]["Enums"]["visit_step"]
          date_is_placeholder?: boolean
          hub_id: string
          id?: string
          inspector_id?: string
          label?: string | null
          manager_present?: boolean | null
          notes?: string | null
          overall_impression?: string | null
          previous_visit_id?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          submitted_at?: string | null
          updated_at?: string
          visit_date: string
          visit_number: number
        }
        Update: {
          created_at?: string
          current_step?: Database["public"]["Enums"]["visit_step"]
          date_is_placeholder?: boolean
          hub_id?: string
          id?: string
          inspector_id?: string
          label?: string | null
          manager_present?: boolean | null
          notes?: string | null
          overall_impression?: string | null
          previous_visit_id?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          submitted_at?: string | null
          updated_at?: string
          visit_date?: string
          visit_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "visits_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_previous_visit_id_fkey"
            columns: ["previous_visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      issue_stats: {
        Row: {
          days_open: number | null
          first_seen_date: string | null
          is_recurring: boolean | null
          issue_id: string | null
          last_seen_date: string | null
          resolved_date: string | null
          visits_seen: number | null
        }
        Relationships: []
      }
      staff_topics: {
        Row: {
          topic: string | null
          uses: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_edit_visits: { Args: never; Returns: boolean }
      create_issue: { Args: { p_visit_id: string; p_category: Database["public"]["Enums"]["issue_category"]; p_title: string; p_severity: Database["public"]["Enums"]["issue_severity"]; p_description?: string }; Returns: string }
      create_visit: { Args: { p_hub_id: string; p_visit_date: string }; Returns: string }
      current_user_role: { Args: never; Returns: Database["public"]["Enums"]["user_role"] }
      is_admin: { Args: never; Returns: boolean }
      recurring_min_visits: { Args: never; Returns: number }
      safe_uuid: { Args: { p_text: string }; Returns: string }
      visit_is_editable: { Args: { p_visit_id: string }; Returns: boolean }
    }
    Enums: {
      issue_category:
        | "ac_leaks"
        | "app_routing"
        | "batteries_chargers"
        | "bike_room"
        | "floor"
        | "fridge_freezer_equipment"
        | "other"
        | "process"
        | "rider_safety_gear"
        | "riders_room"
        | "shelf_hygiene"
        | "staff_welfare"
        | "water_filter"
      issue_severity:
        | "low"
        | "medium"
        | "high"
        | "immediate"
      issue_status:
        | "open"
        | "resolved"
      issue_update_state:
        | "new"
        | "still_open"
        | "improved"
        | "resolved"
      shelf_condition:
        | "clean"
        | "minor_dust"
        | "dusty"
        | "mould"
        | "damaged"
      shelf_zone:
        | "ambient"
        | "fridge"
        | "freezer"
        | "dry"
        | "other"
      staff_role:
        | "picker"
        | "rider"
        | "shift_lead"
        | "manager"
        | "other"
      user_role:
        | "inspector"
        | "viewer"
        | "admin"
      visit_status:
        | "draft"
        | "submitted"
      visit_step:
        | "shelves"
        | "issues"
        | "staff"
        | "summary"
      zone_confidence:
        | "confirmed"
        | "assumed"
        | "check"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      issue_category: ["ac_leaks", "app_routing", "batteries_chargers", "bike_room", "floor", "fridge_freezer_equipment", "other", "process", "rider_safety_gear", "riders_room", "shelf_hygiene", "staff_welfare", "water_filter"],
      issue_severity: ["low", "medium", "high", "immediate"],
      issue_status: ["open", "resolved"],
      issue_update_state: ["new", "still_open", "improved", "resolved"],
      shelf_condition: ["clean", "minor_dust", "dusty", "mould", "damaged"],
      shelf_zone: ["ambient", "fridge", "freezer", "dry", "other"],
      staff_role: ["picker", "rider", "shift_lead", "manager", "other"],
      user_role: ["inspector", "viewer", "admin"],
      visit_status: ["draft", "submitted"],
      visit_step: ["shelves", "issues", "staff", "summary"],
      zone_confidence: ["confirmed", "assumed", "check"],
    },
  },
} as const
