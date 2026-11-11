
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "allowed_emails": {
                  Row: {
                    "created_at": string,"email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "color": string,"created_at": string,"group_type": Database["public"]['Enums']["category_group"],"household_id": string,"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color": string,"created_at"?: string,"group_type"?: Database["public"]['Enums']["category_group"],"household_id": string,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"group_type"?: Database["public"]['Enums']["category_group"],"household_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"household_id": string,"role": Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"role"?: Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"role"?: Database["public"]['Enums']["household_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"job_runs": {
                  Row: {
                    "detail": string | null,"finished_at": string | null,"id": string,"job": string,"started_at": string,"status": Database["public"]['Enums']["job_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "detail"?: string | null,"finished_at"?: string | null,"id"?: string,"job": string,"started_at": string,"status": Database["public"]['Enums']["job_status"]
                  }
                  Update: {
                    "detail"?: string | null,"finished_at"?: string | null,"id"?: string,"job"?: string,"started_at"?: string,"status"?: Database["public"]['Enums']["job_status"]
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "amount": number,"billing_cycle": Database["public"]['Enums']["billing_cycle"],"billing_rule": NonNullable<Json>,"category_id": string | null,"created_at": string,"currency": string,"end_date": string | null,"household_id": string,"id": string,"is_manual_purchase": boolean,"is_variable": boolean,"last_used_at": string | null,"memo": string | null,"name": string,"next_billing_date": string,"notify_days_before": number,"resume_date": string | null,"started_at": string | null,"status": Database["public"]['Enums']["subscription_status"],"trial_end_date": string | null,"updated_at": string,"url": string | null,"usage_frequency": Database["public"]['Enums']["usage_frequency"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"billing_cycle": Database["public"]['Enums']["billing_cycle"],"billing_rule": NonNullable<Json>,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"end_date"?: string | null,"household_id": string,"id"?: string,"is_manual_purchase"?: boolean,"is_variable"?: boolean,"last_used_at"?: string | null,"memo"?: string | null,"name": string,"next_billing_date": string,"notify_days_before"?: number,"resume_date"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"trial_end_date"?: string | null,"updated_at"?: string,"url"?: string | null,"usage_frequency"?: Database["public"]['Enums']["usage_frequency"] | null
                  }
                  Update: {
                    "amount"?: number,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"billing_rule"?: NonNullable<Json>,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"end_date"?: string | null,"household_id"?: string,"id"?: string,"is_manual_purchase"?: boolean,"is_variable"?: boolean,"last_used_at"?: string | null,"memo"?: string | null,"name"?: string,"next_billing_date"?: string,"notify_days_before"?: number,"resume_date"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"trial_end_date"?: string | null,"updated_at"?: string,"url"?: string | null,"usage_frequency"?: Database["public"]['Enums']["usage_frequency"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_category_id_household_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "subscriptions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"is_household_member":
{ Args: { "target_household_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "billing_cycle": "monthly"|"yearly"|"weekly"|"other","category_group": "fixed"|"variable","household_role": "owner"|"member","job_status": "success"|"failed","subscription_status": "active"|"considering"|"cancel_scheduled"|"paused"|"cancelled","usage_frequency": "often"|"sometimes"|"rarely"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "billing_cycle": ["monthly", "yearly", "weekly", "other"],"category_group": ["fixed", "variable"],"household_role": ["owner", "member"],"job_status": ["success", "failed"],"subscription_status": ["active", "considering", "cancel_scheduled", "paused", "cancelled"],"usage_frequency": ["often", "sometimes", "rarely"]
          }
        }
} as const
