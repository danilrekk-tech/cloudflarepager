CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_name text NOT NULL UNIQUE,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  feedback_token uuid NOT NULL DEFAULT gen_random_uuid(),
  feedback_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sites" ON public.sites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  selector text NOT NULL DEFAULT '',
  element_label text NOT NULL DEFAULT '',
  message text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  page_url text NOT NULL DEFAULT '',
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads feedback" ON public.feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = feedback.site_id AND s.user_id = auth.uid()));
CREATE POLICY "owner updates feedback" ON public.feedback FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = feedback.site_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = feedback.site_id AND s.user_id = auth.uid()));
CREATE POLICY "owner deletes feedback" ON public.feedback FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = feedback.site_id AND s.user_id = auth.uid()));

CREATE TABLE public.annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'note',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotations TO authenticated;
GRANT ALL ON public.annotations TO service_role;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own annotations" ON public.annotations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX feedback_site_idx ON public.feedback(site_id, created_at DESC);
CREATE INDEX annotations_site_idx ON public.annotations(site_id);
CREATE INDEX sites_user_idx ON public.sites(user_id, created_at DESC);