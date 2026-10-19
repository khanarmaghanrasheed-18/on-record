import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAction() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null)
  const [message, setMessage] = useState('')
  const installed = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', capture)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])

  if (installed) return <p className="install-note">On Record is installed on this device.</p>
  return <div className="install-actions">
    <button className="button outlined" onClick={async () => {
      if (promptEvent) {
        await promptEvent.prompt()
        const result = await promptEvent.userChoice
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
