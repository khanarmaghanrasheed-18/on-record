-- A dated claim and each participant's original answer.
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (char_length(topic) between 10 and 300),
  due_at timestamptz not null,
  status text not null default 'collecting' check (status in ('collecting', 'locked', 'settled')),
  title text,
  question text,
  options text[],
  locked_at timestamptz,
  settled_option text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint locked_fields_together check (
    (status = 'collecting' and locked_at is null and title is null and question is null and options is null)
    or (status in ('locked', 'settled') and locked_at is not null and title is not null and question is not null and options is not null)
  ),
  constraint settlement_fields_together check (
    (status <> 'settled' and settled_at is null and settled_option is null)
    or (status = 'settled' and settled_at is not null and settled_option is not null)
  )
);

create table public.claim_members (
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invite_status text not null default 'pending' check (invite_status in ('pending', 'answered', 'declined')),
  original_answer text check (original_answer is null or char_length(original_answer) between 2 and 300),
  normalized_choice text,
  vote text,
  joined_at timestamptz not null default now(),
  primary key (claim_id, user_id),
  constraint answer_when_answered check (
    (invite_status = 'answered' and original_answer is not null)
    or (invite_status <> 'answered' and original_answer is null)
  )
);

create index claims_due_idx on public.claims(due_at) where status = 'locked';
create index claim_members_user_idx on public.claim_members(user_id, claim_id);

-- SECURITY DEFINER avoids a claims <-> claim_members RLS recursion.
create function public.is_claim_member(p_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.user_id = auth.uid() and cm.invite_status <> 'declined'
  );
$$;

-- Profile RLS must not query claim_members as the browser role because direct
-- table access is revoked to keep draft answers private.
create function public.shares_claim_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.claim_members mine
    join public.claim_members other_member on other_member.claim_id = mine.claim_id
    where mine.user_id = auth.uid() and mine.invite_status <> 'declined'
      and other_member.user_id = p_user_id
  );
$$;

alter table public.claims enable row level security;
alter table public.claim_members enable row level security;
create policy claims_for_participants on public.claims
for select to authenticated using (public.is_claim_member(id));
create policy member_answers_for_participants on public.claim_members
for select to authenticated using (public.is_claim_member(claim_id));

-- Members of a group claim may not be direct friends, but can see each other's
-- public display identity on that record.
alter policy profiles_visible_to_connections on public.profiles
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.friendships f
    where (f.user_a = public.profiles.id or f.user_b = public.profiles.id)
      and (f.user_a = (select auth.uid()) or f.user_b = (select auth.uid()))
  )
  or public.shares_claim_with(id)
);

revoke all on public.claims, public.claim_members from anon, authenticated;
grant select on public.claims to authenticated;
grant select, insert, update, delete on public.claims, public.claim_members to service_role;

