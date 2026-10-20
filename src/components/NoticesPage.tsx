import { useCallback, useEffect, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import { displayDate, getClaimDetail, isDue, listClaims, type Claim, type ClaimDetail } from '../lib/claims'
import { outcomeLabel } from '../lib/outcome'
import SettlementSummary from './SettlementSummary'
import Toast from './Toast'

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

  async function openClaim(id: string) {
    setMessage('')
    try {
      const result = await getClaimDetail(id)
      setDetail(result)
      setChoice(result.members.find(member => member.user_id === profile.id)?.vote || '')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open this claim.') }
  }

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

  return <div className="page-content notices-page">
    <div className="page-topline"><span className="eyebrow">DUE & UPCOMING</span><span>03 / NOTICES</span></div>
    <h1>Time to settle<span className="period">.</span></h1>
    <p className="page-lead">When a claim reaches its check time, everyone records the actual outcome here.</p>
    <Toast message={message} onDismiss={() => setMessage('')} />
    {detail && <section className="paper-card vote-card">
      <button className="back-link" onClick={() => { setDetail(null); setMessage('') }}>← All notices</button>
      <span className="eyebrow">{detail.claim.status === 'settled' ? 'FINAL RESULT' : 'THE QUESTION'}</span>
      <h2>{detail.claim.question || detail.claim.title}</h2>
      <p>Check time: {displayDate(detail.claim.due_at)}</p>
      {detail.claim.status === 'settled' ? <SettlementSummary detail={detail} /> : isDue(detail.claim) ? <>
        <p className="vote-guidance">Choose the result that actually happened. A group needs a majority; if two friends disagree, the creator’s vote settles it once both vote.</p>
        <div className="vote-options" role="radiogroup" aria-label="Actual outcome">
          {[...(detail.claim.options || []), noneChoice].map(option => <label key={option} className={choice === option ? 'selected' : ''}><input type="radio" name="outcome" value={option} checked={choice === option} onChange={() => setChoice(option)} /><span>{outcomeLabel(option)}</span></label>)}
        </div>
        <button className="button primary" disabled={busy || !choice} onClick={() => void vote()}>{busy ? 'Saving…' : 'Record my vote'}</button>
        {detail.members.find(member => member.user_id === profile.id)?.vote && <p className="saved-vote">Your saved vote: {outcomeLabel(detail.members.find(member => member.user_id === profile.id)?.vote || null)}. You can change it until the record settles.</p>}
      </> : <p>Voting opens at the check time.</p>}
      <div className="vote-positions"><h3>Original positions</h3>{detail.members.filter(member => member.invite_status === 'answered').map(member => <p key={member.user_id}><strong>{member.profile?.display_name || 'Friend'}:</strong> {member.original_answer}</p>)}</div>
    </section>}
    {!detail && <>
      {loading ? <p className="muted">Checking the ledger…</p> : due.length === 0 && upcoming.length === 0 && settled.length === 0 && <div className="empty-line">No notices yet. Locked claims appear here when their check time arrives.</div>}
      <NoticeGroup title="Ready for a result" rows={due} onOpen={openClaim} empty="Nothing needs a vote right now." />
      <NoticeGroup title="Coming up" rows={upcoming} onOpen={openClaim} />
      <NoticeGroup title="Settled records" rows={settled} onOpen={openClaim} />
    </>}
  </div>
}

function NoticeGroup({ title, rows, onOpen, empty }: { title: string; rows: Claim[]; onOpen: (id: string) => void; empty?: string }) {
  if (!rows.length && !empty) return null
  return <section className="notice-group"><div className="section-head"><h2>{title}</h2><span>{rows.length} RECORDS</span></div>
    {rows.length ? rows.map(claim => <button className="notice-row" key={claim.id} onClick={() => onOpen(claim.id)}><span className="notice-date">{displayDate(claim.due_at)}</span><strong>{claim.title || claim.topic}</strong><span>{claim.status === 'settled' ? 'See result' : isDue(claim) ? 'Vote now' : 'Upcoming'} ↗</span></button>) : <p className="muted">{empty}</p>}
  </section>
}
