-- Row-level security for Trackfit.
-- Default: every table denies all access. Policies open up only the rows the
-- authenticated user owns. Anonymous users have no access here — the
-- offline-first localStorage path stays the only thing that works without
-- auth, which is correct: a user can run Trackfit without ever signing up.

alter table public.inventories enable row level security;
alter table public.inventory_pieces enable row level security;
alter table public.gaps enable row level security;

-- ---------------------------------------------------------------------------
-- inventories: user is the row owner
-- ---------------------------------------------------------------------------
create policy "inventories: owner read"
  on public.inventories for select
  using (auth.uid() = user_id);

create policy "inventories: owner write"
  on public.inventories for insert
  with check (auth.uid() = user_id);

create policy "inventories: owner update"
  on public.inventories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "inventories: owner delete"
  on public.inventories for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- inventory_pieces: ownership flows through the parent inventory
-- ---------------------------------------------------------------------------
create policy "inventory_pieces: owner read"
  on public.inventory_pieces for select
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "inventory_pieces: owner write"
  on public.inventory_pieces for insert
  with check (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "inventory_pieces: owner update"
  on public.inventory_pieces for update
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "inventory_pieces: owner delete"
  on public.inventory_pieces for delete
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- gaps: same flow-through ownership pattern
-- ---------------------------------------------------------------------------
create policy "gaps: owner read"
  on public.gaps for select
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "gaps: owner write"
  on public.gaps for insert
  with check (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "gaps: owner update"
  on public.gaps for update
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );

create policy "gaps: owner delete"
  on public.gaps for delete
  using (
    exists (
      select 1 from public.inventories i
      where i.id = inventory_id and i.user_id = auth.uid()
    )
  );
