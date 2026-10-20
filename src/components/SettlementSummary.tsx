import { type ClaimDetail } from '../lib/claims'

function label(choice: string | null) {
  return choice === 'NONE_OF_THESE' ? 'None of these outcomes' : choice || 'Unknown outcome'
}

export default function SettlementSummary({ detail }: { detail: ClaimDetail }) {
  if (detail.claim.status !== 'settled') return null

  const members = detail.members.filter(member => member.invite_status === 'answered')
  const result = detail.claim.settled_option
  const correct = members.filter(member => result !== 'NONE_OF_THESE' && member.normalized_choice === result)
  const wrong = members.filter(member => !correct.includes(member))
  const creatorVote = members.find(member => member.user_id === detail.claim.creator_id)?.vote
  const creatorTiebreak = members.length === 2 && members.every(member => member.vote) && members[0].vote !== members[1].vote
  const name = (member: typeof members[number]) => member.profile?.display_name || 'Participant'

  return <section className="paper-card settlement-summary" aria-label="Final result and points">
    <span className="eyebrow">FINAL RESULT</span>
    <h2>{label(result)}</h2>
    <p className="settlement-reason">{creatorTiebreak
      ? `The two outcome votes disagreed, so the creator's vote (${label(creatorVote || null)}) decided the result.`
      : 'The participants’ majority vote decided the result.'}</p>
    <div className="settlement-people">
      {members.map(member => <div key={member.user_id} className="settlement-person">
        <strong>{name(member)}</strong>
        <span>Predicted: {label(member.normalized_choice)}</span>
        <b className={correct.includes(member) ? 'prediction-correct' : 'prediction-wrong'}>{correct.includes(member) ? 'Correct' : 'Incorrect'}</b>
      </div>)}
    </div>
    <div className="settlement-points">
      <strong>How the score changed</strong>
      {correct.length && wrong.length
        ? <ul>{correct.flatMap(winner => wrong.map(loser => <li key={`${winner.user_id}-${loser.user_id}`}>{name(winner)} earned 1 point against {name(loser)}.</li>))}</ul>
        : <p>No head-to-head points were awarded; there was no correct-versus-incorrect pair.</p>}
    </div>
  </section>
}
