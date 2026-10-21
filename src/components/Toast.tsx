import { createPortal } from 'react-dom'
import Icon from './Icon'

export default function Toast({ message, onDismiss, tone = 'info' }: {
  message: string
  onDismiss: () => void
  tone?: 'info' | 'error'
}) {
  if (!message) return null

  return createPortal(
    <div key={message} className={`app-toast ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-badge" aria-hidden="true"><Icon name={tone === 'error' ? 'bolt' : 'check'} size={16} /></span>
      <div>
        <strong>{tone === 'error' ? 'Needs attention' : 'On Record'}</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><Icon name="close" size={18} /></button>
    </div>,
    document.body,
  )
}