-- Read drafts through an RPC so another participant cannot inspect an
-- answer before locking by bypassing the browser's hidden UI.
create function public.get_claim_members(p_claim_id uuid)
returns table (
  user_id uuid, invite_status text, original_answer text,
  normalized_choice text, vote text, joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  claim_state text;
begin
  if not public.is_claim_member(p_claim_id) then raise exception 'Claim unavailable'; end if;
  select c.status into claim_state from public.claims c where c.id = p_claim_id;
  return query select cm.user_id, cm.invite_status,
    case when cm.user_id = auth.uid() or claim_state <> 'collecting' then cm.original_answer else null end,
    case when claim_state <> 'collecting' then cm.normalized_choice else null end,
    case when cm.user_id = auth.uid() or claim_state = 'settled' then cm.vote else null end,
    cm.joined_at
    from public.claim_members cm where cm.claim_id = p_claim_id order by cm.joined_at;
end;
$$;

create function public.create_claim(p_topic text, p_due_at timestamptz, p_friend_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  friend_id uuid;
  new_claim_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(trim(p_topic)) not between 10 and 300 then raise exception 'Describe the claim in 10 to 300 characters'; end if;
  if p_due_at <= now() + interval '10 seconds' then raise exception 'Choose a future check time'; end if;
  if p_friend_ids is null or cardinality(p_friend_ids) not between 1 and 8 then
    raise exception 'Choose between one and eight friends';
  end if;
  if array_position(p_friend_ids, me) is not null or
     (select count(distinct x) from unnest(p_friend_ids) x) <> cardinality(p_friend_ids) then
    raise exception 'Choose each friend once';
  end if;
  foreach friend_id in array p_friend_ids loop
    if not exists (
      select 1 from public.friendships f where f.status = 'accepted'
      and ((f.user_a = least(me, friend_id) and f.user_b = greatest(me, friend_id)))
    ) then raise exception 'Every participant must be an accepted friend'; end if;
  end loop;
  insert into public.claims (creator_id, topic, due_at)
  values (me, trim(p_topic), p_due_at) returning id into new_claim_id;
  insert into public.claim_members (claim_id, user_id) values (new_claim_id, me);
  insert into public.claim_members (claim_id, user_id)
    select new_claim_id, unnest(p_friend_ids);
  return new_claim_id;
end;
$$;

create function public.answer_claim(p_claim_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  record_state text;
  check_time timestamptz;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(trim(p_answer)) not between 2 and 300 then
    raise exception 'Write an answer in 2 to 300 characters';
  end if;
  select c.status, c.due_at into record_state, check_time
    from public.claims c where c.id = p_claim_id for update;
  if record_state <> 'collecting' or check_time <= now() then
    raise exception 'This claim no longer accepts answers';
  end if;
  update public.claim_members cm set invite_status = 'answered', original_answer = trim(p_answer)
    where cm.claim_id = p_claim_id and cm.user_id = me and cm.invite_status <> 'declined';
  if not found then raise exception 'You are not an active participant'; end if;
end;
$$;

create function public.edit_claim_topic(p_claim_id uuid, p_topic text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(p_topic)) not between 10 and 300 then
    raise exception 'Describe the claim in 10 to 300 characters';
  end if;
  update public.claims c set topic = trim(p_topic)
    where c.id = p_claim_id and c.creator_id = auth.uid()
      and c.status = 'collecting' and c.due_at > now();
  if not found then raise exception 'This topic can no longer be edited'; end if;
end;
$$;

create function public.decline_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  claim_creator uuid;
  record_state text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select c.creator_id, c.status into claim_creator, record_state
    from public.claims c where c.id = p_claim_id for update;
  if claim_creator = me or record_state <> 'collecting' then
    raise exception 'This invitation cannot be declined';
  end if;
  update public.claim_members cm
    set invite_status = 'declined', original_answer = null, normalized_choice = null
    where cm.claim_id = p_claim_id and cm.user_id = me and cm.invite_status <> 'declined';
  if not found then raise exception 'Invitation unavailable'; end if;
end;
$$;

create function public.invite_to_claim(p_claim_id uuid, p_friend_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  claim_creator uuid;
  record_state text;
  check_time timestamptz;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select c.creator_id, c.status, c.due_at into claim_creator, record_state, check_time
    from public.claims c where c.id = p_claim_id for update;
  if claim_creator <> me or record_state <> 'collecting' or check_time <= now() then
    raise exception 'Only the creator can add friends before the check time';
  end if;
  if (select count(*) from public.claim_members cm where cm.claim_id = p_claim_id) >= 9 then
    raise exception 'This claim already has nine participants';
  end if;
  if not exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and f.user_a = least(me, p_friend_id) and f.user_b = greatest(me, p_friend_id)
  ) then raise exception 'Choose an accepted friend'; end if;
  insert into public.claim_members (claim_id, user_id) values (p_claim_id, p_friend_id);
end;
$$;

-- Only the server-side AI function may finalize a record. This RPC runs as
-- one database transaction, so no partially locked record can be displayed.
create function public.finalize_claim(
  p_claim_id uuid, p_title text, p_question text, p_options text[],
  p_member_ids uuid[], p_choices text[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  record_state text;
  check_time timestamptz;
  active_count integer;
begin
  select c.status, c.due_at into record_state, check_time
    from public.claims c where c.id = p_claim_id for update;
  if record_state <> 'collecting' or check_time <= now() then raise exception 'Claim cannot be locked'; end if;
  select count(*) into active_count from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.invite_status <> 'declined';
  if active_count < 2 or exists (
    select 1 from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.invite_status = 'pending'
  ) then raise exception 'All active participants must answer first'; end if;
  if char_length(trim(p_title)) not between 4 and 80 or
     char_length(trim(p_question)) not between 10 and 300 or
     cardinality(p_options) not between 2 and 6 or
     'NONE_OF_THESE' = any(p_options) or
     cardinality(p_member_ids) <> active_count or cardinality(p_choices) <> active_count or
     (select count(distinct x) from unnest(p_options) x) <> cardinality(p_options) or
     (select count(distinct x) from unnest(p_member_ids) x) <> active_count then
    raise exception 'AI result has an invalid shape';
  end if;
  if exists (
    select 1 from unnest(p_options) x where x is null or char_length(trim(x)) not between 1 and 80
  ) or exists (
    select 1 from unnest(p_choices) x where x is null or not (x = any(p_options))
  ) or exists (
    select 1 from public.claim_members cm where cm.claim_id = p_claim_id
      and cm.invite_status = 'answered' and not (cm.user_id = any(p_member_ids))
  ) then raise exception 'AI result does not match submitted answers'; end if;
  update public.claim_members cm
    set normalized_choice = p_choices[array_position(p_member_ids, cm.user_id)]
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered';
  update public.claims c set status = 'locked', title = trim(p_title),
    question = trim(p_question), options = p_options, locked_at = now()
    where c.id = p_claim_id;
end;
$$;

revoke all on function public.is_claim_member(uuid) from public, anon;
revoke all on function public.shares_claim_with(uuid) from public, anon;
revoke all on function public.get_claim_members(uuid) from public, anon;
revoke all on function public.create_claim(text, timestamptz, uuid[]) from public, anon;
revoke all on function public.answer_claim(uuid, text) from public, anon;
revoke all on function public.edit_claim_topic(uuid, text) from public, anon;
revoke all on function public.decline_claim(uuid) from public, anon;
revoke all on function public.invite_to_claim(uuid, uuid) from public, anon;
revoke all on function public.finalize_claim(uuid, text, text, text[], uuid[], text[]) from public, anon, authenticated;
grant execute on function public.is_claim_member(uuid) to authenticated;
grant execute on function public.shares_claim_with(uuid) to authenticated;
grant execute on function public.get_claim_members(uuid) to authenticated;
grant execute on function public.create_claim(text, timestamptz, uuid[]) to authenticated;
grant execute on function public.answer_claim(uuid, text) to authenticated;
grant execute on function public.edit_claim_topic(uuid, text) to authenticated;
grant execute on function public.decline_claim(uuid) to authenticated;
grant execute on function public.invite_to_claim(uuid, uuid) to authenticated;
grant execute on function public.finalize_claim(uuid, text, text, text[], uuid[], text[]) to service_role;
