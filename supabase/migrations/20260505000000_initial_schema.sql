-- Trackfit cloud-sync schema (Track 5 of the handoff plan).
--
-- Apply via Supabase CLI:  supabase db push
-- Or paste into the SQL editor at https://supabase.com/dashboard/project/_/sql
--
-- Three tables, all RLS-enabled. Photos go to Supabase Storage (see
-- 20260505000100_storage.sql), not as base64 in these rows — keeps the
-- Postgres tables small and lets us use signed URLs for privacy.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- inventories: a named collection of track pieces ("My HO collection",
-- "Loaner box from Dave", "Christmas tree layout"). Phase-4 club/shared use
-- will extend this with a workspace_id; the 1:1 user_id model stays valid for
-- single-user-multi-device sync, which is the v1 use case.
-- ---------------------------------------------------------------------------
create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventories_user_id_idx on public.inventories(user_id);

-- ---------------------------------------------------------------------------
-- inventory_pieces: one row per stocked piece type (with quantity). The
-- inventory model is multiset-of-types, NOT one-row-per-physical-piece — same
-- shape as the v0.2 prototype.
-- ---------------------------------------------------------------------------
create table public.inventory_pieces (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  -- Optional reference to a library system / piece (e.g. "lionel-fastrack" /
  -- "10in-straight"). Null when the user adds something manually that isn't in
  -- our verified library.
  library_system_id text,
  library_piece_id text,
  label text not null check (length(label) between 1 and 120),
  length_mm numeric not null check (length_mm > 0),
  qty integer not null default 0 check (qty >= 0),
  -- Path within the user-photos bucket; not a public URL. Use signed URLs.
  photo_storage_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_pieces_inventory_id_idx on public.inventory_pieces(inventory_id);

-- ---------------------------------------------------------------------------
-- gaps: a single recorded gap-fitting query, optionally with a reference
-- photo. We store these so the user can see history ("the gap I tried last
-- Tuesday") without re-typing target lengths.
-- ---------------------------------------------------------------------------
create table public.gaps (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  target_mm numeric not null check (target_mm > 0),
  tolerance_mm numeric not null default 0 check (tolerance_mm >= 0),
  photo_storage_key text,
  notes text,
  created_at timestamptz not null default now()
);

create index gaps_inventory_id_idx on public.gaps(inventory_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventories_updated_at
  before update on public.inventories
  for each row execute function public.tg_set_updated_at();

create trigger inventory_pieces_updated_at
  before update on public.inventory_pieces
  for each row execute function public.tg_set_updated_at();
