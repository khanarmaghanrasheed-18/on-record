import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, type FriendConnection, type Profile } from '../lib/supabase'
import { checkAndLockClaim, displayDate, getClaimDetail, isDue, listClaims, type Claim, type ClaimDetail } from '../lib/claims'

type View = 'list' | 'new' | 'detail'

function readyToLock(detail: ClaimDetail) {
  const active = detail.members.filter(member => member.invite_status !== 'declined')
  return active.length >= 2 && active.every(member => member.invite_status === 'answered')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

export default function ClaimWorkspace({ profile, connections }: { profile: Profile; connections: FriendConnection[] }) {
  const friends = connections.filter(connection => connection.status === 'accepted').map(connection => connection.person)
  const [view, setView] = useState<View>('list')
  const [records, setRecords] = useState<Claim[]>([])
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')
  const [due, setDue] = useState('')
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [answer, setAnswer] = useState('')
  const [editingAnswer, setEditingAnswer] = useState(false)
  const [replacementFriend, setReplacementFriend] = useState('')
  const [rescheduleDue, setRescheduleDue] = useState('')

  const refreshList = useCallback(async () => {
    try { setRecords(await listClaims()); setMessage('') }
    catch (error) { setMessage(errorMessage(error)) }
    finally { setLoading(false) }
  }, [])

  const refreshDetail = useCallback(async (id: string) => {
    const result = await getClaimDetail(id)
    setDetail(result)
    setAnswer(result.members.find(member => member.user_id === profile.id)?.original_answer || '')
    setTopic(result.claim.topic)
    return result
  }, [profile.id])

  useEffect(() => { void refreshList() }, [refreshList])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void refreshList()
      if (detail) void refreshDetail(detail.claim.id).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [detail, refreshDetail, refreshList])

  async function openDetail(id: string) {
    setLoading(true)
    setMessage('')
    setEditingAnswer(false)
    try { await refreshDetail(id); setView('detail') }
    catch (error) { setMessage(errorMessage(error)) }
    finally { setLoading(false) }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!friendIds.length) { setMessage('Choose at least one friend.'); return }
    const date = new Date(due)
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) { setMessage('Choose a future check time.'); return }
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('create_claim', {
        p_topic: topic.trim(), p_due_at: date.toISOString(), p_friend_ids: friendIds,
      })
      if (error) throw error
      await refreshList()
      await openDetail(data as string)
      setMessage('Claim created. Write your answer; your friends can now add theirs.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function runCheck(id: string) {
    setBusy(true)
    setMessage('AI is checking whether everyone’s words can be settled fairly…')
    try {
      const result = await checkAndLockClaim(id)
      if (result.locked) {
        await Promise.all([refreshDetail(id), refreshList()])
        setMessage('The claim is clear and now on record. Original answers are locked.')
      } else {
        setMessage(`${result.feedback || 'Make the claim more precise.'} Revise the topic or edit an answer, then submit again.`)
      }
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function saveAnswer(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !detail) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('answer_claim', { p_claim_id: detail.claim.id, p_answer: answer.trim() })
      if (error) throw error
      const updated = await refreshDetail(detail.claim.id)
      setEditingAnswer(false)
      setMessage('Your words are saved privately until the claim locks.')
      if (readyToLock(updated)) await runCheck(detail.claim.id)
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function editTopic(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !detail) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('edit_claim_topic', { p_claim_id: detail.claim.id, p_topic: topic.trim() })
      if (error) throw error
      await refreshDetail(detail.claim.id)
      setEditingAnswer(false)
      setMessage('Claim revised. Everyone can now submit a fresh answer; AI checks automatically after the last submission.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function decline() {
    if (!supabase || !detail) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('decline_claim', { p_claim_id: detail.claim.id })
      if (error) throw error
      setView('list')
      setDetail(null)
      await refreshList()
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function invite(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !detail || !replacementFriend) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('invite_to_claim', {
        p_claim_id: detail.claim.id, p_friend_id: replacementFriend,
      })
      if (error) throw error
      setReplacementFriend('')
      await refreshDetail(detail.claim.id)
      setMessage('Friend invited. The claim will wait for their answer.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function reschedule(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !detail) return
    const date = new Date(rescheduleDue)
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setMessage('Choose a future check time.'); return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('reschedule_claim', {
        p_claim_id: detail.claim.id, p_due_at: date.toISOString(),
      })
      if (error) throw error
      await refreshDetail(detail.claim.id)
      await refreshList()
      setRescheduleDue('')
      setMessage('The check time was extended. Friends can finish their answers.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  const me = detail?.members.find(member => member.user_id === profile.id)
  const availableFriends = friends.filter(friend => !detail?.members.some(member => member.user_id === friend.id))
  const canEdit = detail?.claim.status === 'collecting' && new Date(detail.claim.due_at).getTime() > Date.now()
  const expiredDraft = detail?.claim.status === 'collecting' && !canEdit

  if (view === 'new') return <div className="page-content claim-workspace">
    <div className="page-topline"><span className="eyebrow">NEW ENTRY</span><span>01 / CLAIMS</span></div>
    <button className="back-link" onClick={() => { setView('list'); setMessage('') }}>← Back to records</button>
    <h1>Put it on record<span className="period">.</span></h1>
    <p className="page-lead">Start with the future event. Each friend will write their own answer before AI checks and locks the shared record.</p>
    <form className="paper-card claim-form" onSubmit={create}>
      <label>What are you predicting?<textarea value={topic} onChange={event => setTopic(event.target.value)} minLength={10} maxLength={300} rows={4} placeholder="Who will win the Manchester derby on Saturday?" required /></label>
      <label>When should everyone check the result?<input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} required /></label>
      <fieldset><legend>Bring your friends in</legend>{friends.length ? friends.map(friend => <label className="friend-choice" key={friend.id}><input type="checkbox" checked={friendIds.includes(friend.id)} onChange={event => setFriendIds(event.target.checked ? [...friendIds, friend.id] : friendIds.filter(id => id !== friend.id))} /><span className="avatar">{friend.display_name[0]}</span><span>{friend.display_name}</span></label>) : <p className="muted">Add a friend in the Friends tab first.</p>}</fieldset>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button primary" disabled={busy || !friends.length}>Create claim ↗</button>
    </form>
  </div>

  if (view === 'detail' && detail) return <div className="page-content claim-workspace">
    <div className="page-topline"><span className="eyebrow">RECORDED CLAIM</span><span>{detail.claim.status.toUpperCase()}</span></div>
    <button className="back-link" onClick={() => { setView('list'); setMessage(''); void refreshList() }}>← Back to records</button>
    <div className="claim-title-row"><div><span className="eyebrow">ENTRY · {detail.claim.id.slice(0, 8).toUpperCase()}</span><h1>{detail.claim.title || detail.claim.topic}<span className="period">.</span></h1></div><span className={`status-chip ${detail.claim.status}`}>{detail.claim.status === 'collecting' ? 'COLLECTING WORDS' : detail.claim.status.toUpperCase()}</span></div>
    <p className="page-lead">Check on {displayDate(detail.claim.due_at)} · Started by {detail.members.find(member => member.user_id === detail.claim.creator_id)?.profile?.display_name || 'a friend'}</p>
    {message && <p className="form-message" role="status">{message}</p>}
    {expiredDraft && <div className="lock-callout"><div><strong>The check time passed before this claim locked.</strong><p>{profile.id === detail.claim.creator_id ? 'Choose a later time so friends can finish.' : 'The creator can extend the check time.'}</p></div>{profile.id === detail.claim.creator_id && <form className="reschedule-form" onSubmit={reschedule}><label className="sr-only" htmlFor="reschedule-date">New check time</label><input id="reschedule-date" type="datetime-local" value={rescheduleDue} onChange={event => setRescheduleDue(event.target.value)} required /><button className="button primary" disabled={busy}>Extend date</button></form>}</div>}
    {detail.claim.status !== 'collecting' && <section className="paper-card final-wording"><span className="eyebrow">THE SHARED QUESTION</span><h2>{detail.claim.question}</h2><div className="option-list">{detail.claim.options?.map(option => <span key={option} className={detail.claim.settled_option === option ? 'winning-option' : ''}>{option}</span>)}</div>{detail.claim.status === 'settled' && <p className="result-line">Settled outcome: <strong>{detail.claim.settled_option}</strong></p>}</section>}
    {detail.claim.status === 'collecting' && <section className="paper-card topic-card"><span className="eyebrow">THE TOPIC</span>{profile.id === detail.claim.creator_id ? <form onSubmit={editTopic}><label className="sr-only" htmlFor="edit-topic">Revise claim topic</label><textarea id="edit-topic" value={topic} onChange={event => setTopic(event.target.value)} minLength={10} maxLength={300} rows={3} /><button className="button outlined" disabled={busy || topic.trim() === detail.claim.topic}>Revise claim and reset answers</button></form> : <h2>{detail.claim.topic}</h2>}<p>{profile.id === detail.claim.creator_id ? 'Changing the topic clears everyone’s draft answers so each friend can respond to the new wording.' : 'If the creator changes this topic, you can submit a fresh answer.'} AI checks automatically after everyone submits.</p></section>}
    <div className="section-head member-heading"><div><span className="eyebrow">ORIGINAL POSITIONS</span><h2>What everyone said</h2></div><span>{detail.members.filter(member => member.invite_status !== 'declined').length} PARTICIPANTS</span></div>
    <div className="member-list">{detail.members.map(member => <div className="member-entry" key={member.user_id}><span className="avatar">{member.profile?.display_name[0] || '?'}</span><div><strong>{member.profile?.display_name || 'Friend'}{member.user_id === profile.id ? ' (you)' : ''}</strong><p>{member.invite_status === 'declined' ? 'Declined the invitation' : member.original_answer || (member.invite_status === 'answered' ? 'Answer saved privately until lock' : 'Waiting for an answer')}</p>{member.normalized_choice && <small>Recorded as: {member.normalized_choice}</small>}</div><span className={`member-status ${member.invite_status}`}>{member.invite_status.toUpperCase()}</span></div>)}</div>
    {canEdit && me?.invite_status === 'answered' && !editingAnswer && <section className="paper-card answer-saved" aria-label="Your saved answer"><span className="eyebrow">YOUR ANSWER · SAVED</span><h2>Answer recorded ✓</h2><p>Your words are saved privately. You can change them until AI locks this claim.</p><div className="answer-actions"><button type="button" className="button outlined" onClick={() => setEditingAnswer(true)}>Edit my answer</button>{profile.id !== detail.claim.creator_id && <button type="button" className="text-button" disabled={busy} onClick={decline}>Decline invitation</button>}</div></section>}
    {canEdit && me?.invite_status !== 'declined' && (me?.invite_status !== 'answered' || editingAnswer) && <form className="paper-card answer-form" onSubmit={saveAnswer}><span className="eyebrow">YOUR WORDS</span><h2>{me?.invite_status === 'answered' ? 'Edit your answer' : 'Write your answer'}</h2><label className="sr-only" htmlFor="your-answer">Your prediction</label><textarea id="your-answer" value={answer} onChange={event => setAnswer(event.target.value)} minLength={2} maxLength={300} rows={3} placeholder="I think Manchester City will win." required /><div className="answer-actions"><button className="button primary" disabled={busy}>Save my answer</button>{me?.invite_status === 'answered' && <button type="button" className="text-button" disabled={busy} onClick={() => { setAnswer(me.original_answer || ''); setEditingAnswer(false) }}>Cancel edit</button>}{profile.id !== detail.claim.creator_id && <button type="button" className="text-button" disabled={busy} onClick={decline}>Decline invitation</button>}</div></form>}
    {canEdit && profile.id === detail.claim.creator_id && availableFriends.length > 0 && <form className="invite-extra" onSubmit={invite}><label>Add another friend if someone declined<select value={replacementFriend} onChange={event => setReplacementFriend(event.target.value)} required><option value="">Choose a friend</option>{availableFriends.map(friend => <option key={friend.id} value={friend.id}>{friend.display_name}</option>)}</select></label><button className="button outlined" disabled={busy || !replacementFriend}>Invite</button></form>}
    {canEdit && readyToLock(detail) && <div className="lock-callout"><div><strong>Everyone has answered.</strong><p>AI checks the claim automatically when an answer is submitted. If it needs revision, update the topic or edit an answer, then submit again.</p></div></div>}
    {detail.claim.status === 'locked' && <div className="hint-row"><span>◷</span><p>{isDue(detail.claim) ? 'This claim is due. Open Notices to vote on the result.' : 'The original answers are locked. Come back when the check time arrives.'}</p></div>}
  </div>

  return <div className="page-content claim-workspace">
    <div className="page-topline"><span className="eyebrow">YOUR RECORD BOOK</span><span>01 / HOME</span></div>
    <div className="welcome-row"><div><h1>Good to have you here,<br /><em>{profile.display_name}</em><span className="period">.</span></h1><p className="page-lead">Every great prediction starts with someone willing to put it in writing.</p></div><div className="ledger-stamp"><span>ON RECORD</span><strong>{String(records.length).padStart(2, '0')}</strong><small>ENTRIES TO DATE</small></div></div>
    <div className="section-head records-heading"><div><span className="eyebrow">THE LEDGER</span><h2>Claims on record</h2></div><button className="button primary" onClick={() => { setView('new'); setTopic(''); setDue(''); setFriendIds([]); setMessage('') }}>＋ New claim</button></div>
    {message && <p className="form-message" role="status">{message}</p>}
    {loading ? <p className="muted">Opening records…</p> : records.length ? <div className="record-stack">{records.map((record, index) => <button key={record.id} className={`record-card color-${index % 4}`} onClick={() => void openDetail(record.id)}><span className="record-number">ENTRY {String(records.length - index).padStart(3, '0')} · {record.status.toUpperCase()}</span><strong>{record.title || record.topic}</strong><small>{displayDate(record.due_at)} <span>↗</span></small></button>)}</div> : <div className="claim-card-preview"><div className="card-stripe" /><div className="claim-inner"><span className="claim-number">ENTRY NO. 001 <span>✦</span> YOUR TURN</span><h3>Your first claim belongs here.</h3><p>{friends.length ? 'Your circle is ready. Write a claim, choose friends, and set a check time.' : 'Add a friend, then you can put your first prediction on record.'}</p><button className="inline-link" onClick={() => { setView('new'); setMessage('') }}>Start a claim <span>↗</span></button></div></div>}
    <div className="hint-row"><span>✳</span><p>Original words stay. Results settle the score. Everyone remembers who called it.</p></div>
  </div>
}
