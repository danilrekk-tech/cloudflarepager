ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS w double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS h double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_text text NOT NULL DEFAULT ''::text;