import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────
export interface TugRule {
  id: string;
  terminal_code: string;
  loa_min: number;
  loa_max: number | null;
  tugs_required: number;
  notes: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoadingRate {
  id: string;
  cargo_type: string;
  rate_mt_per_day: number;
  operation: string;
  notes: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerminalAssignment {
  id: string;
  cargo_type: string;
  loa_min: number;
  loa_max: number | null;
  terminal_code: string;
  port_code: string;
  notes: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortStayFormula {
  id: string;
  terminal_code: string;
  buffer_hours: number;
  positioning_hours: number;
  min_stay_hours: number;
  notes: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PDAConfigs {
  tugRules: TugRule[];
  loadingRates: LoadingRate[];
  terminalAssignments: TerminalAssignment[];
  portStayFormulas: PortStayFormula[];
}

// ─── Vessel Input Types ──────────────────────────────
export interface VesselInput {
  vessel_name: string;
  loa: number;
  grt: number;
  dwt: number;
  flag: string;
  operation: string;
  cargo_type: string;
  cargo_quantity: number;
  port_code: string;
}

export interface PDACalculation {
  vessel: VesselInput;
  terminal: string;
  tugs: number;
  loading_rate: number;
  loading_time_hours: number;
  buffer_hours: number;
  positioning_hours: number;
  total_port_stay_hours: number;
  total_port_stay_days: number;
  warnings: string[];
}

// ─── Calculation Engine ──────────────────────────────
export function calculatePDA(vessel: VesselInput, configs: PDAConfigs): PDACalculation {
  const warnings: string[] = [];

  // 1. Find terminal assignment
  const assignment = configs.terminalAssignments.find(
    (a) =>
      a.cargo_type.toLowerCase() === vessel.cargo_type.toLowerCase() &&
      vessel.loa >= a.loa_min &&
      (a.loa_max === null || vessel.loa < a.loa_max) &&
      a.port_code.toLowerCase() === vessel.port_code.toLowerCase()
  );
  const terminal = assignment?.terminal_code || 'UNKNOWN';
  if (!assignment) warnings.push(`No terminal mapping for ${vessel.cargo_type} at ${vessel.port_code}`);

  // 2. Find tug rule
  const tugRule = configs.tugRules.find(
    (r) =>
      r.terminal_code === terminal &&
      vessel.loa >= r.loa_min &&
      (r.loa_max === null || vessel.loa < r.loa_max)
  );
  const tugs = tugRule?.tugs_required ?? 1;
  if (!tugRule && terminal !== 'UNKNOWN') warnings.push(`No tug rule for ${terminal} with LOA ${vessel.loa}m`);

  // 3. Find loading rate
  const rate = configs.loadingRates.find(
    (r) =>
      r.cargo_type.toLowerCase() === vessel.cargo_type.toLowerCase() &&
      r.operation.toLowerCase() === vessel.operation.toLowerCase()
  );
  const loadingRate = rate?.rate_mt_per_day || 0;
  if (!rate) warnings.push(`No loading rate for ${vessel.cargo_type} (${vessel.operation})`);

  // 4. Calculate loading time
  const loadingTimeHours = loadingRate > 0 ? (vessel.cargo_quantity / loadingRate) * 24 : 0;

  // 5. Find port stay formula
  const formula = configs.portStayFormulas.find((f) => f.terminal_code === terminal);
  const bufferHours = formula?.buffer_hours ?? 6;
  const positioningHours = formula?.positioning_hours ?? 4;
  const minStayHours = formula?.min_stay_hours ?? 24;

  // 6. Calculate total port stay
  const rawStay = loadingTimeHours + bufferHours + positioningHours;
  const totalPortStayHours = Math.max(rawStay, minStayHours);

  return {
    vessel,
    terminal,
    tugs,
    loading_rate: loadingRate,
    loading_time_hours: Math.round(loadingTimeHours * 10) / 10,
    buffer_hours: bufferHours,
    positioning_hours: positioningHours,
    total_port_stay_hours: Math.round(totalPortStayHours * 10) / 10,
    total_port_stay_days: Math.round((totalPortStayHours / 24) * 10) / 10,
    warnings,
  };
}

// ─── Hook ────────────────────────────────────────────
export function usePDAConfigs() {
  const [configs, setConfigs] = useState<PDAConfigs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [tugRes, rateRes, termRes, formulaRes] = await Promise.all([
        supabase.from('pda_tug_rules').select('*').eq('is_active', true).order('terminal_code'),
        supabase.from('pda_loading_rates').select('*').eq('is_active', true).order('cargo_type'),
        supabase.from('pda_terminal_assignments').select('*').eq('is_active', true).order('cargo_type'),
        supabase.from('pda_port_stay_formulas').select('*').eq('is_active', true).order('terminal_code'),
      ]);

      if (tugRes.error) throw tugRes.error;
      if (rateRes.error) throw rateRes.error;
      if (termRes.error) throw termRes.error;
      if (formulaRes.error) throw formulaRes.error;

      setConfigs({
        tugRules: (tugRes.data || []) as unknown as TugRule[],
        loadingRates: (rateRes.data || []) as unknown as LoadingRate[],
        terminalAssignments: (termRes.data || []) as unknown as TerminalAssignment[],
        portStayFormulas: (formulaRes.data || []) as unknown as PortStayFormula[],
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // ── CRUD helpers ─────────────────────────────
  const updateTugRule = async (id: string, updates: Partial<TugRule>) => {
    const { data, error } = await supabase
      .from('pda_tug_rules')
      .update(updates as any)
      .eq('id', id)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createTugRule = async (rule: Omit<TugRule, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase
      .from('pda_tug_rules')
      .insert({ ...rule, is_active: true, version: 1 } as any)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const updateLoadingRate = async (id: string, updates: Partial<LoadingRate>) => {
    const { data, error } = await supabase
      .from('pda_loading_rates')
      .update(updates as any)
      .eq('id', id)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createLoadingRate = async (rate: Omit<LoadingRate, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase
      .from('pda_loading_rates')
      .insert({ ...rate, is_active: true, version: 1 } as any)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const updateTerminalAssignment = async (id: string, updates: Partial<TerminalAssignment>) => {
    const { data, error } = await supabase
      .from('pda_terminal_assignments')
      .update(updates as any)
      .eq('id', id)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const createTerminalAssignment = async (assignment: Omit<TerminalAssignment, 'id' | 'created_at' | 'updated_at' | 'version' | 'is_active'>) => {
    const { data, error } = await supabase
      .from('pda_terminal_assignments')
      .insert({ ...assignment, is_active: true, version: 1 } as any)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const updatePortStayFormula = async (id: string, updates: Partial<PortStayFormula>) => {
    const { data, error } = await supabase
      .from('pda_port_stay_formulas')
      .update(updates as any)
      .eq('id', id)
      .select();
    if (error) throw error;
    await fetchConfigs();
    return data?.[0];
  };

  const deactivateRule = async (table: 'pda_tug_rules' | 'pda_loading_rates' | 'pda_terminal_assignments' | 'pda_port_stay_formulas', id: string) => {
    let error: any = null;
    if (table === 'pda_tug_rules') {
      ({ error } = await supabase.from('pda_tug_rules').update({ is_active: false } as any).eq('id', id));
    } else if (table === 'pda_loading_rates') {
      ({ error } = await supabase.from('pda_loading_rates').update({ is_active: false } as any).eq('id', id));
    } else if (table === 'pda_terminal_assignments') {
      ({ error } = await supabase.from('pda_terminal_assignments').update({ is_active: false } as any).eq('id', id));
    } else if (table === 'pda_port_stay_formulas') {
      ({ error } = await supabase.from('pda_port_stay_formulas').update({ is_active: false } as any).eq('id', id));
    }
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
    // Insert all rules (without IDs so new ones are generated)
    const ops = [];
    if (config.tugRules?.length) {
      ops.push(supabase.from('pda_tug_rules').insert(config.tugRules.map((r: any) => ({ ...r, id: undefined, is_active: true })) as any));
    }
    if (config.loadingRates?.length) {
      ops.push(supabase.from('pda_loading_rates').insert(config.loadingRates.map((r: any) => ({ ...r, id: undefined, is_active: true })) as any));
    }
    if (config.terminalAssignments?.length) {
      ops.push(supabase.from('pda_terminal_assignments').insert(config.terminalAssignments.map((r: any) => ({ ...r, id: undefined, is_active: true })) as any));
    }
    if (config.portStayFormulas?.length) {
      ops.push(supabase.from('pda_port_stay_formulas').insert(config.portStayFormulas.map((r: any) => ({ ...r, id: undefined, is_active: true })) as any));
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
    updatePortStayFormula,
    deactivateRule,
    exportConfig,
    importConfig,
  };
}
