import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase, type FriendConnection, type Profile } from '../lib/supabase'
import { checkAndLockClaim, displayDate, getClaimDetail, isDue, listClaims, type Claim, type ClaimDetail } from '../lib/claims'
import { outcomeLabel } from '../lib/outcome'
import { leaveSubView, pushSubView, readSubView, replaceSubView } from '../lib/history'
import Toast from './Toast'
import SettlementSummary from './SettlementSummary'
import Avatar from './Avatar'
import CountUp from './CountUp'
import Icon, { Logo, Spinner, type IconName } from './Icon'

type View = 'list' | 'new' | 'detail'
type NextStep = { icon: IconName; title: string; text: string; tone: string; action?: { label: string; run: () => void } }

const cardTones = ['lime', 'mint', 'aqua', 'deep']
const steps = ['Answers in', 'AI locked', 'Check time', 'Settled']

// The one-line status and next action shown on each record card.
function recordState(claim: Claim, now: number): { tone: string; label: string; icon: IconName; next: string } {
  if (claim.status === 'settled') return { tone: 'settled', label: 'Settled', icon: 'check', next: `Result: ${outcomeLabel(claim.settled_option)}` }
  if (isDue(claim)) return { tone: 'due', label: 'Vote now', icon: 'vote', next: 'Check time reached. Record the result.' }
  if (claim.status === 'locked') return { tone: 'locked', label: 'Locked', icon: 'lock', next: `Result due ${displayDate(claim.due_at)}` }
  if (new Date(claim.due_at).getTime() <= now) return { tone: 'stalled', label: 'Needs a date', icon: 'clock', next: 'The check time passed before it locked.' }
  return { tone: 'collecting', label: 'Recording', icon: 'pen', next: `Answers close ${displayDate(claim.due_at)}` }
}

