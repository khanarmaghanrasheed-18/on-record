import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type FriendConnection, type Friendship, type Profile } from './lib/supabase'
import ClaimWorkspace from './components/ClaimWorkspace'
import NoticesPage from './components/NoticesPage'
import ScoresPage from './components/ScoresPage'
import ProfilePage from './components/ProfilePage'
import Avatar from './components/Avatar'
import Toast from './components/Toast'
import Icon, { Logo, Spinner, type IconName } from './components/Icon'
import { UpdateNotice } from './components/InstallActions'
import { isDue, listClaims } from './lib/claims'

type Section = 'records' | 'friends' | 'notices' | 'scores' | 'profile'
type AppView = { section: Section; profileId?: string; depth: number }
type Direction = 'forward' | 'back'

const homeView: AppView = { section: 'records', depth: 0 }
const sections: Section[] = ['records', 'friends', 'notices', 'scores', 'profile']
const navItems: { section: Section; label: string; icon: IconName }[] = [
  { section: 'records', label: 'Records', icon: 'records' },
  { section: 'friends', label: 'Friends', icon: 'friends' },
  { section: 'notices', label: 'Notices', icon: 'notices' },
  { section: 'scores', label: 'Scores', icon: 'scores' },
  { section: 'profile', label: 'Profile', icon: 'profile' },
]

function readAppView(state: unknown): AppView {
  if (!state || typeof state !== 'object' || !('__onRecordView' in state)) return homeView
  const saved = state.__onRecordView
  if (!saved || typeof saved !== 'object' || !('section' in saved) || !sections.includes(saved.section as Section)) return homeView
  const depth = 'depth' in saved && typeof saved.depth === 'number' && Number.isInteger(saved.depth) && saved.depth >= 0 ? saved.depth : 0
  const profileId = saved.section === 'profile' && 'profileId' in saved && typeof saved.profileId === 'string' ? saved.profileId : undefined
  return { section: saved.section as Section, profileId, depth }
}

function historyStateWith(view: AppView) {
  const current = window.history.state
  return { ...(current && typeof current === 'object' ? current : {}), __onRecordView: view }
}

// Keep editing shortcuts inside auth fields while leaving the browser's native
// copy, cut, paste, selection, and undo behavior intact.
const clipboardInputProps = {
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x'].includes(event.key.toLowerCase())) {
      event.stopPropagation()
    }
  },
  onCopy: (event: ClipboardEvent<HTMLInputElement>) => event.stopPropagation(),
  onCut: (event: ClipboardEvent<HTMLInputElement>) => event.stopPropagation(),
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => event.stopPropagation(),
}

const sampleCalls = [
  'Mia: Arsenal win the derby 2–1',
  'Dev: it rains before the 3pm lecture',
  'Sam: the group chat hits 500 messages tonight',
  'Noor: our team finishes the hackathon demo',
  'Leo: the new album drops at midnight',
  'Ana: the bus is late again on Monday',
]

function Brand({ onClick }: { onClick?: () => void }) {
  const inner = <><Logo size={36} /><span className="wordmark">On<b>Record</b></span></>
  return onClick ? <button className="brand" onClick={onClick} aria-label="On Record home">{inner}</button> : <span className="brand">{inner}</span>
}

function AuthStage({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead: string; children: ReactNode }) {
  return <div className="auth-layout">
    <section className="auth-hero">
      <Brand />
      <div className="auth-hero-copy">
        <span className="eyebrow on-dark"><span className="rec-dot" aria-hidden="true" /> {eyebrow}</span>
        <h1>{title}</h1>
        <p>{lead}</p>
      </div>
      <div className="hero-cards" aria-hidden="true">
        <div className="hero-card c0"><span>Entry 012 · Rec</span><strong>Who wins the derby?</strong></div>
        <div className="hero-card c1"><span>Entry 011 · Pressed</span><strong>Snow before Friday?</strong></div>
        <div className="hero-card c2"><span>Entry 010 · Settled</span><strong>Mia called it. +1</strong></div>
      </div>
      <div className="ticker" aria-hidden="true"><div className="ticker-track">{[...sampleCalls, ...sampleCalls].map((call, index) => <span key={index}>{call}<i>●</i></span>)}</div></div>
    </section>
    <section className="auth-form-side">{children}</section>
  </div>
}

