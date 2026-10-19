-- Account identities and one-time friend connections.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  friend_code text not null unique check (friend_code ~ '^[A-F0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordered_pair check (user_a < user_b),
  constraint requester_in_pair check (requested_by in (user_a, user_b)),
  constraint one_friendship_per_pair unique (user_a, user_b)
);

create index friendships_user_b_idx on public.friendships(user_b);

create function public.make_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_name text;
begin
  chosen_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(chosen_name) not between 2 and 40 then
    chosen_name := 'New member';
  end if;
  insert into public.profiles (id, display_name, friend_code)
  values (new.id, chosen_name, upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)));
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users for each row execute function public.make_profile();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

create policy profiles_visible_to_connections on public.profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where (f.user_a = public.profiles.id or f.user_b = public.profiles.id)
      and (f.user_a = (select auth.uid()) or f.user_b = (select auth.uid()))
  )
);

create policy friendships_visible_to_members on public.friendships
for select to authenticated using (
  user_a = (select auth.uid()) or user_b = (select auth.uid())
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.friendships from anon, authenticated;
grant select on public.profiles, public.friendships to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profile_owner_renames on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create function public.find_friend_by_code(code text)
returns table (id uuid, display_name text, friend_code text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return query
    select p.id, p.display_name, p.friend_code
    from public.profiles p
    where p.friend_code = upper(trim(code)) and p.id <> auth.uid()
    limit 1;
end;
$$;

create function public.request_friend(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  them uuid;
  friendship_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select p.id into them from public.profiles p
    where p.friend_code = upper(trim(code)) and p.id <> me;
  if them is null then raise exception 'No account has that friend ID'; end if;
  insert into public.friendships (user_a, user_b, requested_by)
  values (least(me, them), greatest(me, them), me)
  on conflict (user_a, user_b) do update
    set status = 'pending', requested_by = me, updated_at = now()
    where public.friendships.status = 'declined'
  returning id into friendship_id;
  if friendship_id is null then raise exception 'A friend connection already exists'; end if;
  return friendship_id;
end;
$$;

create function public.respond_to_friend_request(request_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  update public.friendships f
  set status = case when accept_request then 'accepted' else 'declined' end,
      updated_at = now()
  where f.id = request_id and f.status = 'pending'
    and me in (f.user_a, f.user_b) and f.requested_by <> me;
  if not found then raise exception 'This request is unavailable'; end if;
end;
$$;

revoke all on function public.make_profile() from public, anon, authenticated;
revoke all on function public.find_friend_by_code(text) from public, anon;
revoke all on function public.request_friend(text) from public, anon;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
grant execute on function public.find_friend_by_code(text) to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