function readyToLock(detail: ClaimDetail) {
  const active = detail.members.filter(member => member.invite_status !== 'declined')
  return active.length >= 2 && active.every(member => member.invite_status === 'answered')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

export default function ClaimWorkspace({ profile, connections, onOpenNotices }: { profile: Profile; connections: FriendConnection[]; onOpenNotices?: () => void }) {
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
  const [clarityIssue, setClarityIssue] = useState<{ kind: 'rejected' | 'error'; text: string } | null>(null)
  const [checkingClaim, setCheckingClaim] = useState(false)
  const feedbackRef = useRef<HTMLFormElement>(null)
  const [replacementFriend, setReplacementFriend] = useState('')
  const [rescheduleDue, setRescheduleDue] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [])

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
    if (clarityIssue) feedbackRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }, [clarityIssue])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void refreshList()
      if (detail) void refreshDetail(detail.claim.id).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [detail, refreshDetail, refreshList])

  async function openDetail(id: string, history: 'push' | 'replace' | 'none' = 'push') {
    setLoading(true)
    setMessage('')
    setEditingAnswer(false)
    setClarityIssue(null)
    try {
      await refreshDetail(id)
      setView('detail')
      if (history === 'push') pushSubView({ kind: 'claim', id })
      if (history === 'replace') replaceSubView({ kind: 'claim', id })
    }
    catch (error) { setMessage(errorMessage(error)) }
    finally { setLoading(false) }
  }
  const openDetailRef = useRef(openDetail)
  openDetailRef.current = openDetail

  // Follow browser Back/Forward between the list, the new-claim form, and a claim.
  useEffect(() => {
    const show = (state: unknown, initial: boolean) => {
      const sub = readSubView(state)
      if (sub?.kind === 'claim') void openDetailRef.current(sub.id, 'none')
      else if (sub?.kind === 'new-claim') { setView('new'); setMessage('') }
      else if (!initial) { setView('list'); setMessage(''); setEditingAnswer(false); setClarityIssue(null); void refreshList() }
    }
    show(window.history.state, true)
    const onPop = (event: PopStateEvent) => show(event.state, false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [refreshList])

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
      await openDetail(data as string, 'replace')
      setMessage('Claim created. Write your answer; your friends can now add theirs.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function runCheck(id: string) {
    setBusy(true)
    setCheckingClaim(true)
    setClarityIssue(null)
    setMessage('')
    try {
      const result = await checkAndLockClaim(id)
      if (result.locked) {
        try {
          await Promise.all([refreshDetail(id), refreshList()])
          setMessage('The claim is clear and now on record. Original answers are locked.')
        } catch {
          setMessage('The claim locked, but this page could not refresh. Reopen the record to see it.')
        }
      } else {
        setMessage('')
        setEditingAnswer(true)
        setClarityIssue({ kind: 'rejected', text: `${result.feedback || 'Make the claim more precise.'} Revise the topic or your answer, then submit again.` })
      }
    } catch (error) {
      setMessage('')
      setEditingAnswer(true)
      setClarityIssue({ kind: 'error', text: `${errorMessage(error)} Your answer is saved; submit it again to retry.` })
    }
    finally { setCheckingClaim(false); setBusy(false) }
  }

  async function saveAnswer(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !detail) return
    setBusy(true)
    setMessage('')
    setClarityIssue(null)
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

  async function reviseLockedAnswer(event: FormEvent) {
    event.preventDefault()
    if (!detail || !answer.trim()) return
    setBusy(true)
    setCheckingClaim(true)
    setClarityIssue(null)
    setMessage('')
    try {
      const result = await checkAndLockClaim(detail.claim.id, answer.trim())
      if (!result.locked) {
        setClarityIssue({ kind: 'rejected', text: result.feedback || 'Make your answer more precise, then submit again.' })
        return
      }
      await Promise.all([refreshDetail(detail.claim.id), refreshList()])
      setEditingAnswer(false)
      setMessage('Your revised answer is on record. The shared question was checked again.')
    } catch (error) {
      setClarityIssue({ kind: 'error', text: `${errorMessage(error)} Your previous answer is unchanged.` })
    } finally { setCheckingClaim(false); setBusy(false) }
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
      setClarityIssue(null)
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
      if (!leaveSubView('claim')) setView('list')
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
  const editDeadline = detail?.claim.locked_at ? Math.min(new Date(detail.claim.locked_at).getTime() + 300000, new Date(detail.claim.due_at).getTime()) : 0
  const canReviseLocked = detail?.claim.status === 'locked' && now < editDeadline && me?.invite_status === 'answered'

  const backToList = () => { if (!leaveSubView('claim')) { setView('list'); setMessage(''); void refreshList() } }
  const startNew = () => { pushSubView({ kind: 'new-claim' }); setView('new'); setTopic(''); setDue(''); setFriendIds([]); setMessage('') }

  if (view === 'new') return <div className="page-content claim-workspace">
    <div key="new" className="view-stage">
      <button className="back-link" onClick={() => { if (!leaveSubView('new-claim')) { setView('list'); setMessage('') } }}><Icon name="back" size={16} /> Back to records</button>
      <header className="page-hero"><span className="eyebrow">New entry</span><h1>Put it on record<span className="period">.</span></h1><p className="page-lead">Start with the future event. Each friend writes their own answer before AI checks and locks the shared record.</p></header>
      <form className="card claim-form" onSubmit={create}>
        <div className="form-step"><span className="step-num" aria-hidden="true">1</span><label>What are you predicting?<textarea value={topic} onChange={event => setTopic(event.target.value)} minLength={10} maxLength={300} rows={4} placeholder="Who will win the Manchester derby on Saturday?" required /><small className="char-count">{topic.length}/300 · Be specific: who, what, and how you will know.</small></label></div>
        <div className="form-step"><span className="step-num" aria-hidden="true">2</span><label>When should everyone check the result?<input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} required /></label></div>
        <fieldset className="form-step"><span className="step-num" aria-hidden="true">3</span><legend>Bring your friends in</legend>{friends.length ? <div className="friend-chips">{friends.map(friend => <label className={`friend-choice${friendIds.includes(friend.id) ? ' checked' : ''}`} key={friend.id}><input type="checkbox" checked={friendIds.includes(friend.id)} onChange={event => setFriendIds(event.target.checked ? [...friendIds, friend.id] : friendIds.filter(id => id !== friend.id))} /><Avatar profile={friend} /><span>{friend.display_name}</span><span className="choice-check" aria-hidden="true"><Icon name="check" size={14} /></span></label>)}</div> : <p className="muted">Add a friend in the Friends tab first.</p>}</fieldset>
        <Toast message={message} onDismiss={() => setMessage('')} />
        <button className="button primary big" disabled={busy || !friends.length}>{busy ? <><Spinner size={20} /> Creating…</> : <>Create claim <Icon name="arrow" size={18} /></>}</button>
      </form>
    </div>
  </div>

  if (view === 'detail' && detail) {
    const claim = detail.claim
    const dueNow = isDue(claim)
    const isCreator = profile.id === claim.creator_id
    const active = detail.members.filter(member => member.invite_status !== 'declined')
    const waitingOn = active.filter(member => member.invite_status !== 'answered').length
    const completed = claim.status === 'settled' ? 4 : claim.status === 'locked' ? (dueNow ? 3 : 2) : readyToLock(detail) ? 1 : 0
    const stampLabel = claim.status === 'settled' ? 'Settled' : claim.status === 'locked' ? (dueNow ? 'Due' : 'Locked') : 'Recording'
    const lockedAt = claim.locked_at ? new Date(claim.locked_at).getTime() : 0
    const fuse = canReviseLocked && editDeadline > lockedAt ? Math.max(0, Math.min(1, (editDeadline - now) / (editDeadline - lockedAt))) : 0
    const minutesLeft = Math.max(1, Math.ceil((editDeadline - now) / 60000))
    const title = claim.title || claim.topic
    let next: NextStep | null = null
    if (claim.status === 'locked' && dueNow) next = { icon: 'vote', tone: 'due', title: 'Time to settle', text: 'This claim is due. Open Notices to vote on the result.', action: onOpenNotices ? { label: 'Vote in Notices', run: onOpenNotices } : undefined }
    else if (claim.status === 'locked' && canReviseLocked) next = { icon: 'clock', tone: 'window', title: 'Correction window open', text: `About ${minutesLeft} min left to fix only your own answer. After it closes, every answer stays permanent.` }
    else if (claim.status === 'locked') next = { icon: 'lock', tone: 'locked', title: 'Locked in', text: `The correction window is closed. Come back ${displayDate(claim.due_at)} to vote.` }
    else if (claim.status !== 'collecting' || expiredDraft) next = null
    else if (me?.invite_status === 'declined') next = { icon: 'close', tone: 'muted', title: 'You declined', text: 'This claim will not affect your score.' }
    else if (me && me.invite_status !== 'answered') next = { icon: 'pen', tone: 'you', title: 'Your move', text: 'Write your answer below. It stays private until the claim locks.' }
    else if (readyToLock(detail)) next = { icon: 'spark', tone: 'ready', title: 'Everyone has answered', text: 'AI checks the claim automatically when an answer is submitted. If it needs revision, update the topic or edit an answer, then submit again.' }
    else next = { icon: 'friends', tone: 'waiting', title: `Waiting on ${waitingOn} friend${waitingOn === 1 ? '' : 's'}`, text: 'AI checks and locks the claim as soon as the last answer lands.' }

    return <div className="page-content claim-workspace">
      <div key={`detail:${claim.id}`} className="view-stage">
        <button className="back-link" onClick={backToList}><Icon name="back" size={16} /> Back to records</button>
        <header className="claim-head">
          <div className="claim-head-top"><span className="eyebrow">Entry · {claim.id.slice(0, 8).toUpperCase()}</span><span key={stampLabel} className={`status-stamp ${claim.status}${dueNow ? ' due' : ''}`}>{claim.status === 'collecting' && <span className="rec-dot" aria-hidden="true" />}{stampLabel}</span></div>
          <h1>{title}{/[.!?]$/.test(title.trim()) ? null : <span className="period">.</span>}</h1>
          <p className="page-lead">Check on {displayDate(claim.due_at)} · Started by {detail.members.find(member => member.user_id === claim.creator_id)?.profile?.display_name || 'a friend'}</p>
        </header>
        <ol className="progress-track" aria-label="Claim progress">{steps.map((step, index) => <li key={step} className={index < completed ? 'done' : index === completed ? 'current' : ''} aria-current={index === completed ? 'step' : undefined}><span className="track-dot" aria-hidden="true">{index < completed ? <Icon name="check" size={12} /> : index + 1}</span><span>{step}</span></li>)}</ol>
        {next && <div className={`next-step ${next.tone}`}><span className="next-icon" aria-hidden="true"><Icon name={next.icon} size={20} /></span><div><span className="eyebrow">Next up</span><strong>{next.title}</strong><p>{next.text}</p>{next.tone === 'window' && <div className="fuse" aria-hidden="true"><span style={{ transform: `scaleX(${fuse})` }} /></div>}</div>{next.action && <button className="button primary" onClick={next.action.run}>{next.action.label} <Icon name="arrow" size={16} /></button>}</div>}
        <Toast message={clarityIssue?.text || message} tone={clarityIssue ? 'error' : 'info'} onDismiss={() => { setMessage(''); setClarityIssue(null) }} />
        {expiredDraft && <div className="next-step stalled"><span className="next-icon" aria-hidden="true"><Icon name="clock" size={20} /></span><div><span className="eyebrow">Next up</span><strong>The check time passed before this claim locked.</strong><p>{isCreator ? 'Choose a later time so friends can finish.' : 'The creator can extend the check time.'}</p>{isCreator && <form className="reschedule-form" onSubmit={reschedule}><label className="sr-only" htmlFor="reschedule-date">New check time</label><input id="reschedule-date" type="datetime-local" value={rescheduleDue} onChange={event => setRescheduleDue(event.target.value)} required /><button className="button primary" disabled={busy}>Extend date</button></form>}</div></div>}
        <SettlementSummary detail={detail} />
        {claim.status !== 'collecting' && <section className="card final-wording"><span className="eyebrow">The shared question</span><h2>{claim.question}</h2><div className="option-list">{claim.options?.map(option => <span key={option} className={claim.settled_option === option ? 'winning-option' : ''}>{claim.settled_option === option && <Icon name="check" size={14} />}{outcomeLabel(option)}</span>)}</div></section>}
        {claim.status === 'collecting' && <section className="card topic-card"><span className="eyebrow">The topic</span>{isCreator ? <form onSubmit={editTopic}><label className="sr-only" htmlFor="edit-topic">Revise claim topic</label><textarea id="edit-topic" value={topic} onChange={event => setTopic(event.target.value)} minLength={10} maxLength={300} rows={3} /><button className="button outlined" disabled={busy || topic.trim() === claim.topic}>Revise claim and reset answers</button></form> : <h2>{claim.topic}</h2>}<p>{isCreator ? 'Changing the topic clears everyone’s draft answers so each friend can respond to the new wording.' : 'If the creator changes this topic, you can submit a fresh answer.'} AI checks automatically after everyone submits.</p></section>}
        <div className="section-head member-heading"><div><span className="eyebrow">Original positions</span><h2>What everyone said</h2></div><span className="tag">{active.length} participants</span></div>
        <div className="member-list">{detail.members.map((member, index) => <div className={`member-entry ${member.invite_status}`} key={member.user_id} style={{ animationDelay: `${index * 60}ms` }}>{member.profile ? <Avatar profile={member.profile} /> : <span className="avatar">?</span>}<div className="member-body"><div className="member-name"><strong>{member.profile?.display_name || 'Friend'}{member.user_id === profile.id ? ' (you)' : ''}</strong><span className={`member-status ${member.invite_status}`}>{member.invite_status === 'pending' ? 'Waiting' : member.invite_status === 'answered' ? 'Answered' : 'Declined'}</span></div><p className="member-quote">{member.invite_status === 'declined' ? 'Declined the invitation' : member.original_answer || (member.invite_status === 'answered' ? 'Answer saved privately until lock' : 'Waiting for an answer')}</p>{member.normalized_choice && <small className="recorded-as"><Icon name="lock" size={12} /> Recorded as: {outcomeLabel(member.normalized_choice)}</small>}</div></div>)}</div>
        {checkingClaim && <div className="answer-checking" role="status"><Spinner size={38} /><span><strong>AI referee is listening</strong>AI is checking whether this claim can be settled fairly…</span></div>}
        {canEdit && me?.invite_status === 'answered' && !editingAnswer && <section className="card answer-saved" aria-label="Your saved answer"><span className="eyebrow">Your answer · saved</span><h2><span className="check-burst" aria-hidden="true"><Icon name="check" size={18} /></span>Answer recorded</h2><p>Your words are saved privately. You can change them until AI locks this claim.</p><div className="answer-actions"><button type="button" className="button outlined" onClick={() => setEditingAnswer(true)}><Icon name="pen" size={16} /> Edit my answer</button>{!isCreator && <button type="button" className="text-button" disabled={busy} onClick={decline}>Decline invitation</button>}</div></section>}
        {canEdit && me?.invite_status !== 'declined' && (me?.invite_status !== 'answered' || editingAnswer) && <form ref={feedbackRef} className="card answer-form" onSubmit={saveAnswer}><span className="eyebrow">Your words</span><h2>{me?.invite_status === 'answered' ? 'Edit your answer' : 'Write your answer'}</h2><label className="sr-only" htmlFor="your-answer">Your prediction</label><textarea id="your-answer" value={answer} onChange={event => setAnswer(event.target.value)} minLength={2} maxLength={300} rows={3} placeholder="I think Manchester City will win." required /><div className="answer-actions"><button className="button primary" disabled={busy}>Save my answer <Icon name="arrow" size={16} /></button>{me?.invite_status === 'answered' && <button type="button" className="text-button" disabled={busy} onClick={() => { setAnswer(me.original_answer || ''); setEditingAnswer(false) }}>Cancel edit</button>}{!isCreator && <button type="button" className="text-button" disabled={busy} onClick={decline}>Decline invitation</button>}</div></form>}
        {canEdit && isCreator && availableFriends.length > 0 && <form className="invite-extra" onSubmit={invite}><label>Add another friend if someone declined<select value={replacementFriend} onChange={event => setReplacementFriend(event.target.value)} required><option value="">Choose a friend</option>{availableFriends.map(friend => <option key={friend.id} value={friend.id}>{friend.display_name}</option>)}</select></label><button className="button outlined" disabled={busy || !replacementFriend}>Invite</button></form>}
        {canReviseLocked && !editingAnswer && <section className="card answer-saved"><span className="eyebrow">Five-minute correction window</span><h2><span className="check-burst" aria-hidden="true"><Icon name="check" size={18} /></span>Your answer is on record</h2><p>You may edit only your answer until {displayDate(new Date(editDeadline).toISOString())}. AI will check it again automatically.</p><div className="answer-actions"><button className="button outlined" onClick={() => { setAnswer(me?.original_answer || ''); setEditingAnswer(true) }}><Icon name="pen" size={16} /> Edit my answer</button></div></section>}
        {canReviseLocked && editingAnswer && <form ref={feedbackRef} className="card answer-form" onSubmit={reviseLockedAnswer}><span className="eyebrow">Correct your answer</span><h2>Your position</h2><textarea aria-label="Your revised answer" value={answer} onChange={event => setAnswer(event.target.value)} minLength={2} maxLength={300} rows={3} required /><div className="answer-actions"><button className="button primary" disabled={busy || answer.trim() === me?.original_answer}>{busy ? 'Checking…' : 'Submit revised answer'}</button><button type="button" className="text-button" disabled={busy} onClick={() => { setEditingAnswer(false); setClarityIssue(null) }}>Cancel</button></div></form>}
      </div>
    </div>
  }

  const dueRecords = records.filter(isDue)
  const stats = [
    { label: 'Recording', value: records.filter(record => record.status === 'collecting').length, tone: 'collecting' },
    { label: 'Locked', value: records.filter(record => record.status === 'locked' && !isDue(record)).length, tone: 'locked' },
    { label: 'To settle', value: dueRecords.length, tone: 'due' },
    { label: 'Settled', value: records.filter(record => record.status === 'settled').length, tone: 'settled' },
  ]

  return <div className="page-content claim-workspace">
    <div key="list" className="view-stage">
      <header className="records-hero">
        <div><span className="eyebrow">Hey {profile.display_name}</span><h1>What’s your <span className="hl">next call</span>?</h1><p className="page-lead">Every great prediction starts with someone willing to put it in writing.</p></div>
        <button className="button primary big new-claim" onClick={startNew}><Icon name="plus" size={20} /> New claim</button>
      </header>
      {!loading && records.length > 0 && <dl className="stat-strip">{stats.map(stat => <div key={stat.label} className={`stat ${stat.tone}`}><dt>{stat.label}</dt><dd><CountUp value={stat.value} /></dd></div>)}</dl>}
      {dueRecords.length > 0 && onOpenNotices && <button className="up-next" onClick={onOpenNotices}><span className="up-next-icon" aria-hidden="true"><Icon name="vote" size={22} /></span><span><strong>{dueRecords.length} claim{dueRecords.length === 1 ? ' is' : 's are'} ready to settle</strong><small>Vote on what actually happened</small></span><Icon name="arrow" size={20} /></button>}
      <Toast message={message} onDismiss={() => setMessage('')} />
      <div className="section-head records-heading"><h2>On record</h2>{records.length > 0 && <span className="tag">{records.length} entries</span>}</div>
      {loading ? <div className="record-stack" aria-label="Opening records">{[0, 1, 2].map(index => <div key={index} className="record-card skeleton" />)}</div> : records.length ? <div className="record-stack">{records.map((record, index) => {
        const state = recordState(record, now)
        return <button key={record.id} className={`record-card tone-${cardTones[index % 4]} state-${state.tone}`} style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }} onClick={() => void openDetail(record.id)}>
          <span className="record-top"><span className="record-number">Entry {String(records.length - index).padStart(3, '0')}</span><span className={`state-badge ${state.tone}`}>{state.tone === 'collecting' ? <span className="rec-dot" aria-hidden="true" /> : <Icon name={state.icon} size={13} />}{state.label}</span></span>
          <strong>{record.title || record.topic}</strong>
          <span className="record-next"><span>{state.next}</span><Icon name="arrow" size={18} /></span>
          <span className="record-groove" aria-hidden="true" />
        </button>
      })}</div> : <div className="empty-record"><Logo size={64} /><div><span className="eyebrow">Entry 001 · Your turn</span><h3>Your first claim belongs here.</h3><p>{friends.length ? 'Your circle is ready. Write a claim, choose friends, and set a check time.' : 'Add a friend, then you can put your first prediction on record.'}</p><button className="button primary" onClick={startNew}>Start a claim <Icon name="arrow" size={16} /></button></div></div>}
      <p className="hint-row"><Icon name="spark" size={16} /> Original words stay. Results settle the score. Everyone remembers who called it.</p>
    </div>
  </div>
}
