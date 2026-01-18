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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      Admin_mail: {
        Row: {
          created_at: string
          email: string | null
          id: number
          name: string | null
          password: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          name?: string | null
          password?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          name?: string | null
          password?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          function: string | null
          id: string
          name: string
          phone: string | null
          role: string
          updated_at: string | null
          vessel_name: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          function?: string | null
          id?: string
          name: string
          phone?: string | null
          role: string
          updated_at?: string | null
          vessel_name?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          function?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      curacao_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          keywords: string[] | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id: string
          keywords?: string[] | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          keywords?: string[] | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email: {
        Row: {
          body: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string
          detected_location: string | null
          doc_link: string | null
          dock_link_2: string | null
          "Email Type": string | null
          email_to_person: string
          eta: string | null
          "Google sheet url": string | null
          id: number
          imo: string | null
          missing_information: string | null
          original_email: string | null
          orignal_email: string | null
          pdf_url: string | null
          port: string | null
          sent_at: string | null
          services_requested: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          vessel_name: string | null
        }
        Insert: {
          body?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          detected_location?: string | null
          doc_link?: string | null
          dock_link_2?: string | null
          "Email Type"?: string | null
          email_to_person: string
          eta?: string | null
          "Google sheet url"?: string | null
          id?: number
          imo?: string | null
          missing_information?: string | null
          original_email?: string | null
          orignal_email?: string | null
          pdf_url?: string | null
          port?: string | null
          sent_at?: string | null
          services_requested?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          vessel_name?: string | null
        }
        Update: {
          body?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          detected_location?: string | null
          doc_link?: string | null
          dock_link_2?: string | null
          "Email Type"?: string | null
          email_to_person?: string
          eta?: string | null
          "Google sheet url"?: string | null
          id?: number
          imo?: string | null
          missing_information?: string | null
          original_email?: string | null
          orignal_email?: string | null
          pdf_url?: string | null
          port?: string | null
          sent_at?: string | null
          services_requested?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          created_at: string
          email_id: number
          file_name: string
          file_path: string
          file_size: number | null
          id: string
        }
        Insert: {
          created_at?: string
          email_id: number
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
        }
        Update: {
          created_at?: string
          email_id?: number
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "email"
            referencedColumns: ["id"]
          },
        ]
      }
      fda_invoices: {
        Row: {
          created_at: string
          fda_project_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          invoice_number: string | null
        }
        Insert: {
          created_at?: string
          fda_project_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          invoice_number?: string | null
        }
        Update: {
          created_at?: string
          fda_project_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          invoice_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fda_invoices_fda_project_id_fkey"
            columns: ["fda_project_id"]
            isOneToOne: false
            referencedRelation: "fda_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fda_projects: {
        Row: {
          billing_address: string | null
          billing_company: string | null
          billing_email: string | null
          billing_phone: string | null
          client: string | null
          client_email: string | null
          client_phone: string | null
          created_at: string
          fda_responsible: string | null
          id: string
          lbh_number: string
          sent_at: string | null
          ship_name: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client?: string | null
          client_email?: string | null
          client_phone?: string | null
          created_at?: string
          fda_responsible?: string | null
          id?: string
          lbh_number: string
          sent_at?: string | null
          ship_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client?: string | null
          client_email?: string | null
          client_phone?: string | null
          created_at?: string
          fda_responsible?: string | null
          id?: string
          lbh_number?: string
          sent_at?: string | null
          ship_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          type: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      linksss: {
        Row: {
          created_at: string
          "Email 1": string | null
          id: number
          supabase_id: number | null
        }
        Insert: {
          created_at?: string
          "Email 1"?: string | null
          id?: number
          supabase_id?: number | null
        }
        Update: {
          created_at?: string
          "Email 1"?: string | null
          id?: number
          supabase_id?: number | null
        }
        Relationships: []
      }
      manual_emails: {
        Row: {
          agent_type: string
          area: string | null
          body: string | null
          cargo_quantity: number | null
          cargo_type: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          dwt: number | null
          email_content: string
          error_message: string | null
          facility: string | null
          flag: string | null
          grt: number | null
          id: number
          imo: string | null
          loa: number | null
          operation_type: string | null
          pda_link_1: string | null
          pda_link_2: string | null
          pdf_count: number | null
          pdf_path: string | null
          port: string | null
          port_stay: number | null
          status: string | null
          subject: string | null
          terminal: string | null
          tugs: number | null
          vessel_name: string | null
        }
        Insert: {
          agent_type: string
          area?: string | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          dwt?: number | null
          email_content: string
          error_message?: string | null
          facility?: string | null
          flag?: string | null
          grt?: number | null
          id?: number
          imo?: string | null
          loa?: number | null
          operation_type?: string | null
          pda_link_1?: string | null
          pda_link_2?: string | null
          pdf_count?: number | null
          pdf_path?: string | null
          port?: string | null
          port_stay?: number | null
          status?: string | null
          subject?: string | null
          terminal?: string | null
          tugs?: number | null
          vessel_name?: string | null
        }
        Update: {
          agent_type?: string
          area?: string | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          dwt?: number | null
          email_content?: string
          error_message?: string | null
          facility?: string | null
          flag?: string | null
          grt?: number | null
          id?: number
          imo?: string | null
          loa?: number | null
          operation_type?: string | null
          pda_link_1?: string | null
          pda_link_2?: string | null
          pdf_count?: number | null
          pdf_path?: string | null
          port?: string | null
          port_stay?: number | null
          status?: string | null
          subject?: string | null
          terminal?: string | null
          tugs?: number | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      pdf_documents: {
        Row: {
          category: string | null
          content_json: Json | null
          content_text: string | null
          content_tsv: unknown
          file_size: number | null
          filename: string
          id: string
          metadata: Json
          mime_type: string
          source: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          category?: string | null
          content_json?: Json | null
          content_text?: string | null
          content_tsv?: unknown
          file_size?: number | null
          filename: string
          id?: string
          metadata?: Json
          mime_type?: string
          source?: string | null
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          category?: string | null
          content_json?: Json | null
          content_text?: string | null
          content_tsv?: unknown
          file_size?: number | null
          filename?: string
          id?: string
          metadata?: Json
          mime_type?: string
          source?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          language: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          language?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          language?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      Proposal: {
        Row: {
          created_at: string
          "Data-Proposal": string | null
          id: number
        }
        Insert: {
          created_at?: string
          "Data-Proposal"?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          "Data-Proposal"?: string | null
          id?: number
        }
        Relationships: []
      }
      vessels: {
        Row: {
          beam_m: number | null
          created_at: string
          draft_m: number | null
          dwt_mt: number | null
          flag: string | null
          gross_tonnage: number | null
          id: string
          imo_number: string
          loa_m: number | null
          name: string
          owner: string | null
          status: string
          vessel_type: string
          year_built: number | null
        }
        Insert: {
          beam_m?: number | null
          created_at?: string
          draft_m?: number | null
          dwt_mt?: number | null
          flag?: string | null
          gross_tonnage?: number | null
          id?: string
          imo_number: string
          loa_m?: number | null
          name: string
          owner?: string | null
          status?: string
          vessel_type: string
          year_built?: number | null
        }
        Update: {
          beam_m?: number | null
          created_at?: string
          draft_m?: number | null
          dwt_mt?: number | null
          flag?: string | null
          gross_tonnage?: number | null
          id?: string
          imo_number?: string
          loa_m?: number | null
          name?: string
          owner?: string | null
          status?: string
          vessel_type?: string
          year_built?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_by_keyword: {
        Args: { keyword_text: string }
        Returns: {
          category: string
          content: string
          id: string
          topic: string
        }[]
      }
      search_curacao_knowledge: {
        Args: { search_term: string }
        Returns: {
          category: string
          content: string
          id: string
          relevance_score: number
          topic: string
        }[]
      }
    }
    Enums: {
      email_status: "draft" | "sent" | "rejected" | "approved"
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
      email_status: ["draft", "sent", "rejected", "approved"],
    },
  },
} as const
