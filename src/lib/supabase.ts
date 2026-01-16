import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Email {
  id: string;
  received_at: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  category: 'CARGO_AGENT' | 'OWNERS_AGENT' | 'OUT_OF_SCOPE';
  sheet_links: string[];
  to_name: string | null;
  to_email: string | null;
  composed_subject: string | null;
  composed_message: string | null;
  status: 'new' | 'draft' | 'ready' | 'sending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface FdaProject {
  id: string;
  code: string;
  status: 'draft' | 'sent';
  lbh_number: string | null;
  ship_name: string | null;
  shipper: string | null;
  consignee: string | null;
  client: string | null;
  fda_responsible: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface FdaInvoice {
  id: string;
  fda_project_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface KnowledgeFile {
  id: string;
  type: 'OWNERS_AGENT_KNOWLEDGE' | 'CARGO_AGENT_KNOWLEDGE' | 'PORT_INFO' | 'TARIFFS';
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string | null;
  status: string | null;
  type: string | null;
  flag: string | null;
  year_built: number | null;
  loa: number | null;
  beam: number | null;
  draft: number | null;
  dwt: number | null;
  gross_tonnage: number | null;
  owner: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  vessel_name: string | null;
  email: string | null;
  phone: string | null;
  function: string | null;
  role: 'AGENT' | 'CLIENT' | 'SERVICE_PROVIDER' | null;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  language: 'nl' | 'en' | 'es' | 'pt';
  created_at: string;
}
