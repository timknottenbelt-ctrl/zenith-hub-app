
-- ==============================================
-- PDA Creator Configuration Tables
-- ==============================================

-- Tug Rules: define number of tugs based on terminal + LOA thresholds
CREATE TABLE public.pda_tug_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_code text NOT NULL,
  loa_min numeric NOT NULL DEFAULT 0,
  loa_max numeric,
  tugs_required integer NOT NULL DEFAULT 1,
  notes text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Loading Rates: MT/day per cargo type
CREATE TABLE public.pda_loading_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_type text NOT NULL,
  rate_mt_per_day numeric NOT NULL,
  operation text NOT NULL DEFAULT 'load',
  notes text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Terminal Assignments: LOA + cargo_type → terminal mapping
CREATE TABLE public.pda_terminal_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_type text NOT NULL,
  loa_min numeric NOT NULL DEFAULT 0,
  loa_max numeric,
  terminal_code text NOT NULL,
  port_code text NOT NULL DEFAULT 'WILLEMSTAD',
  notes text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Port Stay Formulas: buffer + positioning per terminal
CREATE TABLE public.pda_port_stay_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_code text NOT NULL,
  buffer_hours numeric NOT NULL DEFAULT 6,
  positioning_hours numeric NOT NULL DEFAULT 4,
  min_stay_hours numeric NOT NULL DEFAULT 24,
  notes text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pda_tug_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pda_loading_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pda_terminal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pda_port_stay_formulas ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users full access
CREATE POLICY "Authenticated full access tug_rules" ON public.pda_tug_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access loading_rates" ON public.pda_loading_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access terminal_assignments" ON public.pda_terminal_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access port_stay_formulas" ON public.pda_port_stay_formulas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_pda_tug_rules_updated_at BEFORE UPDATE ON public.pda_tug_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pda_loading_rates_updated_at BEFORE UPDATE ON public.pda_loading_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pda_terminal_assignments_updated_at BEFORE UPDATE ON public.pda_terminal_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pda_port_stay_formulas_updated_at BEFORE UPDATE ON public.pda_port_stay_formulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- SEED DATA: Realistic Curaçao port configurations
-- ==============================================

-- Tug Rules
INSERT INTO public.pda_tug_rules (terminal_code, loa_min, loa_max, tugs_required, notes) VALUES
  ('ISLA_TERMINAL', 0, NULL, 2, 'ISLA altijd 2 tugs'),
  ('BULLENBAAI', 0, 150, 1, 'Klein schip 1 tug'),
  ('BULLENBAAI', 150, NULL, 2, 'Groot schip 2 tugs'),
  ('CARACASBAAI', 0, 120, 1, 'Standaard 1 tug'),
  ('CARACASBAAI', 120, NULL, 2, '2 tugs bij groot schip'),
  ('MEGA_PIER', 0, 200, 1, 'Cruise klein 1 tug'),
  ('MEGA_PIER', 200, NULL, 2, 'Cruise groot 2 tugs'),
  ('OFFSHORE', 0, NULL, 0, 'Geen tugs offshore'),
  ('PARERA', 0, NULL, 1, 'Parera standaard 1 tug'),
  ('DOKMAATSCHAPPIJ', 0, NULL, 1, 'Drydock 1 tug');

-- Loading Rates (MT/day)
INSERT INTO public.pda_loading_rates (cargo_type, rate_mt_per_day, operation, notes) VALUES
  ('Bitumen', 900, 'load', 'Standaard bitumen rate'),
  ('Bitumen', 900, 'discharge', 'Standaard bitumen rate'),
  ('Fuel Oil', 5000, 'load', 'Fuel oil pumping rate'),
  ('Fuel Oil', 5000, 'discharge', 'Fuel oil pumping rate'),
  ('Diesel', 4000, 'load', 'Diesel pumping rate'),
  ('Diesel', 4000, 'discharge', 'Diesel pumping rate'),
  ('Gasoline', 3500, 'load', 'Gasoline rate'),
  ('LPG', 2000, 'load', 'LPG rate'),
  ('LPG', 2000, 'discharge', 'LPG rate'),
  ('Crude Oil', 8000, 'load', 'Crude oil rate'),
  ('Crude Oil', 8000, 'discharge', 'Crude oil rate'),
  ('General Cargo', 1500, 'load', 'General cargo rate'),
  ('General Cargo', 1500, 'discharge', 'General cargo rate'),
  ('Containers', 500, 'load', 'Per TEU equivalent'),
  ('Bunkers', 3000, 'load', 'Bunker fuel rate'),
  ('Water', 2000, 'load', 'Fresh water supply');

-- Terminal Assignments
INSERT INTO public.pda_terminal_assignments (cargo_type, loa_min, loa_max, terminal_code, port_code, notes) VALUES
  ('Bitumen', 0, NULL, 'BULLENBAAI', 'WILLEMSTAD', 'Bitumen altijd Bullenbaai'),
  ('Fuel Oil', 0, 200, 'ISLA_TERMINAL', 'WILLEMSTAD', 'Fuel Oil naar ISLA'),
  ('Fuel Oil', 200, NULL, 'BULLENBAAI', 'WILLEMSTAD', 'Grote tankers Bullenbaai'),
  ('Diesel', 0, NULL, 'ISLA_TERMINAL', 'WILLEMSTAD', 'Diesel naar ISLA'),
  ('Crude Oil', 0, NULL, 'BULLENBAAI', 'WILLEMSTAD', 'Crude altijd Bullenbaai'),
  ('LPG', 0, NULL, 'BULLENBAAI', 'WILLEMSTAD', 'LPG Bullenbaai'),
  ('General Cargo', 0, NULL, 'CARACASBAAI', 'WILLEMSTAD', 'General cargo Caracasbaai'),
  ('Containers', 0, NULL, 'CARACASBAAI', 'WILLEMSTAD', 'Containers Caracasbaai'),
  ('Bunkers', 0, NULL, 'OFFSHORE', 'WILLEMSTAD', 'Bunkers offshore STS');

-- Port Stay Formulas
INSERT INTO public.pda_port_stay_formulas (terminal_code, buffer_hours, positioning_hours, min_stay_hours, notes) VALUES
  ('ISLA_TERMINAL', 8, 4, 24, 'ISLA met extra buffer'),
  ('BULLENBAAI', 6, 4, 24, 'Bullenbaai standaard'),
  ('CARACASBAAI', 6, 3, 18, 'Caracasbaai kortere minimum'),
  ('MEGA_PIER', 4, 2, 12, 'Cruise korte stays'),
  ('OFFSHORE', 4, 6, 24, 'Offshore extra positioning'),
  ('PARERA', 6, 3, 18, 'Parera standaard'),
  ('DOKMAATSCHAPPIJ', 8, 4, 48, 'Drydock langere minimum stay');
