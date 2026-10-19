-- A revised topic needs fresh answers from everyone before AI can lock it.
-- Keep this as one transaction so no participant sees a new topic with an old answer.
create or replace function public.edit_claim_topic(p_claim_id uuid, p_topic text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_topic text;
  record_state text;
  check_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(p_topic)) not between 10 and 300 then
    raise exception 'Describe the claim in 10 to 300 characters';
  end if;

  select c.topic, c.status, c.due_at
    into current_topic, record_state, check_time
    from public.claims c
    where c.id = p_claim_id and c.creator_id = auth.uid()
    for update;
  if not found or record_state <> 'collecting' or check_time <= now() then
    raise exception 'This claim can no longer be revised';
  end if;
  if current_topic = trim(p_topic) then
    raise exception 'Change the topic, or edit your answer instead';
  end if;

  update public.claims c set topic = trim(p_topic) where c.id = p_claim_id;
  update public.claim_members cm
    set invite_status = 'pending', original_answer = null,
        normalized_choice = null, vote = null
    where cm.claim_id = p_claim_id and cm.invite_status = 'answered';
end;
$$;
