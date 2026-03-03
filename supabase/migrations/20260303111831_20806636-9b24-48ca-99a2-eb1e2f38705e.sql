ALTER TABLE public.terminal_assignments 
ADD COLUMN IF NOT EXISTS allowed_operations text[] DEFAULT '{}'::text[];