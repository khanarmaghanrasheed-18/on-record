import { createPortal } from 'react-dom'

export default function Toast({ message, onDismiss, tone = 'info' }: {
  message: string
  onDismiss: () => void
  tone?: 'info' | 'error'
}) {
  if (!message) return null

  return createPortal(
    <div className={`app-toast ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>
        <strong>{tone === 'error' ? 'Needs attention' : 'On Record'}</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>,
    document.body,
  )
}
