ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS breadcrumb text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS element_html text NOT NULL DEFAULT '';