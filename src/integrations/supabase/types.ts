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
      app_settings: {
        Row: {
          id: boolean
          rental_cars_visible: boolean
          trip_creation_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          rental_cars_visible?: boolean
          trip_creation_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          rental_cars_visible?: boolean
          trip_creation_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cars: {
        Row: {
          acty_type: string | null
          code: string | null
          created_at: string
          description: string | null
          follow_office_id: string | null
          handheld_code: string | null
          id: string
          odometer_broken: boolean
          plate: string
          route_code: string | null
          route_description: string | null
          type: string
        }
        Insert: {
          acty_type?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          follow_office_id?: string | null
          handheld_code?: string | null
          id?: string
          odometer_broken?: boolean
          plate: string
          route_code?: string | null
          route_description?: string | null
          type?: string
        }
        Update: {
          acty_type?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          follow_office_id?: string | null
          handheld_code?: string | null
          id?: string
          odometer_broken?: boolean
          plate?: string
          route_code?: string | null
          route_description?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cars_follow_office_id_fkey"
            columns: ["follow_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          name: string
          sap_number: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sap_number?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sap_number?: string | null
          type?: string
        }
        Relationships: []
      }
      governorates: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      managers: {
        Row: {
          cost_center: string | null
          created_at: string
          id: string
          name: string
          sap_number: string | null
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          id?: string
          name: string
          sap_number?: string | null
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          id?: string
          name?: string
          sap_number?: string | null
        }
        Relationships: []
      }
      offices: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          must_change_password: boolean
          rental_cars_override: boolean | null
          trip_create_override: boolean | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          must_change_password?: boolean
          rental_cars_override?: boolean | null
          trip_create_override?: boolean | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          must_change_password?: boolean
          rental_cars_override?: boolean | null
          trip_create_override?: boolean | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      service_types: {
        Row: {
          created_at: string
          id: string
          name: string
          pmact_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pmact_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pmact_type?: string | null
        }
        Relationships: []
      }
      technicians: {
        Row: {
          created_at: string
          id: string
          name: string
          sap_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sap_number: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sap_number?: string
        }
        Relationships: []
      }
      trip_segments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          odometer: number | null
          photo_url: string | null
          route: string
          sequence: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          odometer?: number | null
          photo_url?: string | null
          route: string
          sequence?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          odometer?: number | null
          photo_url?: string | null
          route?: string
          sequence?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          car_code: string | null
          car_description: string | null
          car_plate: string | null
          car_type: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          created_by_name: string | null
          driver_id: string | null
          driver_name: string | null
          driver_name_rental: string | null
          driver_sap: string | null
          end_at: string | null
          end_odometer: number | null
          end_photo_url: string | null
          estimated_km: number | null
          follow_office_id: string | null
          governorate_id: string | null
          governorate_name: string | null
          handheld_code: string | null
          id: string
          manager_id: string | null
          notes: string | null
          odometer_broken: boolean
          odometer_note: string | null
          odometer_review: string
          office_id: string | null
          route_code: string | null
          route_start: string
          sap_order_no: string | null
          sap_uploaded_at: string | null
          service_type_id: string | null
          start_at: string
          start_odometer: number
          start_photo_url: string
          status: string
          technician_id: string | null
          trip_no: number
          updated_at: string
        }
        Insert: {
          car_code?: string | null
          car_description?: string | null
          car_plate?: string | null
          car_type?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_name_rental?: string | null
          driver_sap?: string | null
          end_at?: string | null
          end_odometer?: number | null
          end_photo_url?: string | null
          estimated_km?: number | null
          follow_office_id?: string | null
          governorate_id?: string | null
          governorate_name?: string | null
          handheld_code?: string | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          odometer_broken?: boolean
          odometer_note?: string | null
          odometer_review?: string
          office_id?: string | null
          route_code?: string | null
          route_start: string
          sap_order_no?: string | null
          sap_uploaded_at?: string | null
          service_type_id?: string | null
          start_at?: string
          start_odometer: number
          start_photo_url: string
          status?: string
          technician_id?: string | null
          trip_no?: number
          updated_at?: string
        }
        Update: {
          car_code?: string | null
          car_description?: string | null
          car_plate?: string | null
          car_type?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_name_rental?: string | null
          driver_sap?: string | null
          end_at?: string | null
          end_odometer?: number | null
          end_photo_url?: string | null
          estimated_km?: number | null
          follow_office_id?: string | null
          governorate_id?: string | null
          governorate_name?: string | null
          handheld_code?: string | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          odometer_broken?: boolean
          odometer_note?: string | null
          odometer_review?: string
          office_id?: string | null
          route_code?: string | null
          route_start?: string
          sap_order_no?: string | null
          sap_uploaded_at?: string | null
          service_type_id?: string | null
          start_at?: string
          start_odometer?: number
          start_photo_url?: string
          status?: string
          technician_id?: string | null
          trip_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_follow_office_id_fkey"
            columns: ["follow_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      user_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          title?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      can_create_trips: { Args: { _user_id: string }; Returns: boolean }
      can_see_rentals: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      last_odometer_for_car: {
        Args: { _car_code?: string; _car_plate?: string }
        Returns: {
          at: string
          reading: number
          trip_no: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
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
      app_role: ["admin", "user", "viewer"],
    },
  },
} as const
