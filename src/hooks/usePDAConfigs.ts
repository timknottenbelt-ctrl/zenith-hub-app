import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// ─── Types (matching actual DB tables) ───────────────
export interface TugRule {
  id: string;
  rule_name: string;
  terminal: string;
  port_code: string;
  loa_min: number | null;
  loa_max: number | null;
  tug_count: number;
  tug_type: string | null;
  operation_types: string[] | null;
  cargo_types: string[] | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LoadingRate {
  id: string;
  cargo_type: string;
  cargo_category: string | null;
  loading_rate: number;
  discharge_rate: number;
  heating_required: boolean;
  heating_buffer_percent: number | null;
  port_stay_buffer_percent: number | null;
  notes: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TerminalAssignment {
  id: string;
  port_code: string;
  cargo_type: string;
  loa_min: number | null;
  loa_max: number | null;
  terminal_name: string;
  facility_name: string | null;
  area_name: string | null;
  max_loa: number | null;
  max_draft: number | null;
  has_pipeline: boolean;
  has_crane: boolean;
  has_repair_berth: boolean;
  allowed_operations: string[] | null;
  notes: string | null;
  is_active: boolean;
  priority: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PDAConfigs {
  tugRules: TugRule[];
  loadingRates: LoadingRate[];
  terminalAssignments: TerminalAssignment[];
}

// ─── Hook ────────────────────────────────────────────
export function usePDAConfigs() {
  const [configs, setConfigs] = useState<PDAConfigs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [tugRes, rateRes, termRes] = await Promise.all([
        supabase.from('tug_rules').select('*').eq('is_active', true).order('terminal'),
        supabase.from('loading_rates').select('*').eq('is_active', true).order('cargo_type'),
        supabase.from('terminal_assignments').select('*').eq('is_active', true).order('cargo_type'),
      ]);

      if (tugRes.error) throw tugRes.error;
      if (rateRes.error) throw rateRes.error;
      if (termRes.error) throw termRes.error;

      setConfigs({
        tugRules: (tugRes.data || []) as unknown as TugRule[],
        loadingRates: (rateRes.data || []) as unknown as LoadingRate[],
        terminalAssignments: (termRes.data || []) as unknown as TerminalAssignment[],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // ── CRUD helpers ─────────────────────────────
  const updateTugRule = async (id: string, updates: Partial<TugRule>) => {
    const { data, error } = await supabase.from('tug_rules').update(updates as TablesUpdate<'tug_rules'>).eq('id', id).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createTugRule = async (rule: Omit<TugRule, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase.from('tug_rules').insert({ ...rule, is_active: true, version: 1 } as TablesInsert<'tug_rules'>).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const updateLoadingRate = async (id: string, updates: Partial<LoadingRate>) => {
    const { data, error } = await supabase.from('loading_rates').update(updates as TablesUpdate<'loading_rates'>).eq('id', id).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createLoadingRate = async (rate: Omit<LoadingRate, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase.from('loading_rates').insert({ ...rate, is_active: true, version: 1 } as TablesInsert<'loading_rates'>).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const updateTerminalAssignment = async (id: string, updates: Partial<TerminalAssignment>) => {
    const { data, error } = await supabase.from('terminal_assignments').update(updates as TablesUpdate<'terminal_assignments'>).eq('id', id).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createTerminalAssignment = async (assignment: Omit<TerminalAssignment, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase.from('terminal_assignments').insert({ ...assignment, is_active: true, version: 1 } as TablesInsert<'terminal_assignments'>).select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const deactivateRule = async (table: 'tug_rules' | 'loading_rates' | 'terminal_assignments', id: string) => {
    const { error } = await supabase.from(table).update({ is_active: false } as TablesUpdate<'tug_rules'>).eq('id', id);
    if (error) throw error;
    await fetchConfigs();
  };

  // ── Export/Import ────────────────────────────
  const exportConfig = () => {
    if (!configs) return;
    const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), ...configs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pda-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (file: File) => {
    const text = await file.text();
    const config = JSON.parse(text);
    const ops = [];
    const stripId = (r: Record<string, unknown>) => ({ ...r, id: undefined, is_active: true });
    if (config.tugRules?.length) {
      ops.push(supabase.from('tug_rules').insert(config.tugRules.map(stripId) as TablesInsert<'tug_rules'>[]));
    }
    if (config.loadingRates?.length) {
      ops.push(supabase.from('loading_rates').insert(config.loadingRates.map(stripId) as TablesInsert<'loading_rates'>[]));
    }
    if (config.terminalAssignments?.length) {
      ops.push(supabase.from('terminal_assignments').insert(config.terminalAssignments.map(stripId) as TablesInsert<'terminal_assignments'>[]));
    }
    await Promise.all(ops);
    await fetchConfigs();
  };

  return {
    configs,
    loading,
    error,
    refetch: fetchConfigs,
    updateTugRule,
    createTugRule,
    updateLoadingRate,
    createLoadingRate,
    updateTerminalAssignment,
    createTerminalAssignment,
    deactivateRule,
    exportConfig,
    importConfig,
  };
}
