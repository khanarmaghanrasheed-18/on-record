import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import { displayDate, getClaimDetail, isDue, listClaims, type Claim, type ClaimDetail } from '../lib/claims'
import { outcomeLabel } from '../lib/outcome'
import SettlementSummary from './SettlementSummary'
import { leaveSubView, pushSubView, readSubView } from '../lib/history'
import Toast from './Toast'
import Icon, { Logo, Spinner } from './Icon'

const noneChoice = 'NONE_OF_THESE'

export default function NoticesPage({ profile }: { profile: Profile }) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [choice, setChoice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      const rows = await listClaims()
      setClaims(rows)
      if (detail) {
        const updated = await getClaimDetail(detail.claim.id)
        setDetail(updated)
        setChoice(updated.members.find(member => member.user_id === profile.id)?.vote || '')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load notices.')
    } finally { setLoading(false) }
  }, [detail?.claim.id, profile.id])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = window.setInterval(onVisible, 30000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  async function openClaim(id: string, push = true) {
    setMessage('')
    try {
      const result = await getClaimDetail(id)
      setDetail(result)
      setChoice(result.members.find(member => member.user_id === profile.id)?.vote || '')
      if (push) pushSubView({ kind: 'notice', id })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open this claim.') }
  }
  const openClaimRef = useRef(openClaim)
  openClaimRef.current = openClaim

  // Follow browser Back/Forward between the notice list and an opened notice.
  useEffect(() => {
    const show = (state: unknown, initial: boolean) => {
      const sub = readSubView(state)
      if (sub?.kind === 'notice') void openClaimRef.current(sub.id, false)
      else if (!initial) { setDetail(null); setMessage('') }
    }
    show(window.history.state, true)
    const onPop = (event: PopStateEvent) => show(event.state, false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  async function vote() {
    if (!supabase || !detail || !choice) return
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('vote_and_settle', {
        p_claim_id: detail.claim.id, p_choice: choice,
      })
      if (error) throw error
      const updated = await getClaimDetail(detail.claim.id)
      setDetail(updated)
      setClaims(await listClaims())
      setMessage(data === 'settled' ? `Result settled: ${outcomeLabel(updated.claim.settled_option)}. See the point awards below.` : 'Your vote is saved. The record is waiting for agreement.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your vote.') }
    finally { setBusy(false) }
  }

  const due = claims.filter(isDue)
  const upcoming = claims.filter(claim => claim.status === 'locked' && !isDue(claim))
  const settled = claims.filter(claim => claim.status === 'settled')

  const myVote = detail?.members.find(member => member.user_id === profile.id)?.vote

  return <div className="page-content notices-page">
    <header className="page-hero">
      <span className="eyebrow">Notices</span>
      <h1>Time to settle<span className="period">.</span></h1>
      <p className="page-lead">When a claim reaches its check time, everyone records what actually happened here.</p>
    </header>
    <Toast message={message} onDismiss={() => setMessage('')} />
    {detail && <section key={detail.claim.id} className="card vote-card view-stage">
      <button className="back-link" onClick={() => { if (!leaveSubView('notice')) { setDetail(null); setMessage('') } }}><Icon name="back" size={16} /> All notices</button>
      <span className="eyebrow">{detail.claim.status === 'settled' ? 'Final result' : 'The question'}</span>
      <h2>{detail.claim.question || detail.claim.title}</h2>
      <p className="vote-meta"><Icon name="clock" size={14} /> Check time: {displayDate(detail.claim.due_at)}</p>
      {detail.claim.status === 'settled' ? <SettlementSummary detail={detail} /> : isDue(detail.claim) ? <>
        <p className="vote-guidance">Choose the result that actually happened. A group needs a majority; if two friends disagree, the creator’s vote settles it once both vote.</p>
        <div className="vote-options" role="radiogroup" aria-label="Actual outcome">
          {[...(detail.claim.options || []), noneChoice].map((option, index) => <label key={option} className={`${choice === option ? 'selected' : ''}${option === noneChoice ? ' none' : ''}`} style={{ animationDelay: `${index * 60}ms` }}><input type="radio" name="outcome" value={option} checked={choice === option} onChange={() => setChoice(option)} /><span>{outcomeLabel(option)}</span>{myVote === option && <small className="your-pick">Your vote</small>}</label>)}
        </div>
        <button className="button primary big" disabled={busy || !choice} onClick={() => void vote()}>{busy ? <><Spinner size={20} /> Saving…</> : <><Icon name="vote" size={18} /> Record my vote</>}</button>
        {myVote && <p className="saved-vote"><Icon name="check" size={14} /> Your saved vote: {outcomeLabel(myVote || null)}. You can change it until the record settles.</p>}
      </> : <p className="vote-wait"><Icon name="lock" size={16} /> Voting opens at the check time.</p>}
      <div className="vote-positions"><h3>Original positions</h3>{detail.members.filter(member => member.invite_status === 'answered').map(member => <p key={member.user_id}><strong>{member.profile?.display_name || 'Friend'}</strong><span>{member.original_answer}</span></p>)}</div>
    </section>}
    {!detail && <div className="view-stage">
      {loading ? <div className="notice-loading" role="status"><Spinner size={40} /> Checking the ledger…</div> : due.length === 0 && upcoming.length === 0 && settled.length === 0 && <div className="empty-state"><Logo size={44} /><p>No notices yet. Locked claims appear here when their check time arrives.</p></div>}
      <NoticeGroup kind="due" title="Ready for a result" rows={due} onOpen={openClaim} empty="Nothing needs a vote right now." />
      <NoticeGroup kind="upcoming" title="Coming up" rows={upcoming} onOpen={openClaim} />
      <NoticeGroup kind="settled" title="Settled records" rows={settled} onOpen={openClaim} />
    </div>}
  </div>
}

function relativeTime(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), 'hour')
  return format.format(Math.round(minutes / 1440), 'day')
}

function NoticeGroup({ kind, title, rows, onOpen, empty }: { kind: 'due' | 'upcoming' | 'settled'; title: string; rows: Claim[]; onOpen: (id: string) => void; empty?: string }) {
  if (!rows.length && !empty) return null
  return <section className={`notice-group ${kind}`}><div className="section-head"><h2>{kind === 'due' && rows.length > 0 && <span className="rec-dot" aria-hidden="true" />}{title}</h2><span className="tag">{rows.length} record{rows.length === 1 ? '' : 's'}</span></div>
    {rows.length ? <div className="notice-list">{rows.map((claim, index) => <button className={`notice-row ${kind}`} key={claim.id} onClick={() => onOpen(claim.id)} style={{ animationDelay: `${index * 50}ms` }}>
      <span className="notice-icon" aria-hidden="true"><Icon name={kind === 'due' ? 'vote' : kind === 'settled' ? 'check' : 'clock'} size={18} /></span>
      <span className="notice-text"><strong>{claim.title || claim.topic}</strong><small>{kind === 'settled' ? `Result: ${outcomeLabel(claim.settled_option)}` : `${displayDate(claim.due_at)} · ${relativeTime(claim.due_at)}`}</small></span>
      <span className="notice-cta">{claim.status === 'settled' ? 'See result' : isDue(claim) ? 'Vote now' : 'Upcoming'} <Icon name="arrow" size={14} /></span>
    </button>)}</div> : <p className="muted empty-mini">{empty}</p>}
  </section>
}