function AuthScreen() {
  const [mode, setMode] = useState<'register' | 'sign-in' | 'forgot'>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) throw error
        setMessage('If an account uses that email, a password reset link is on its way. Check your inbox and spam folder.')
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        setMessage(data.session ? 'Your account is ready.' : 'Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthStage eyebrow="Predictions between friends" title={<>Call it.<br /><span className="hl">Prove it.</span></>} lead="Put your boldest predictions on record, let AI keep them fair, and settle who really called it.">
    <div className="auth-card">
      {mode !== 'forgot' && <div className="auth-switch" role="group" aria-label="Account">
        <button type="button" aria-pressed={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage('') }}>Create account</button>
        <button type="button" aria-pressed={mode === 'sign-in'} className={mode === 'sign-in' ? 'active' : ''} onClick={() => { setMode('sign-in'); setMessage('') }}>Sign in</button>
        <span className={`auth-switch-thumb${mode === 'sign-in' ? ' right' : ''}`} aria-hidden="true" />
      </div>}
      <div className="auth-swap" key={mode}>
      <h2>{mode === 'register' ? 'Start your record' : mode === 'forgot' ? 'Recover your account' : 'Welcome back'}</h2>
      <p className="muted">{mode === 'register' ? 'One account keeps every prediction and rivalry together.' : mode === 'forgot' ? 'Enter your sign-in email. We will send a link to set a new password.' : 'Your friends and records are waiting.'}</p>
      <form onSubmit={submit}>
        {mode === 'register' && <label>Your name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={40} placeholder="What your friends call you" required autoComplete="name" /></label>}
        <label>Email<input {...clipboardInputProps} value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" /></label>
        {mode !== 'forgot' && <label>Password<input {...clipboardInputProps} value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={6} placeholder="At least 6 characters" required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>}
        <Toast message={message} onDismiss={() => setMessage('')} />
        <button className="button primary full" disabled={busy}>{busy ? <><Spinner size={20} /> One moment…</> : <>{mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send recovery email' : 'Sign in'} <Icon name="arrow" size={18} /></>}</button>
      </form>
      </div>
      {mode !== 'register' && <button className="text-button auth-recovery" onClick={() => { setMode(mode === 'forgot' ? 'sign-in' : 'forgot'); setMessage('') }}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</button>}
      <p className="auth-fine">Original words stay. Results settle the score.</p>
    </div>
  </AuthStage>
}

function RecoveryPassword({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (password !== confirm) { setMessage('The two passwords do not match.'); return }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onComplete()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update the password.') }
    finally { setBusy(false) }
  }

  return <AuthStage eyebrow="Account recovery" title={<>Fresh<br /><span className="hl">start.</span></>} lead="Set a new password and get back to your record book.">
    <div className="auth-card">
      <span className="eyebrow">Your account</span>
      <h2>Choose a new password</h2>
      <form onSubmit={submit}><label>New password<input {...clipboardInputProps} type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required autoComplete="new-password" /></label><label>Confirm password<input {...clipboardInputProps} type="password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={6} required autoComplete="new-password" /></label><Toast message={message} onDismiss={() => setMessage('')} tone="error" /><button className="button primary full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'} <Icon name="arrow" size={18} /></button></form>
    </div>
  </AuthStage>
}

function FriendsPanel({ connections, onNavigate, onOpenProfile }: { connections: FriendConnection[], onNavigate: () => void, onOpenProfile: (person: Profile) => void }) {
  const accepted = connections.filter(connection => connection.status === 'accepted')
  const incoming = connections.filter(connection => connection.status === 'pending' && connection.requested_by === connection.person.id)
  return <aside className="friends-panel" aria-label="Your rivals">
    <div className="panel-heading"><div><span className="eyebrow">Your circle</span><h3>Rivals <span>{accepted.length}</span></h3></div><button className="icon-button" onClick={onNavigate} aria-label="Manage friends"><Icon name="arrow" size={16} /></button></div>
    {accepted.length ? <div className="friend-list">{accepted.map((connection, index) => <button className="friend-row profile-link" key={connection.id} onClick={() => onOpenProfile(connection.person)} style={{ animationDelay: `${index * 50}ms` }}><Avatar profile={connection.person} /><span className="friend-row-text"><strong>{connection.person.display_name}</strong><small>{connection.person.headline || 'View profile'}</small></span><Icon name="arrow" size={14} /></button>)}</div> : <p className="panel-empty">Your circle starts with one friend. Add them using their ID.</p>}
    {incoming.length > 0 && <button className="sidebar-note" onClick={onNavigate}><span className="rec-dot" aria-hidden="true" /> {incoming.length} request{incoming.length === 1 ? '' : 's'} waiting · View</button>}
    <button className="button outlined full" onClick={onNavigate}>Add a friend <Icon name="plus" size={18} /></button>
  </aside>
}

function FriendsPage({ profile, connections, refresh, onOpenProfile }: { profile: Profile, connections: FriendConnection[], refresh: () => Promise<void>, onOpenProfile: (person: Profile) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const incoming = connections.filter(connection => connection.status === 'pending' && connection.requested_by !== profile.id)
  const outgoing = connections.filter(connection => connection.status === 'pending' && connection.requested_by === profile.id)
  const accepted = connections.filter(connection => connection.status === 'accepted')

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function sendRequest(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('request_friend', { code: code.trim() })
      if (error) throw error
      setCode('')
      setMessage('Request sent. They can accept it in their Friends tab.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the request.')
    } finally { setBusy(false) }
  }

  async function respond(id: string, accept: boolean) {
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('respond_to_friend_request', { request_id: id, accept_request: accept })
      if (error) throw error
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this request.')
    } finally { setBusy(false) }
  }

  return <div className="page-content friends-page">
    <header className="page-hero">
      <span className="eyebrow">Friends</span>
      <h1>Your circle<span className="period">.</span></h1>
      <p className="page-lead">Swap IDs once, then pull your friends into any new call.</p>
    </header>
    <div className="friend-grid">
      <section className="card friend-add">
        <div className="id-ticket">
          <span className="eyebrow">Your ID</span>
          <strong>{profile.friend_code}</strong>
          <button className={`copy-button${copied ? ' copied' : ''}`} onClick={async () => { await navigator.clipboard.writeText(profile.friend_code); setCopied(true); setMessage('Your ID was copied.') }}><Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <h2>Add a friend</h2>
        <p className="muted">Ask your friend for their eight-character ID.</p>
        <form className="code-form" onSubmit={sendRequest}><label className="sr-only" htmlFor="friend-code">Friend ID</label><input id="friend-code" value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} pattern="[A-Fa-f0-9]{8}" placeholder="A1B2C3D4" required autoComplete="off" spellCheck={false} /><button className="button primary" disabled={busy}>Send request <Icon name="arrow" size={16} /></button></form>
      </section>
      <section className="card requests"><span className="eyebrow">Incoming</span><h2>Requests <span className="count-pill">{incoming.length}</span></h2>{incoming.length ? incoming.map(connection => <div className="request-row" key={connection.id}><Avatar profile={connection.person} /><div><strong>{connection.person.display_name}</strong><small>Wants to join your circle</small></div><span className="request-actions"><button className="button small primary" disabled={busy} onClick={() => respond(connection.id, true)}><Icon name="check" size={16} /> Accept</button><button className="text-button" disabled={busy} onClick={() => respond(connection.id, false)}>Decline</button></span></div>) : <p className="muted empty-mini">No requests right now.</p>}</section>
    </div>
    <Toast message={message} onDismiss={() => setMessage('')} />
    <section className="connection-list">
      <div className="section-head"><h2>Connected friends</h2><span className="tag">{accepted.length} total</span></div>
      {accepted.length ? <div className="connection-grid">{accepted.map((connection, index) => <button className="connection-row profile-link" key={connection.id} onClick={() => onOpenProfile(connection.person)} style={{ animationDelay: `${index * 45}ms` }}><Avatar profile={connection.person} /><span className="connection-text"><strong>{connection.person.display_name}</strong><small>{connection.person.headline || connection.person.friend_code}</small></span><span className="connection-status">Profile <Icon name="arrow" size={14} /></span></button>)}</div> : <div className="empty-state"><Logo size={44} /><p>No friends yet. Share your ID or send your first request.</p></div>}
      {outgoing.length > 0 && <><h3 className="subsection-title">Sent requests</h3><div className="connection-grid">{outgoing.map(connection => <div className="connection-row" key={connection.id}><Avatar profile={connection.person} /><span className="connection-text"><strong>{connection.person.display_name}</strong><small>Awaiting a response</small></span><span className="connection-status waiting">Pending</span></div>)}</div></>}
    </section>
  </div>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [view, setView] = useState<AppView>(() => readAppView(window.history.state))
  const [direction, setDirection] = useState<Direction>('forward')
  const viewRef = useRef(view)
  const [error, setError] = useState('')
  const [dueCount, setDueCount] = useState(0)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    window.history.replaceState(historyStateWith(viewRef.current), '')
    const restoreView = (event: PopStateEvent) => {
      const previous = readAppView(event.state)
      setDirection(previous.depth < viewRef.current.depth ? 'back' : 'forward')
      viewRef.current = previous
      setView(previous)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [])

  const navigate = useCallback((section: Section, profileId?: string) => {
    const current = viewRef.current
    if (current.section === section && current.profileId === profileId) return
    const next: AppView = { section, profileId, depth: current.depth + 1 }
    window.history.pushState({ ...historyStateWith(next), __onRecordSub: null }, '')
    setDirection(sections.indexOf(section) < sections.indexOf(current.section) ? 'back' : 'forward')
    viewRef.current = next
    setView(next)
    window.scrollTo(0, 0)
  }, [])

  const goBack = useCallback(() => {
    if (viewRef.current.depth > 0) window.history.back()
    else navigate('friends')
  }, [navigate])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    client.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (!nextSession) { setProfile(null); setConnections([]) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase || !session?.user.id) return
    const client = supabase
    const me = session.user.id
    const [profileResult, friendshipResult] = await Promise.all([
      client.from('profiles').select('*').eq('id', me).single(),
      client.from('friendships').select('*').or(`user_a.eq.${me},user_b.eq.${me}`).neq('status', 'declined'),
    ])
    if (profileResult.error) { setError(profileResult.error.message); return }
    if (friendshipResult.error) { setError(friendshipResult.error.message); return }
    const rows = (friendshipResult.data || []) as Friendship[]
    const ids = rows.map(row => row.user_a === me ? row.user_b : row.user_a)
    let people: Profile[] = []
    if (ids.length) {
      const result = await client.from('profiles').select('*').in('id', ids)
      if (result.error) { setError(result.error.message); return }
      people = result.data as Profile[]
    }
    const byId = new Map(people.map(person => [person.id, person]))
    setProfile(profileResult.data as Profile)
    setConnections(rows.flatMap(row => {
      const person = byId.get(row.user_a === me ? row.user_b : row.user_a)
      return person ? [{ ...row, person }] : []
    }))
    setError('')
  }, [session?.user.id])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!session) return
    const updateWhenVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = window.setInterval(updateWhenVisible, 30000)
    document.addEventListener('visibilitychange', updateWhenVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', updateWhenVisible) }
  }, [refresh, session])
  useEffect(() => {
    if (!session) { setDueCount(0); return }
    const checkDue = () => { void listClaims().then(rows => setDueCount(rows.filter(isDue).length)).catch(() => undefined) }
    checkDue()
    const timer = window.setInterval(checkDue, 30000)
    document.addEventListener('visibilitychange', checkDue)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', checkDue) }
  }, [session?.user.id])

  if (!supabase) return <div className="setup-message"><Brand /><h1>Connect your record book</h1><p>Copy <code>.env.example</code> to <code>.env</code> and enter your Supabase project URL and publishable key. Then restart the development server.</p></div>
  const activeClient = supabase
  if (loading || (session && !profile && !error)) return <div className="loading-screen" role="status"><Spinner size={72} /><p>Cueing up your records…</p></div>
  if (!session) return <AuthScreen />
  if (recoveryMode) return <RecoveryPassword onComplete={() => { setRecoveryMode(false); window.history.replaceState(historyStateWith(viewRef.current), '', window.location.pathname) }} />
  if (error) return <div className="setup-message"><Brand /><h1>Could not open the record book</h1><p>{error}</p><div className="setup-actions"><button className="button primary" onClick={() => void refresh()}>Try again</button><button className="text-button" onClick={() => void activeClient.auth.signOut()}>Sign out</button></div></div>
  if (!profile) return null

  const section = view.section
  const pendingCount = connections.filter(connection => connection.status === 'pending' && connection.requested_by !== profile.id).length
  const openProfile = (person: Profile) => navigate('profile', person.id)
  const ownProfile = () => navigate('profile')
  const viewedProfile = view.profileId ? connections.find(connection => connection.person.id === view.profileId)?.person : undefined
  const visibleProfile = viewedProfile || profile
  const activeIndex = sections.indexOf(section)
  const counts: Partial<Record<Section, number>> = { friends: pendingCount, notices: dueCount }
  const go = (target: Section) => target === 'profile' ? ownProfile() : navigate(target)
  const navButtons = (variant: 'rail' | 'tab') => navItems.map(item => <button key={item.section} className={section === item.section ? 'active' : ''} aria-current={section === item.section ? 'page' : undefined} onClick={() => go(item.section)}>
    <span className="nav-icon"><Icon name={item.icon} size={variant === 'rail' ? 20 : 22} />{counts[item.section] ? <b className="nav-count" aria-label={`${counts[item.section]} new`}>{counts[item.section]}</b> : null}</span>
    <span className="nav-text">{item.section === 'profile' && variant === 'rail' ? 'My profile' : item.label}</span>
  </button>)

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <div className="header-leading"><Brand onClick={() => navigate('records')} /></div>
      <div className="header-trailing">
        {dueCount > 0 && section !== 'notices' && <button className="due-pill" onClick={() => navigate('notices')}><span className="rec-dot" aria-hidden="true" />{dueCount} to settle</button>}
        <button className="header-user profile-link" onClick={ownProfile} aria-label="Open my profile"><Avatar profile={profile} /><span>{profile.display_name}</span></button>
      </div>
    </header>
    <div className="app-body">
      <nav className="main-nav" aria-label="Main navigation" style={{ '--i': activeIndex } as CSSProperties}>
        <span className="nav-indicator" aria-hidden="true" />
        {navButtons('rail')}
        <div className="nav-bottom"><Logo size={26} /><small>Made for calls that count.</small></div>
      </nav>
      <main id="main" tabIndex={-1}>
        <div key={`${section}:${view.profileId || ''}`} className={`page-stage enter-${direction}`}>
          {section === 'records' && <ClaimWorkspace profile={profile} connections={connections} onOpenNotices={() => navigate('notices')} />}
          {section === 'friends' && <FriendsPage profile={profile} connections={connections} refresh={refresh} onOpenProfile={openProfile} />}
          {section === 'notices' && <NoticesPage profile={profile} />}
          {section === 'scores' && <ScoresPage profile={profile} connections={connections} onOpenProfile={openProfile} onOpenNotices={() => navigate('notices')} />}
          {section === 'profile' && <ProfilePage profile={visibleProfile} own={!viewedProfile} onSaved={refresh} onBack={goBack} signOut={() => void activeClient.auth.signOut()} />}
        </div>
      </main>
      <FriendsPanel connections={connections} onNavigate={() => navigate('friends')} onOpenProfile={openProfile} />
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation" style={{ '--i': activeIndex } as CSSProperties}>
      <span className="tab-indicator" aria-hidden="true" />
      {navButtons('tab')}
    </nav>
    <UpdateNotice />
  </div>
}

export default App
