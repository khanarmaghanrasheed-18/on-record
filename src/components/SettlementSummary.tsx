import { type ClaimDetail } from '../lib/claims'
import { outcomeLabel } from '../lib/outcome'
import Icon from './Icon'

export default function SettlementSummary({ detail }: { detail: ClaimDetail }) {
  if (detail.claim.status !== 'settled') return null

  const members = detail.members.filter(member => member.invite_status === 'answered')
  const result = detail.claim.settled_option
  const correct = members.filter(member => result !== 'NONE_OF_THESE' && member.normalized_choice === result)
  const wrong = members.filter(member => !correct.includes(member))
  const creatorVote = members.find(member => member.user_id === detail.claim.creator_id)?.vote
  const creatorTiebreak = members.length === 2 && members.every(member => member.vote) && members[0].vote !== members[1].vote
  const name = (member: typeof members[number]) => member.profile?.display_name || 'Participant'

  return <section className="settlement-summary" aria-label="Final result and points">
    <div className="settlement-banner">
      <span className="confetti" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>
      <span className="eyebrow">Final result</span>
      <h2>{outcomeLabel(result)}</h2>
      <p className="settlement-reason">{creatorTiebreak
        ? `The two outcome votes disagreed, so the creator's vote (${outcomeLabel(creatorVote || null)}) decided the result.`
        : 'The participants’ majority vote decided the result.'}</p>
      <span className="seal" aria-hidden="true">Settled</span>
    </div>
    <div className="settlement-people">
      {members.map((member, index) => <div key={member.user_id} className={`settlement-person ${correct.includes(member) ? 'is-correct' : 'is-wrong'}`} style={{ animationDelay: `${120 + index * 70}ms` }}>
        <span className="verdict-icon" aria-hidden="true"><Icon name={correct.includes(member) ? 'check' : 'close'} size={16} /></span>
        <span className="settlement-name"><strong>{name(member)}</strong><span>Predicted: {outcomeLabel(member.normalized_choice)}</span></span>
        <b className={correct.includes(member) ? 'prediction-correct' : 'prediction-wrong'}>{correct.includes(member) ? 'Correct' : 'Incorrect'}</b>
      </div>)}
    </div>
    <div className="settlement-points">
      <strong>How the score changed</strong>
      {correct.length && wrong.length
        ? <ul>{correct.flatMap(winner => wrong.map(loser => <li key={`${winner.user_id}-${loser.user_id}`}><span className="plus-one" aria-hidden="true">+1</span>{name(winner)} earned 1 point against {name(loser)}.</li>))}</ul>
        : <p>No head-to-head points were awarded; there was no correct-versus-incorrect pair.</p>}
    </div>
  </section>
}
