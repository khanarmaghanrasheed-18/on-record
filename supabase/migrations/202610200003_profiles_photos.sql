-- Public-facing profile details. Only the owner may update their profile.
alter table public.profiles
  add column headline text not null default '' check (char_length(headline) <= 60),
  add column bio text not null default '' check (char_length(bio) <= 240),
  add column avatar_path text;

alter table public.profiles add constraint avatar_path_belongs_to_profile
  check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text);

grant update (display_name, headline, bio, avatar_path) on public.profiles to authenticated;

-- Profile photos are public to view; only their owner may add or remove one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy on_record_photo_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy on_record_photo_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy on_record_photo_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text));
