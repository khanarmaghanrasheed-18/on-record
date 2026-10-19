import { useCallback, useEffect, useState } from 'react'
import { supabase, type FriendConnection, type Profile } from '../lib/supabase'
import Avatar from './Avatar'

type Score = { my_points: number; friend_points: number; shared_claims: number }
type Stats = { correct_claims: number; settled_claims: number; title: string }

export default function ScoresPage({ profile, connections, onOpenProfile }: { profile: Profile; connections: FriendConnection[]; onOpenProfile: (person: Profile) => void }) {
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
    <div className="page-topline"><span className="eyebrow">THE RIVALRY LEDGER</span><span>04 / SCORES</span></div>
    <h1>Friendly rivalries<span className="period">.</span></h1>
    <p className="page-lead">A correct call earns one point against each friend who called it wrong. Group records count for every pair.</p>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="paper-card rank-summary"><span className="eyebrow">YOUR CURRENT TITLE</span><h2>{mine?.title || (loading ? 'Opening the ledger…' : 'Newcomer')}</h2><p>{mine ? `${mine.correct_claims} correct calls across ${mine.settled_claims} settled records` : 'Correct calls build your title.'}</p></div>
    <div className="section-head"><h2>Head to head</h2><span>{friends.length} FRIENDS</span></div>
    {friends.length ? <div className="score-list">{friends.map(friend => {
      const score = scores[friend.id]
      return <div className="score-row" key={friend.id}><button className="score-person profile-link" onClick={() => onOpenProfile(friend)}><Avatar profile={friend} /><span><strong>{friend.display_name}</strong><small>{ranks[friend.id]?.title || 'Friend'} · {score?.shared_claims ?? 0} shared settled records</small></span></button><div className="score-numbers"><span><small>YOU</small><strong>{score?.my_points ?? 0}</strong></span><em>—</em><span><small>{friend.display_name.toUpperCase()}</small><strong>{score?.friend_points ?? 0}</strong></span></div></div>
    })}</div> : <div className="empty-line">Add a friend to start a rivalry.</div>}
    <div className="hint-row"><span>✳</span><p>If both friends were right, or both were wrong, their score stays the same.</p></div>
  </div>
}
