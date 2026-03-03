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
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_email: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      calculation_configs: {
        Row: {
          change_description: string | null
          changed_by: string | null
          config_data: Json
          config_name: string | null
          config_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          version: number
        }
        Insert: {
          change_description?: string | null
          changed_by?: string | null
          config_data: Json
          config_name?: string | null
          config_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          version: number
        }
        Update: {
          change_description?: string | null
          changed_by?: string | null
          config_data?: Json
          config_name?: string | null
          config_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          version?: number
        }
        Relationships: []
      }
      cargo_agent_knowledge: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          keywords: string[] | null
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: never
          keywords?: string[] | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: never
          keywords?: string[] | null
          metadata?: Json | null
        }
        Relationships: []
      }
      cargo_agent_knowledge_old: {
        Row: {
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          keywords: string[]
          metadata: Json | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id: string
          keywords: string[]
          metadata?: Json | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          keywords?: string[]
          metadata?: Json | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cargo_kb_embeddings: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
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
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Relationships: []
      }
      curacao_knowledge_old: {
        Row: {
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          keywords: string[] | null
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email: {
        Row: {
          bcc_recipients: string[] | null
          body: string | null
          cargo_quantity: number | null
          cargo_type: string | null
          cc_recipients: string[] | null
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
          terminal: string | null
          vessel_2_eta: string | null
          vessel_2_flag: string | null
          vessel_2_grt: number | null
          vessel_2_imo: string | null
          vessel_2_loa: number | null
          vessel_2_name: string | null
          vessel_eta: string | null
          vessel_flag: string | null
          vessel_grt: number | null
          vessel_imo: string | null
          vessel_loa: number | null
          vessel_name: string | null
        }
        Insert: {
          bcc_recipients?: string[] | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          cc_recipients?: string[] | null
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
          terminal?: string | null
          vessel_2_eta?: string | null
          vessel_2_flag?: string | null
          vessel_2_grt?: number | null
          vessel_2_imo?: string | null
          vessel_2_loa?: number | null
          vessel_2_name?: string | null
          vessel_eta?: string | null
          vessel_flag?: string | null
          vessel_grt?: number | null
          vessel_imo?: string | null
          vessel_loa?: number | null
          vessel_name?: string | null
        }
        Update: {
          bcc_recipients?: string[] | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          cc_recipients?: string[] | null
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
          terminal?: string | null
          vessel_2_eta?: string | null
          vessel_2_flag?: string | null
          vessel_2_grt?: number | null
          vessel_2_imo?: string | null
          vessel_2_loa?: number | null
          vessel_2_name?: string | null
          vessel_eta?: string | null
          vessel_flag?: string | null
          vessel_grt?: number | null
          vessel_imo?: string | null
          vessel_loa?: number | null
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
      email_pda_records: {
        Row: {
          created_at: string | null
          email_id: string | null
          extracted_vessels: Json | null
          extraction_status: string | null
          from_email: string | null
          id: string
          is_manual_creation: boolean | null
          pda_completed: boolean | null
          pda_data: Json | null
          pda_response_sent: boolean | null
          processed_by: string | null
          received_at: string | null
          subject: string | null
          to_email: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_id?: string | null
          extracted_vessels?: Json | null
          extraction_status?: string | null
          from_email?: string | null
          id?: string
          is_manual_creation?: boolean | null
          pda_completed?: boolean | null
          pda_data?: Json | null
          pda_response_sent?: boolean | null
          processed_by?: string | null
          received_at?: string | null
          subject?: string | null
          to_email?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_id?: string | null
          extracted_vessels?: Json | null
          extraction_status?: string | null
          from_email?: string | null
          id?: string
          is_manual_creation?: boolean | null
          pda_completed?: boolean | null
          pda_data?: Json | null
          pda_response_sent?: boolean | null
          processed_by?: string | null
          received_at?: string | null
          subject?: string | null
          to_email?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fda_creator_invoices: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          invoice_number: string | null
          project_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          invoice_number?: string | null
          project_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          invoice_number?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fda_creator_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fda_creator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fda_creator_projects: {
        Row: {
          billing_address: string | null
          billing_company: string | null
          billing_email: string | null
          billing_phone: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          fda_responsible: string | null
          id: string
          lbh_number: string
          sent_at: string | null
          ship_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          fda_responsible?: string | null
          id?: string
          lbh_number: string
          sent_at?: string | null
          ship_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          fda_responsible?: string | null
          id?: string
          lbh_number?: string
          sent_at?: string | null
          ship_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fda_curacao_agency_costs: {
        Row: {
          client: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          excel_file_url: string | null
          fda_responsible: string | null
          id: string
          invoice_number: string
          lbh_number: string
          project_id: string
          remark: string | null
          ship_name: string
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
          vessel_arrived: string | null
          vessel_sailed: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          excel_file_url?: string | null
          fda_responsible?: string | null
          id?: string
          invoice_number: string
          lbh_number: string
          project_id: string
          remark?: string | null
          ship_name: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          excel_file_url?: string | null
          fda_responsible?: string | null
          id?: string
          invoice_number?: string
          lbh_number?: string
          project_id?: string
          remark?: string | null
          ship_name?: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
        }
        Relationships: []
      }
      fda_curacao_processed_invoices: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          file_name: string
          file_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          lbh_number: string
          processed_at: string | null
          project_id: string
          remark: string | null
          ship_name: string
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          lbh_number: string
          processed_at?: string | null
          project_id: string
          remark?: string | null
          ship_name: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          lbh_number?: string
          processed_at?: string | null
          project_id?: string
          remark?: string | null
          ship_name?: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fda_curacao_processed_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fda_curacao_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      fda_curacao_projects: {
        Row: {
          advanced_payment_amount: number | null
          advanced_payment_currency: string | null
          advanced_payment_reference: string | null
          advanced_payment_remark: string | null
          advanced_payment_status: string | null
          agency_cost_url: string | null
          billing_address: string | null
          billing_company: string | null
          billing_email: string | null
          billing_phone: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_reference: string | null
          commodity: string | null
          created_at: string | null
          drive_folder_url: string | null
          email_body: string | null
          email_sent_at: string | null
          email_subject: string | null
          fda_responsible: string | null
          final_pdf_url: string | null
          front_page_url: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          id: string
          lbh_number: string
          operation: string | null
          processed_at: string | null
          project_id: string
          sent_at: string | null
          ship_name: string
          status: string | null
          total_amount: number | null
          total_invoices: number | null
          updated_at: string | null
          vessel_arrived: string | null
          vessel_sailed: string | null
        }
        Insert: {
          advanced_payment_amount?: number | null
          advanced_payment_currency?: string | null
          advanced_payment_reference?: string | null
          advanced_payment_remark?: string | null
          advanced_payment_status?: string | null
          agency_cost_url?: string | null
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_reference?: string | null
          commodity?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          fda_responsible?: string | null
          final_pdf_url?: string | null
          front_page_url?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number: string
          operation?: string | null
          processed_at?: string | null
          project_id: string
          sent_at?: string | null
          ship_name: string
          status?: string | null
          total_amount?: number | null
          total_invoices?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
        }
        Update: {
          advanced_payment_amount?: number | null
          advanced_payment_currency?: string | null
          advanced_payment_reference?: string | null
          advanced_payment_remark?: string | null
          advanced_payment_status?: string | null
          agency_cost_url?: string | null
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_reference?: string | null
          commodity?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          fda_responsible?: string | null
          final_pdf_url?: string | null
          front_page_url?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number?: string
          operation?: string | null
          processed_at?: string | null
          project_id?: string
          sent_at?: string | null
          ship_name?: string
          status?: string | null
          total_amount?: number | null
          total_invoices?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
        }
        Relationships: []
      }
      fda_email_drafts: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          created_at: string | null
          drive_folder_url: string | null
          email_body: string
          email_cc: string | null
          email_subject: string
          email_to: string
          error_message: string | null
          google_sheet_url: string | null
          id: string
          lbh_number: string | null
          project_id: string
          sent_at: string | null
          ship_name: string | null
          status: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          email_body: string
          email_cc?: string | null
          email_subject: string
          email_to: string
          error_message?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number?: string | null
          project_id: string
          sent_at?: string | null
          ship_name?: string | null
          status?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          email_body?: string
          email_cc?: string | null
          email_subject?: string
          email_to?: string
          error_message?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number?: string | null
          project_id?: string
          sent_at?: string | null
          ship_name?: string | null
          status?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      fda_processed_invoices: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          file_name: string
          file_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          lbh_number: string
          processed_at: string | null
          project_id: string
          remark: string | null
          ship_name: string
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          lbh_number: string
          processed_at?: string | null
          project_id: string
          remark?: string | null
          ship_name: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          lbh_number?: string
          processed_at?: string | null
          project_id?: string
          remark?: string | null
          ship_name?: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fda_processed_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fda_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      fda_projects: {
        Row: {
          advanced_payment_amount: number | null
          advanced_payment_currency: string | null
          advanced_payment_reference: string | null
          advanced_payment_remark: string | null
          advanced_payment_status: string | null
          agency_cost_url: string | null
          billing_address: string | null
          billing_company: string | null
          billing_email: string | null
          billing_phone: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_reference: string | null
          client_sheet_url: string | null
          commodity: string | null
          created_at: string | null
          email_body: string | null
          email_sent_at: string | null
          email_subject: string | null
          fda_responsible: string | null
          final_pdf_url: string | null
          front_page_url: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          id: string
          lbh_number: string
          operation: string | null
          processed_at: string | null
          project_id: string
          ship_name: string
          status: string | null
          total_amount: number | null
          total_invoices: number | null
          updated_at: string | null
          vessel_arrived: string | null
          vessel_sailed: string | null
        }
        Insert: {
          advanced_payment_amount?: number | null
          advanced_payment_currency?: string | null
          advanced_payment_reference?: string | null
          advanced_payment_remark?: string | null
          advanced_payment_status?: string | null
          agency_cost_url?: string | null
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_reference?: string | null
          client_sheet_url?: string | null
          commodity?: string | null
          created_at?: string | null
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          fda_responsible?: string | null
          final_pdf_url?: string | null
          front_page_url?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number: string
          operation?: string | null
          processed_at?: string | null
          project_id: string
          ship_name: string
          status?: string | null
          total_amount?: number | null
          total_invoices?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
        }
        Update: {
          advanced_payment_amount?: number | null
          advanced_payment_currency?: string | null
          advanced_payment_reference?: string | null
          advanced_payment_remark?: string | null
          advanced_payment_status?: string | null
          agency_cost_url?: string | null
          billing_address?: string | null
          billing_company?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_reference?: string | null
          client_sheet_url?: string | null
          commodity?: string | null
          created_at?: string | null
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          fda_responsible?: string | null
          final_pdf_url?: string | null
          front_page_url?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          lbh_number?: string
          operation?: string | null
          processed_at?: string | null
          project_id?: string
          ship_name?: string
          status?: string | null
          total_amount?: number | null
          total_invoices?: number | null
          updated_at?: string | null
          vessel_arrived?: string | null
          vessel_sailed?: string | null
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
      loading_rates: {
        Row: {
          cargo_category: string | null
          cargo_type: string
          created_at: string | null
          discharge_rate: number
          heating_buffer_percent: number | null
          heating_required: boolean | null
          id: string
          is_active: boolean | null
          loading_rate: number
          notes: string | null
          port_stay_buffer_percent: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          cargo_category?: string | null
          cargo_type: string
          created_at?: string | null
          discharge_rate: number
          heating_buffer_percent?: number | null
          heating_required?: boolean | null
          id?: string
          is_active?: boolean | null
          loading_rate: number
          notes?: string | null
          port_stay_buffer_percent?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          cargo_category?: string | null
          cargo_type?: string
          created_at?: string | null
          discharge_rate?: number
          heating_buffer_percent?: number | null
          heating_required?: boolean | null
          id?: string
          is_active?: boolean | null
          loading_rate?: number
          notes?: string | null
          port_stay_buffer_percent?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      manual_emails: {
        Row: {
          agent_type: string
          area: string | null
          bcc_recipients: string[] | null
          body: string | null
          cargo_quantity: number | null
          cargo_type: string | null
          cc_recipients: string[] | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          dwt: number | null
          email_content: string
          error_message: string | null
          eta: string | null
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
          to_recipients: string[] | null
          tugs: number | null
          vessel_2_beam: number | null
          vessel_2_draft: number | null
          vessel_2_dwt: number | null
          vessel_2_flag: string | null
          vessel_2_grt: number | null
          vessel_2_imo: string | null
          vessel_2_loa: number | null
          vessel_2_name: string | null
          vessel_name: string | null
        }
        Insert: {
          agent_type: string
          area?: string | null
          bcc_recipients?: string[] | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          cc_recipients?: string[] | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          dwt?: number | null
          email_content: string
          error_message?: string | null
          eta?: string | null
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
          to_recipients?: string[] | null
          tugs?: number | null
          vessel_2_beam?: number | null
          vessel_2_draft?: number | null
          vessel_2_dwt?: number | null
          vessel_2_flag?: string | null
          vessel_2_grt?: number | null
          vessel_2_imo?: string | null
          vessel_2_loa?: number | null
          vessel_2_name?: string | null
          vessel_name?: string | null
        }
        Update: {
          agent_type?: string
          area?: string | null
          bcc_recipients?: string[] | null
          body?: string | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          cc_recipients?: string[] | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          dwt?: number | null
          email_content?: string
          error_message?: string | null
          eta?: string | null
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
          to_recipients?: string[] | null
          tugs?: number | null
          vessel_2_beam?: number | null
          vessel_2_draft?: number | null
          vessel_2_dwt?: number | null
          vessel_2_flag?: string | null
          vessel_2_grt?: number | null
          vessel_2_imo?: string | null
          vessel_2_loa?: number | null
          vessel_2_name?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      owners_kb_embeddings: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      pda_email_log: {
        Row: {
          bcc_emails: string[] | null
          body: string | null
          cc_emails: string[] | null
          created_at: string | null
          email_id: string | null
          from_email: string
          id: string
          is_archived: boolean | null
          notes: string | null
          pda_calculated: boolean | null
          pda_results: Json | null
          received_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string | null
          to_email: string
          updated_at: string | null
          vessel_data: Json | null
        }
        Insert: {
          bcc_emails?: string[] | null
          body?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          email_id?: string | null
          from_email: string
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          pda_calculated?: boolean | null
          pda_results?: Json | null
          received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string | null
          to_email: string
          updated_at?: string | null
          vessel_data?: Json | null
        }
        Update: {
          bcc_emails?: string[] | null
          body?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          email_id?: string | null
          from_email?: string
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          pda_calculated?: boolean | null
          pda_results?: Json | null
          received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string | null
          to_email?: string
          updated_at?: string | null
          vessel_data?: Json | null
        }
        Relationships: []
      }
      pda_loading_rates: {
        Row: {
          cargo_type: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          operation: string
          rate_mt_per_day: number
          updated_at: string
          version: number
        }
        Insert: {
          cargo_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          operation?: string
          rate_mt_per_day: number
          updated_at?: string
          version?: number
        }
        Update: {
          cargo_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          operation?: string
          rate_mt_per_day?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      pda_outputs: {
        Row: {
          assigned_area: string | null
          assigned_facility: string | null
          assigned_terminal: string | null
          batch_id: string | null
          calculation_timestamp: string | null
          config_version: number | null
          created_at: string | null
          created_by: string | null
          id: string
          loa: number | null
          loading_rate_applied: number | null
          port_code: string | null
          port_stay_days: number | null
          tugs_required: number | null
          updated_at: string | null
          vessel_imo: string | null
          vessel_input_id: string | null
          vessel_name: string | null
        }
        Insert: {
          assigned_area?: string | null
          assigned_facility?: string | null
          assigned_terminal?: string | null
          batch_id?: string | null
          calculation_timestamp?: string | null
          config_version?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          loa?: number | null
          loading_rate_applied?: number | null
          port_code?: string | null
          port_stay_days?: number | null
          tugs_required?: number | null
          updated_at?: string | null
          vessel_imo?: string | null
          vessel_input_id?: string | null
          vessel_name?: string | null
        }
        Update: {
          assigned_area?: string | null
          assigned_facility?: string | null
          assigned_terminal?: string | null
          batch_id?: string | null
          calculation_timestamp?: string | null
          config_version?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          loa?: number | null
          loading_rate_applied?: number | null
          port_code?: string | null
          port_stay_days?: number | null
          tugs_required?: number | null
          updated_at?: string | null
          vessel_imo?: string | null
          vessel_input_id?: string | null
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pda_outputs_vessel_input_id_fkey"
            columns: ["vessel_input_id"]
            isOneToOne: false
            referencedRelation: "vessel_batch_inputs"
            referencedColumns: ["id"]
          },
        ]
      }
      pda_port_stay_formulas: {
        Row: {
          buffer_hours: number
          created_at: string
          id: string
          is_active: boolean
          min_stay_hours: number
          notes: string | null
          positioning_hours: number
          terminal_code: string
          updated_at: string
          version: number
        }
        Insert: {
          buffer_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          min_stay_hours?: number
          notes?: string | null
          positioning_hours?: number
          terminal_code: string
          updated_at?: string
          version?: number
        }
        Update: {
          buffer_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          min_stay_hours?: number
          notes?: string | null
          positioning_hours?: number
          terminal_code?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      pda_terminal_assignments: {
        Row: {
          cargo_type: string
          created_at: string
          id: string
          is_active: boolean
          loa_max: number | null
          loa_min: number
          notes: string | null
          port_code: string
          terminal_code: string
          updated_at: string
          version: number
        }
        Insert: {
          cargo_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          loa_max?: number | null
          loa_min?: number
          notes?: string | null
          port_code?: string
          terminal_code: string
          updated_at?: string
          version?: number
        }
        Update: {
          cargo_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          loa_max?: number | null
          loa_min?: number
          notes?: string | null
          port_code?: string
          terminal_code?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      pda_tug_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          loa_max: number | null
          loa_min: number
          notes: string | null
          terminal_code: string
          tugs_required: number
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          loa_max?: number | null
          loa_min?: number
          notes?: string | null
          terminal_code: string
          tugs_required?: number
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          loa_max?: number | null
          loa_min?: number
          notes?: string | null
          terminal_code?: string
          tugs_required?: number
          updated_at?: string
          version?: number
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
          must_change_password: boolean | null
          name: string | null
          office: string | null
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
          must_change_password?: boolean | null
          name?: string | null
          office?: string | null
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
          must_change_password?: boolean | null
          name?: string | null
          office?: string | null
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
      terminal_assignments: {
        Row: {
          allowed_operations: string[] | null
          area_name: string | null
          cargo_type: string
          created_at: string | null
          facility_name: string | null
          has_crane: boolean | null
          has_pipeline: boolean | null
          has_repair_berth: boolean | null
          id: string
          is_active: boolean | null
          loa_max: number | null
          loa_min: number | null
          max_draft: number | null
          max_loa: number | null
          notes: string | null
          port_code: string
          priority: number | null
          terminal_name: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          allowed_operations?: string[] | null
          area_name?: string | null
          cargo_type: string
          created_at?: string | null
          facility_name?: string | null
          has_crane?: boolean | null
          has_pipeline?: boolean | null
          has_repair_berth?: boolean | null
          id?: string
          is_active?: boolean | null
          loa_max?: number | null
          loa_min?: number | null
          max_draft?: number | null
          max_loa?: number | null
          notes?: string | null
          port_code: string
          priority?: number | null
          terminal_name: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          allowed_operations?: string[] | null
          area_name?: string | null
          cargo_type?: string
          created_at?: string | null
          facility_name?: string | null
          has_crane?: boolean | null
          has_pipeline?: boolean | null
          has_repair_berth?: boolean | null
          id?: string
          is_active?: boolean | null
          loa_max?: number | null
          loa_min?: number | null
          max_draft?: number | null
          max_loa?: number | null
          notes?: string | null
          port_code?: string
          priority?: number | null
          terminal_name?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      tug_rules: {
        Row: {
          cargo_types: string[] | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          loa_max: number | null
          loa_min: number | null
          operation_types: string[] | null
          port_code: string
          rule_name: string
          terminal: string
          tug_count: number
          tug_type: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          cargo_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          loa_max?: number | null
          loa_min?: number | null
          operation_types?: string[] | null
          port_code: string
          rule_name: string
          terminal: string
          tug_count?: number
          tug_type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          cargo_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          loa_max?: number | null
          loa_min?: number | null
          operation_types?: string[] | null
          port_code?: string
          rule_name?: string
          terminal?: string
          tug_count?: number
          tug_type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vessel_batch_inputs: {
        Row: {
          area: string | null
          batch_id: string
          beam: number | null
          cargo_quantity: number | null
          cargo_type: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          draft: number | null
          dwt: number | null
          error_message: string | null
          grt: number | null
          id: string
          loa: number | null
          operation_type: string | null
          port_code: string | null
          port_name: string | null
          status: string | null
          total_vessels: number | null
          updated_at: string | null
          vessel_flag: string | null
          vessel_imo: string | null
          vessel_index: number | null
          vessel_name: string | null
        }
        Insert: {
          area?: string | null
          batch_id: string
          beam?: number | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          draft?: number | null
          dwt?: number | null
          error_message?: string | null
          grt?: number | null
          id?: string
          loa?: number | null
          operation_type?: string | null
          port_code?: string | null
          port_name?: string | null
          status?: string | null
          total_vessels?: number | null
          updated_at?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_index?: number | null
          vessel_name?: string | null
        }
        Update: {
          area?: string | null
          batch_id?: string
          beam?: number | null
          cargo_quantity?: number | null
          cargo_type?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          draft?: number | null
          dwt?: number | null
          error_message?: string | null
          grt?: number | null
          id?: string
          loa?: number | null
          operation_type?: string | null
          port_code?: string | null
          port_name?: string | null
          status?: string | null
          total_vessels?: number | null
          updated_at?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_index?: number | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      vessel_pda_data: {
        Row: {
          cargo_quantity: number | null
          cargo_type: string | null
          cargo_unit: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          eta: string | null
          facility: string | null
          id: number
          operation: string | null
          pilotage: boolean | null
          port_area: string | null
          port_country: string | null
          port_stay: number | null
          supabase_email_id: number | null
          terminal: string | null
          tugs: number | null
          vessel_beam: number | null
          vessel_draft: number | null
          vessel_dwt: number | null
          vessel_flag: string | null
          vessel_grt: number | null
          vessel_imo: string | null
          vessel_loa: number | null
          vessel_name: string | null
          vessel_number: number | null
        }
        Insert: {
          cargo_quantity?: number | null
          cargo_type?: string | null
          cargo_unit?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          eta?: string | null
          facility?: string | null
          id?: number
          operation?: string | null
          pilotage?: boolean | null
          port_area?: string | null
          port_country?: string | null
          port_stay?: number | null
          supabase_email_id?: number | null
          terminal?: string | null
          tugs?: number | null
          vessel_beam?: number | null
          vessel_draft?: number | null
          vessel_dwt?: number | null
          vessel_flag?: string | null
          vessel_grt?: number | null
          vessel_imo?: string | null
          vessel_loa?: number | null
          vessel_name?: string | null
          vessel_number?: number | null
        }
        Update: {
          cargo_quantity?: number | null
          cargo_type?: string | null
          cargo_unit?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          eta?: string | null
          facility?: string | null
          id?: number
          operation?: string | null
          pilotage?: boolean | null
          port_area?: string | null
          port_country?: string | null
          port_stay?: number | null
          supabase_email_id?: number | null
          terminal?: string | null
          tugs?: number | null
          vessel_beam?: number | null
          vessel_draft?: number | null
          vessel_dwt?: number | null
          vessel_flag?: string | null
          vessel_grt?: number | null
          vessel_imo?: string | null
          vessel_loa?: number | null
          vessel_name?: string | null
          vessel_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vessel_pda_data_supabase_email_id_fkey"
            columns: ["supabase_email_id"]
            isOneToOne: false
            referencedRelation: "email"
            referencedColumns: ["id"]
          },
        ]
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
      get_lbh_invoice_count: { Args: { p_lbh_number: string }; Returns: number }
      get_project_total: { Args: { p_project_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      search_by_keyword: {
        Args: { keyword_text: string }
        Returns: {
          category: string
          content: string
          id: string
          topic: string
        }[]
      }
      search_cargo_agent_knowledge: {
        Args: { search_term: string }
        Returns: {
          category: string
          content: string
          id: string
          relevance_score: number
          topic: string
        }[]
      }
      search_cargo_knowledge: {
        Args: { search_term: string }
        Returns: {
          category: string
          content: string
          id: string
          relevance_score: number
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
      search_owners_knowledge: {
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
      app_role: "admin" | "user" | "pending"
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
      app_role: ["admin", "user", "pending"],
      email_status: ["draft", "sent", "rejected", "approved"],
    },
  },
} as const
