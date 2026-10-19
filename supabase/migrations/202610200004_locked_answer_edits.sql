-- Keep the first lock time as the permanent five-minute deadline.
alter table public.claims add column revision integer not null default 0 check (revision >= 0);

-- Called only by the authenticated Edge Function after another AI clarity check.
-- A row lock and revision number prevent concurrent edits from overwriting one another.
create function public.revise_locked_answer(
  p_claim_id uuid, p_actor_id uuid, p_answer text, p_expected_revision integer,
  p_title text, p_question text, p_options text[],
  p_member_ids uuid[], p_choices text[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  record_row public.claims%rowtype;
  active_count integer;
begin
  select * into record_row from public.claims where id = p_claim_id for update;
  if record_row.id is null or record_row.status <> 'locked'
     or clock_timestamp() >= least(record_row.locked_at + interval '5 minutes', record_row.due_at) then
    raise exception 'The answer edit window has closed';
  end if;
  if record_row.revision <> p_expected_revision then
    raise exception 'This claim changed. Reload and try again';
  end if;
  if p_actor_id is null or char_length(trim(p_answer)) not between 2 and 300 or not exists (
    select 1 from public.claim_members cm where cm.claim_id = p_claim_id
      and cm.user_id = p_actor_id and cm.invite_status = 'answered'
  ) then raise exception 'This answer cannot be edited'; end if;

  select count(*) into active_count from public.claim_members cm
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered';
  if p_title is null or p_question is null or p_options is null or
     p_member_ids is null or p_choices is null or
     char_length(trim(p_title)) not between 4 and 80 or
     char_length(trim(p_question)) not between 10 and 300 or
     cardinality(p_options) not between 2 and 6 or
     'NONE_OF_THESE' = any(p_options) or
     cardinality(p_member_ids) <> active_count or
     cardinality(p_choices) <> active_count or
     (select count(distinct x) from unnest(p_options) x) <> cardinality(p_options) or
     (select count(distinct x) from unnest(p_member_ids) x) <> active_count then
    raise exception 'AI result has an invalid shape';
  end if;
  if exists (select 1 from unnest(p_options) x where x is null or char_length(trim(x)) not between 1 and 80)
     or exists (select 1 from unnest(p_choices) x where x is null or not (x = any(p_options)))
     or exists (
       select 1 from public.claim_members cm where cm.claim_id = p_claim_id
         and cm.invite_status = 'answered' and not (cm.user_id = any(p_member_ids))
     ) then raise exception 'AI result does not match participants'; end if;

  update public.claim_members cm
    set original_answer = case when cm.user_id = p_actor_id then trim(p_answer) else cm.original_answer end,
        normalized_choice = p_choices[array_position(p_member_ids, cm.user_id)]
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered';
  update public.claims c
    set title = trim(p_title), question = trim(p_question), options = p_options,
        revision = revision + 1
    where c.id = p_claim_id;
end;
$$;

revoke all on function public.revise_locked_answer(uuid, uuid, text, integer, text, text, text[], uuid[], text[]) from public, anon, authenticated;
grant execute on function public.revise_locked_answer(uuid, uuid, text, integer, text, text, text[], uuid[], text[]) to service_role;
