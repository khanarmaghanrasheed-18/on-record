import { useCallback, useEffect, useState } from 'react'
import { supabase, type FriendConnection, type Profile } from '../lib/supabase'
import Avatar from './Avatar'
import Toast from './Toast'
import CountUp from './CountUp'
import RankLadder from './RankLadder'
import Icon from './Icon'

type Score = { my_points: number; friend_points: number; shared_claims: number }
type Stats = { correct_claims: number; settled_claims: number; title: string }

export default function ScoresPage({ profile, connections, onOpenProfile, onOpenNotices }: { profile: Profile; connections: FriendConnection[]; onOpenProfile: (person: Profile) => void; onOpenNotices: () => void }) {
  const friends = connections.filter(connection => connection.status === 'accepted').map(connection => connection.person)
  const [scores, setScores] = useState<Record<string, Score>>({})
  const [ranks, setRanks] = useState<Record<string, Stats>>({})
  const [mine, setMine] = useState<Stats | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabase) return
    const client = supabase
    try {
      const own = await client.rpc('profile_stats', { p_user_id: profile.id })
      if (own.error) throw own.error
      setMine((own.data as Stats[])[0])
      const rows = await Promise.all(friends.map(async friend => {
        const [pair, stats] = await Promise.all([
          client.rpc('head_to_head', { p_friend_id: friend.id }),
          client.rpc('profile_stats', { p_user_id: friend.id }),
        ])
        if (pair.error) throw pair.error
        if (stats.error) throw stats.error
        return { id: friend.id, score: (pair.data as Score[])[0], stats: (stats.data as Stats[])[0] }
      }))
      setScores(Object.fromEntries(rows.map(row => [row.id, row.score])))
      setRanks(Object.fromEntries(rows.map(row => [row.id, row.stats])))
      setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load scores.') }
    finally { setLoading(false) }
  }, [profile.id, connections])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return <div className="page-content scores-page">
    <header className="page-hero">
      <span className="eyebrow">Scores</span>
      <h1>Friendly rivalries<span className="period">.</span></h1>
      <p className="page-lead">A correct call earns one point against each friend who called it wrong. Group records count for every pair.</p>
    </header>
    <Toast message={message} onDismiss={() => setMessage('')} />
    <section className="card rank-summary">
      <div className="rank-head">
        <div><span className="eyebrow">Your current title</span><h2>{mine?.title || (loading ? 'Opening the ledger…' : 'Newcomer')}</h2><p>{mine ? `${mine.correct_claims} correct calls across ${mine.settled_claims} settled records` : 'Correct calls build your title.'}</p></div>
        <span className="trophy" aria-hidden="true"><Icon name="scores" size={34} /></span>
      </div>
      {mine && <RankLadder correct={mine.correct_claims} title={mine.title} />}
    </section>
    <button className="button outlined score-results-link" onClick={onOpenNotices}>See settled results and point awards <Icon name="arrow" size={16} /></button>
    <div className="section-head"><h2>Head to head</h2><span className="tag">{friends.length} friends</span></div>
    {friends.length ? <div className="score-list">{friends.map((friend, index) => {
      const score = scores[friend.id]
      const total = score ? score.my_points + score.friend_points : 0
      const share = score && total ? score.my_points / total : 0.5
      const lead = !score ? '' : score.my_points === score.friend_points ? (total ? 'All square' : 'No points yet') : score.my_points > score.friend_points ? `You lead by ${score.my_points - score.friend_points}` : `${friend.display_name} leads by ${score.friend_points - score.my_points}`
      return <div className="score-row" key={friend.id} style={{ animationDelay: `${index * 60}ms` }}>
        <button className="score-person profile-link" onClick={() => onOpenProfile(friend)}><Avatar profile={friend} /><span><strong>{friend.display_name}</strong><small>{loading ? 'Opening scores…' : `${ranks[friend.id]?.title || 'Friend'} · ${score?.shared_claims ?? '—'} shared settled records`}</small></span></button>
        <div className="versus">
          <div className="score-numbers">
            <span className="side me"><small>You</small><strong>{score ? <CountUp value={score.my_points} /> : '—'}</strong></span>
            <em>vs</em>
            <span className="side them"><small>{friend.display_name}</small><strong>{score ? <CountUp value={score.friend_points} /> : '—'}</strong></span>
          </div>
          <div className="tug" aria-hidden="true"><span className="tug-me" style={{ transform: `scaleX(${share})` }} /><span className="tug-knot" style={{ left: `${share * 100}%` }} /></div>
          {lead && <p className={`lead-line${score && score.my_points > score.friend_points ? ' winning' : ''}`}>{lead}</p>}
        </div>
      </div>
    })}</div> : <div className="empty-state"><Icon name="friends" size={32} /><p>Add a friend to start a rivalry.</p></div>}
    <p className="hint-row"><Icon name="spark" size={16} /> If both friends were right, or both were wrong, their score stays the same.</p>
  </div>
}
