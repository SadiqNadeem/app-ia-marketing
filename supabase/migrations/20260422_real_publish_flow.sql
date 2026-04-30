-- Real publish flow schema updates (idempotent)
-- Adds production publish fields and ensures status supports "publishing".

alter table public.posts add column if not exists content text;
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists platform text;
alter table public.posts add column if not exists external_post_id text;
alter table public.posts add column if not exists error_message text;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists created_at timestamptz not null default now();

-- Keep old/new columns in sync for compatibility.
update public.posts
set content = coalesce(content, content_text, '')
where content is null;

update public.posts
set content_text = coalesce(content_text, content, '')
where content_text is null;

update public.posts
set media_url = coalesce(media_url, image_url)
where media_url is null;

update public.posts
set platform = coalesce(platform, (platforms[1]))
where platform is null and platforms is not null and array_length(platforms, 1) > 0;

-- Backfill owner for user_id when missing.
update public.posts p
set user_id = b.owner_id
from public.businesses b
where p.user_id is null
  and p.business_id = b.id;

-- Rebuild status constraint to include "publishing".
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.posts drop constraint if exists %I', c.conname);
  end loop;
end
$$;

alter table public.posts
  add constraint posts_status_check
  check (status in ('draft', 'publishing', 'scheduled', 'published', 'failed'));

create index if not exists idx_posts_platform on public.posts (platform);
create index if not exists idx_posts_external_post_id on public.posts (external_post_id);
create index if not exists idx_posts_status_created_at on public.posts (status, created_at desc);

alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_select_own'
  ) then
    create policy posts_select_own
      on public.posts
      for select
      using (
        user_id = auth.uid()
        or exists (
          select 1 from public.businesses b
          where b.id = business_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_insert_own'
  ) then
    create policy posts_insert_own
      on public.posts
      for insert
      with check (
        user_id = auth.uid()
        or exists (
          select 1 from public.businesses b
          where b.id = business_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_update_own'
  ) then
    create policy posts_update_own
      on public.posts
      for update
      using (
        user_id = auth.uid()
        or exists (
          select 1 from public.businesses b
          where b.id = business_id and b.owner_id = auth.uid()
        )
      )
      with check (
        user_id = auth.uid()
        or exists (
          select 1 from public.businesses b
          where b.id = business_id and b.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

