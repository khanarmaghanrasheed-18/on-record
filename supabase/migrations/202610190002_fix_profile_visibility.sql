-- Fix an ambiguous id in the original profile policy. It must refer to the
-- profile being read, not the friendship row's own id.
alter policy profiles_visible_to_connections on public.profiles
using (
  id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where (f.user_a = public.profiles.id or f.user_b = public.profiles.id)
      and (f.user_a = (select auth.uid()) or f.user_b = (select auth.uid()))
  )
);
