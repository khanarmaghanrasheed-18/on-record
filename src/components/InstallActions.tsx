import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

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
  const installed = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    subscribers.add(setPromptEvent)
    return () => { subscribers.delete(setPromptEvent) }
  }, [])

  if (installed) return <p className="install-note">On Record is installed on this device.</p>
  return <div className="install-actions">
    <button className="button outlined" onClick={async () => {
      if (promptEvent) {
        await promptEvent.prompt()
        const result = await promptEvent.userChoice
        capturedPrompt = null
        setPromptEvent(null)
        setMessage(result.outcome === 'accepted' ? 'On Record was added to your device.' : 'You can install it later from your browser menu.')
      } else {
        setMessage('On iPhone, tap Share → Add to Home Screen. On Android, open your browser menu → Install app or Add to Home Screen. Installation requires the hosted HTTPS site.')
      }
    }}>Install on this device ↗</button>
    {message && <p className="install-note" role="status">{message}</p>}
  </div>
}

export function UpdateNotice() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  if (!needRefresh[0]) return null
  return <div className="update-notice" role="status"><span>A newer record book is ready. Save any answer you are writing first.</span><button className="button primary small" onClick={() => void updateServiceWorker(true)}>Update now</button></div>
}
