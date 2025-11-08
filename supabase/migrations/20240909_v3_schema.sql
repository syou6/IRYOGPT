-- Supabase schema updates for architecture_v3 (multitenant SaaS features)
-- This script is idempotent and can be re-run safely.

-- 1. users (aux table for plan/quota metadata)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro', 'enterprise')),
  chat_quota integer not null,
  embedding_quota integer not null,
  created_at timestamptz not null default now()
);

comment on table public.users is 'Auxiliary metadata for Supabase auth users';
comment on column public.users.plan is 'Plan identifier (starter / pro / enterprise)';
comment on column public.users.chat_quota is 'Monthly chat allowance';
comment on column public.users.embedding_quota is 'Monthly embedding token allowance';

-- 2. sites table extensions for embed widget
alter table if exists public.sites
  add column if not exists is_embed_enabled boolean not null default false,
  add column if not exists embed_script_id text null default concat('site_', gen_random_uuid());

create index if not exists idx_sites_embed_script_id on public.sites (embed_script_id);

-- 3. training_jobs extra operational metadata
alter table if exists public.training_jobs
  add column if not exists attempt integer not null default 0,
  add column if not exists estimated_cost_usd numeric;

-- 4. documents versioning / TTL for differential updates
alter table if exists public.documents
  add column if not exists version integer not null default 1,
  add column if not exists valid_until timestamptz;

-- 5. model_policies lookup table
create table if not exists public.model_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('embedding', 'chat')),
  cost_per_1000_tokens_usd numeric not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.model_policies is 'Catalog of LLM/embedding models and their pricing';
comment on column public.model_policies.type is 'embedding or chat';
