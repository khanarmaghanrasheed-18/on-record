-- Votes and scores are handled in the database so simultaneous votes cannot
-- settle a record twice and a page reload cannot award another point.
-- A creator can extend an unfinished claim after its check time passes.
create function public.reschedule_claim(p_claim_id uuid, p_due_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_due_at is null or p_due_at <= now() + interval '10 seconds' then
    raise exception 'Choose a future check time';
  end if;
  update public.claims c set due_at = p_due_at
    where c.id = p_claim_id and c.creator_id = auth.uid() and c.status = 'collecting';
  if not found then raise exception 'Only the creator can extend an unfinished claim'; end if;
end;
$$;

create function public.vote_and_settle(p_claim_id uuid, p_choice text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  record_state text;
  check_time timestamptz;
  choices text[];
  creator uuid;
  active_count integer;
  votes_count integer;
  leading_choice text;
  leading_count integer;
  final_choice text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  -- This row lock serializes every vote on the same claim.
  select c.status, c.due_at, c.options, c.creator_id
    into record_state, check_time, choices, creator
    from public.claims c where c.id = p_claim_id for update;
  if record_state is distinct from 'locked' then
    raise exception 'This claim is not open for voting';
  end if;
  if check_time > now() then raise exception 'Voting opens at the check time'; end if;
  if p_choice is null or (p_choice <> 'NONE_OF_THESE' and not (p_choice = any(choices))) then
    raise exception 'Choose one of the recorded outcomes';
  end if;
  update public.claim_members cm set vote = p_choice
    where cm.claim_id = p_claim_id and cm.user_id = me and cm.invite_status = 'answered';
  if not found then raise exception 'Only active participants can vote'; end if;

  select count(*), count(cm.vote) into active_count, votes_count
    from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered';
  select cm.vote, count(*)::integer into leading_choice, leading_count
    from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered' and cm.vote is not null
    group by cm.vote order by count(*) desc, cm.vote limit 1;

  if leading_count > active_count / 2 then
    final_choice := leading_choice;
  elsif active_count = 2 and votes_count = 2 then
    select cm.vote into final_choice from public.claim_members cm
      where cm.claim_id = p_claim_id and cm.user_id = creator;
  end if;

  if final_choice is not null then
    update public.claims c set status = 'settled', settled_option = final_choice, settled_at = now()
      where c.id = p_claim_id;
    return 'settled';
  end if;
  return 'pending';
end;
$$;

-- Counts only shared settled claims. Same-correctness pairs score zero.
create function public.head_to_head(p_friend_id uuid)
returns table (my_points bigint, friend_points bigint, shared_claims bigint)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or p_friend_id is null then raise exception 'Sign in first'; end if;
  if not exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and f.user_a = least(me, p_friend_id) and f.user_b = greatest(me, p_friend_id)
  ) then raise exception 'Choose an accepted friend'; end if;
  return query
    select
      count(*) filter (where mine.normalized_choice = c.settled_option
        and theirs.normalized_choice <> c.settled_option),
      count(*) filter (where theirs.normalized_choice = c.settled_option
        and mine.normalized_choice <> c.settled_option),
      count(*)
    from public.claims c
    join public.claim_members mine on mine.claim_id = c.id and mine.user_id = me
      and mine.invite_status = 'answered'
    join public.claim_members theirs on theirs.claim_id = c.id and theirs.user_id = p_friend_id
      and theirs.invite_status = 'answered'
    where c.status = 'settled';
end;
$$;

-- Multiple friends may hold the same rank. A correct claim counts once for a
-- profile even when it beats several friends head to head.
create function public.profile_stats(p_user_id uuid)
returns table (correct_claims bigint, settled_claims bigint, title text)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wins bigint;
  finished bigint;
begin
  if me is null or p_user_id is null then raise exception 'Sign in first'; end if;
  if me <> p_user_id and not exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and f.user_a = least(me, p_user_id) and f.user_b = greatest(me, p_user_id)
  ) then raise exception 'Choose your profile or an accepted friend'; end if;
  select
    count(*) filter (where cm.normalized_choice = c.settled_option),
    count(*)
    into wins, finished
    from public.claim_members cm
    join public.claims c on c.id = cm.claim_id and c.status = 'settled'
    where cm.user_id = p_user_id and cm.invite_status = 'answered';
  return query select wins, finished,
    case when wins >= 15 then 'Conqueror'
         when wins >= 5 then 'Challenger'
         when wins >= 1 then 'Contender'
         else 'Newcomer' end;
end;
$$;

revoke all on function public.reschedule_claim(uuid, timestamptz) from public, anon;
revoke all on function public.vote_and_settle(uuid, text) from public, anon;
revoke all on function public.head_to_head(uuid) from public, anon;
revoke all on function public.profile_stats(uuid) from public, anon;
grant execute on function public.reschedule_claim(uuid, timestamptz) to authenticated;
grant execute on function public.vote_and_settle(uuid, text) to authenticated;
grant execute on function public.head_to_head(uuid) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;
