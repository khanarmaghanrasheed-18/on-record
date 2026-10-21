import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Toast from './Toast'
import Icon from './Icon'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let capturedPrompt: InstallPrompt | null = null
const subscribers = new Set<(event: InstallPrompt | null) => void>()

// Capture the browser event as soon as the app bundle loads, including while
// someone is still on the sign-in screen.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    capturedPrompt = event as InstallPrompt
    subscribers.forEach(subscriber => subscriber(capturedPrompt))
  })
}

export function InstallAction() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(capturedPrompt)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const installed = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    subscribers.add(setPromptEvent)
    return () => { subscribers.delete(setPromptEvent) }
  }, [])

  if (installed) return <p className="install-note"><Icon name="check" size={16} /> On Record is installed on this device.</p>
  return <div className="install-actions">
    <button className="button outlined" onClick={async () => {
      setError(false)
      try {
        if (promptEvent) {
          await promptEvent.prompt()
          const result = await promptEvent.userChoice
          capturedPrompt = null
          setPromptEvent(null)
          setMessage(result.outcome === 'accepted' ? 'On Record was added to your device.' : 'You can install it later from your browser menu.')
        } else {
          setMessage('On iPhone, tap Share → Add to Home Screen. On Android, open your browser menu → Install app or Add to Home Screen. Phone installation requires the hosted HTTPS site.')
        }
      } catch {
        setError(true)
        setMessage('The install prompt did not open. Try Install app or Add to Home Screen from your browser menu.')
      }
    }}><Icon name="install" size={18} /> Install on this device</button>
    <Toast message={message} tone={error ? 'error' : 'info'} onDismiss={() => setMessage('')} />
  </div>
}

export function UpdateNotice() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  if (!needRefresh[0]) return null
  return <div className="update-notice" role="status"><Icon name="spark" size={18} /><span>A newer record book is ready. Save any answer you are writing first.</span><button className="button primary small" onClick={() => void updateServiceWorker(true)}>Update now</button></div>
}
