export function outcomeLabel(value: string | null) {
  if (!value) return 'Unknown outcome'
  if (value === 'NONE_OF_THESE') return 'None of these outcomes'

  // Older AI checks sometimes paired a descriptive outcome with a contradictory
  // Yes/No prefix after rewriting a negative topic into a positive question.
  const description = value.trim().match(/^(?:yes|no)[,.:;!?]\s+(.+)$/i)?.[1]
  return description ? description[0].toUpperCase() + description.slice(1) : value
}
