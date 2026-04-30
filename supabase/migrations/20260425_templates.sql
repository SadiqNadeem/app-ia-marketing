-- Columnas para el sistema de plantillas editables en ai_examples
alter table public.ai_examples
  add column if not exists fabric_json  jsonb,
  add column if not exists preview_url  text,
  add column if not exists is_template  boolean default false not null,
  add column if not exists canvas_width  integer default 1080,
  add column if not exists canvas_height integer default 1080,
  add column if not exists platform      text,
  add column if not exists post_type     text;

-- Indice para filtrar plantillas rapidamente
create index if not exists idx_ai_examples_is_template
  on public.ai_examples (is_template, is_active);
