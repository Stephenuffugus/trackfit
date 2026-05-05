-- Storage bucket for user-uploaded photos (inventory + gap reference photos).
--
-- Bucket is PRIVATE by default. The web client uploads with the user's auth
-- token, gets a `storage_key` back, and stores that on inventory_pieces /
-- gaps rows. To display, the client requests a signed URL with a short TTL.
-- This means an inventory photo is never publicly indexable.

insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', false)
on conflict (id) do nothing;

-- Storage RLS: a user can only see/touch files under their own user_id prefix.
-- File-key convention: "<user_id>/<inventory_id>/<piece_or_gap_id>.jpg"
-- The first path segment must equal auth.uid()::text.

create policy "user-photos: owner read"
  on storage.objects for select
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user-photos: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user-photos: owner update"
  on storage.objects for update
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user-photos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
