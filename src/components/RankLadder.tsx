// Mirrors the server's earned-title thresholds documented in README.md.
const ranks = [
  { title: 'Newcomer', wins: 0 },
  { title: 'Contender', wins: 1 },
  { title: 'Challenger', wins: 5 },
  { title: 'Conqueror', wins: 15 },
]

export default function RankLadder({ correct, title }: { correct: number; title?: string }) {
  const titled = ranks.findIndex(rank => rank.title === title)
  const current = titled >= 0 ? titled : Math.max(0, ranks.filter(rank => correct >= rank.wins).length - 1)
  const next = ranks[current + 1]
  const base = ranks[current].wins
  const progress = next ? Math.min(1, Math.max(0, (correct - base) / (next.wins - base))) : 1

  return <div className="rank-ladder">
    <ol>{ranks.map((rank, index) => <li key={rank.title} className={index < current ? 'passed' : index === current ? 'current' : ''}>
      <span className="rank-pip" aria-hidden="true" />
      <strong>{rank.title}</strong>
      <small>{rank.wins === 0 ? 'Start' : `${rank.wins}+ wins`}</small>
    </li>)}</ol>
    <div className="rank-progress" role="progressbar" aria-label={next ? `Progress to ${next.title}` : 'Top title reached'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ transform: `scaleX(${progress})` }} /></div>
    <p className="rank-next">{next ? `${next.wins - correct} more correct call${next.wins - correct === 1 ? '' : 's'} to ${next.title}.` : 'Top title reached. Defend it.'}</p>
  </div>
}
