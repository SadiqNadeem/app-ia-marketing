-- Post generation flow hardening (draft persistence + publish status workflow)
-- This migration is idempotent and safe to run on existing projects.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled', 'failed')),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade
);

-- Compatibility columns used by the current app.
alter table public.posts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.posts add column if not exists content text;
alter table public.posts add column if not exists content_text text;
alter table public.posts add column if not exists status text;
alter table public.posts add column if not exists created_at timestamptz default now();
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists video_url text;
alter table public.posts add column if not exists platforms text[] default '{}'::text[];
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists promotion_type text;
alter table public.posts add column if not exists is_suggestion boolean not null default false;
alter table public.posts add column if not exists suggestion_date date;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists hashtags text[] default '{}'::text[];
alter table public.posts add column if not exists error_message text;
alter table public.posts add column if not exists platform_post_ids jsonb;

-- Keep content/content_text synchronized for old and new readers.
update public.posts
set content = coalesce(content, content_text, '')
where content is null;

update public.posts
set content_text = coalesce(content_text, content, '')
where content_text is null;

-- Backfill user_id from business owner when possible.
update public.posts p
set user_id = b.owner_id
from public.businesses b
where p.user_id is null
  and p.business_id = b.id;

alter table public.posts
  alter column content set default '',
  alter column status set default 'draft',
  alter column created_at set default now();

create index if not exists idx_posts_business_created_at on public.posts (business_id, created_at desc);
create index if not exists idx_posts_user_created_at on public.posts (user_id, created_at desc);
create index if not exists idx_posts_status on public.posts (status);

alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'posts_select_own'
  ) then
    create policy posts_select_own
      on public.posts
      for select
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.businesses b
          where b.id = business_id
            and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'posts_insert_own'
  ) then
    create policy posts_insert_own
      on public.posts
      for insert
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.businesses b
          where b.id = business_id
            and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'posts_update_own'
  ) then
    create policy posts_update_own
      on public.posts
      for update
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.businesses b
          where b.id = business_id
            and b.owner_id = auth.uid()
        )
      )
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.businesses b
          where b.id = business_id
            and b.owner_id = auth.uid()
        )
      );
  end if;
end
$$;
