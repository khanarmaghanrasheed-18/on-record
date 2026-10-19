import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type FriendConnection, type Friendship, type Profile } from './lib/supabase'
import ClaimWorkspace from './components/ClaimWorkspace'
import NoticesPage from './components/NoticesPage'
import ScoresPage from './components/ScoresPage'
import ProfilePage from './components/ProfilePage'
import Avatar from './components/Avatar'
import { UpdateNotice } from './components/InstallActions'
import { isDue, listClaims } from './lib/claims'

type Section = 'records' | 'friends' | 'notices' | 'scores' | 'profile'

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
          options: { data: { display_name: name.trim() } },
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

  return <div className="auth-layout">
    <section className="auth-intro">
      <div className="brand brand-large"><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></div>
      <div className="intro-copy">
        <span className="eyebrow light">A SHARED LEDGER FOR FRIENDLY CALLS</span>
        <h1>Say it now.<br /><em>Settle it later.</em></h1>
        <p>Turn your group’s bold predictions into a record everyone can return to.</p>
      </div>
      <div className="auth-footnote">THE ORIGINAL WORDS. THE FINAL RESULT. THE SCORE.</div>
    </section>
    <section className="auth-form-side">
      <div className="auth-card">
        <div className="folio-line"><span>ENTRY 001</span><span>MEMBERS ONLY</span></div>
        <h2>{mode === 'register' ? 'Open your record book' : mode === 'forgot' ? 'Recover your account' : 'Welcome back'}</h2>
        <p className="muted">{mode === 'register' ? 'One account keeps every prediction and rivalry together.' : mode === 'forgot' ? 'Enter your sign-in email. We will send a link to set a new password.' : 'Your friends and records are waiting.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Your name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={40} placeholder="What your friends call you" required autoComplete="name" /></label>}
          <label>Email<input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" /></label>
          {mode !== 'forgot' && <label>Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={6} placeholder="At least 6 characters" required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button primary full" disabled={busy}>{busy ? 'One moment…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send recovery email' : 'Sign in'} <span aria-hidden>↗</span></button>
        </form>
        <button className="text-button auth-toggle" onClick={() => { setMode(mode === 'register' ? 'sign-in' : 'register'); setMessage('') }}>{mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        {mode !== 'register' && <button className="text-button auth-recovery" onClick={() => { setMode(mode === 'forgot' ? 'sign-in' : 'forgot'); setMessage('') }}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</button>}
      </div>
    </section>
  </div>
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

  return <div className="auth-layout"><section className="auth-intro"><div className="brand brand-large"><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></div><div className="intro-copy"><span className="eyebrow light">ACCOUNT RECOVERY</span><h1>A fresh<br /><em>start.</em></h1><p>Set a new password and return to your record book.</p></div></section><section className="auth-form-side"><div className="auth-card"><div className="folio-line"><span>YOUR ACCOUNT</span><span>RECOVERY</span></div><h2>Choose a new password</h2><form onSubmit={submit}><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={6} required autoComplete="new-password" /></label>{message && <p className="form-message" role="alert">{message}</p>}<button className="button primary full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'} <span aria-hidden>↗</span></button></form></div></section></div>
}

function FriendsPanel({ connections, onNavigate, onOpenProfile }: { connections: FriendConnection[], onNavigate: () => void, onOpenProfile: (person: Profile) => void }) {
  const accepted = connections.filter(connection => connection.status === 'accepted')
  const incoming = connections.filter(connection => connection.status === 'pending' && connection.requested_by === connection.person.id)
  return <aside className="friends-panel">
    <div className="panel-heading"><div><span className="eyebrow">YOUR CIRCLE</span><h3>Friends <span>{accepted.length}</span></h3></div><button className="icon-button" onClick={onNavigate} aria-label="Manage friends">↗</button></div>
    {accepted.length ? <div className="friend-list">{accepted.map(connection => <button className="friend-row profile-link" key={connection.id} onClick={() => onOpenProfile(connection.person)}><Avatar profile={connection.person} /><div><strong>{connection.person.display_name}</strong><small>View profile</small></div><span className="online-dot" /></button>)}</div> : <p className="panel-empty">Your circle starts with one friend. Add them using their ID.</p>}
    {incoming.length > 0 && <div className="sidebar-note">{incoming.length} request{incoming.length === 1 ? '' : 's'} waiting <button onClick={onNavigate}>View requests →</button></div>}
    <button className="button outlined full" onClick={onNavigate}>＋ Add a friend</button>
  </aside>
}

function FriendsPage({ profile, connections, refresh, onOpenProfile }: { profile: Profile, connections: FriendConnection[], refresh: () => Promise<void>, onOpenProfile: (person: Profile) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const incoming = connections.filter(connection => connection.status === 'pending' && connection.requested_by !== profile.id)
  const outgoing = connections.filter(connection => connection.status === 'pending' && connection.requested_by === profile.id)
  const accepted = connections.filter(connection => connection.status === 'accepted')

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

  return <div className="page-content">
    <div className="page-topline"><span className="eyebrow">PEOPLE IN YOUR LEDGER</span><span>02 / CONNECTIONS</span></div>
    <h1>Your circle<span className="period">.</span></h1>
    <p className="page-lead">Exchange an ID once, then bring your friends into any new claim.</p>
    <div className="friend-grid">
      <section className="paper-card friend-add"><span className="eyebrow">INVITE BY ID</span><h2>Add a friend</h2><p>Ask your friend for their eight-character ID.</p><form className="code-form" onSubmit={sendRequest}><label className="sr-only" htmlFor="friend-code">Friend ID</label><input id="friend-code" value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} pattern="[A-Fa-f0-9]{8}" placeholder="E.G. A1B2C3D4" required /><button className="button primary" disabled={busy}>Send request</button></form><div className="your-code"><span>YOUR ID</span><strong>{profile.friend_code}</strong><button onClick={async () => { await navigator.clipboard.writeText(profile.friend_code); setMessage('Your ID was copied.') }}>Copy</button></div></section>
      <section className="paper-card requests"><span className="eyebrow">INCOMING</span><h2>Requests <span className="count-pill">{incoming.length}</span></h2>{incoming.length ? incoming.map(connection => <div className="request-row" key={connection.id}><span className="avatar">{connection.person.display_name[0]}</span><div><strong>{connection.person.display_name}</strong><small>Wants to join your circle</small></div><button className="button small primary" disabled={busy} onClick={() => respond(connection.id, true)}>Accept</button><button className="text-button" disabled={busy} onClick={() => respond(connection.id, false)}>Decline</button></div>) : <p className="muted">No requests right now.</p>}</section>
    </div>
    {message && <p className="form-message" role="status">{message}</p>}
    <section className="connection-list"><div className="section-head"><h2>Connected friends</h2><span>{accepted.length} TOTAL</span></div>{accepted.length ? accepted.map(connection => <button className="connection-row profile-link" key={connection.id} onClick={() => onOpenProfile(connection.person)}><Avatar profile={connection.person} /><strong>{connection.person.display_name}</strong><span className="muted">{connection.person.headline || connection.person.friend_code}</span><span className="connection-status">VIEW PROFILE ↗</span></button>) : <div className="empty-line">No friends yet. Share your ID or send your first request.</div>}{outgoing.length > 0 && <><h3 className="subsection-title">Sent requests</h3>{outgoing.map(connection => <div className="connection-row" key={connection.id}><Avatar profile={connection.person} /><strong>{connection.person.display_name}</strong><span className="muted">Awaiting a response</span><span className="connection-status waiting">PENDING</span></div>)}</>}</section>
  </div>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [section, setSection] = useState<Section>('records')
  const [error, setError] = useState('')
  const [dueCount, setDueCount] = useState(0)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null)

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

  if (!supabase) return <div className="setup-message"><div className="brand"><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></div><h1>Connect your record book</h1><p>Copy <code>.env.example</code> to <code>.env</code> and enter your Supabase project URL and publishable key. Then restart the development server.</p></div>
  const activeClient = supabase
  if (loading || (session && !profile && !error)) return <div className="loading-screen">Opening the record book…</div>
  if (!session) return <AuthScreen />
  if (recoveryMode) return <RecoveryPassword onComplete={() => { setRecoveryMode(false); window.history.replaceState({}, '', window.location.pathname) }} />
  if (error) return <div className="setup-message"><h1>Could not open the record book</h1><p>{error}</p><button className="button primary" onClick={() => void refresh()}>Try again</button><button className="text-button" onClick={() => void activeClient.auth.signOut()}>Sign out</button></div>
  if (!profile) return null

  const pendingCount = connections.filter(connection => connection.status === 'pending' && connection.requested_by !== profile.id).length
  const openProfile = (person: Profile) => { setViewedProfile(person); setSection('profile') }
  const ownProfile = () => { setViewedProfile(null); setSection('profile') }
  const visibleProfile = viewedProfile ? connections.find(connection => connection.person.id === viewedProfile.id)?.person || viewedProfile : profile
  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={() => setSection('records')}><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></button><span className="header-subtitle">THE FRIENDSHIP LEDGER</span><button className="header-user profile-link" onClick={ownProfile} aria-label="Open my profile"><Avatar profile={profile} /><span>{profile.display_name}</span></button></header>
    <div className="app-body"><nav className="main-nav" aria-label="Main navigation"><div className="nav-label">THE BOOK</div><button className={section === 'records' ? 'active' : ''} onClick={() => setSection('records')}><span>▤</span> Records</button><button className={section === 'friends' ? 'active' : ''} onClick={() => setSection('friends')}><span>♧</span> Friends {pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}</button><button className={section === 'notices' ? 'active' : ''} onClick={() => setSection('notices')}><span>◷</span> Notices {dueCount > 0 && <b className="nav-count">{dueCount}</b>}</button><button className={section === 'scores' ? 'active' : ''} onClick={() => setSection('scores')}><span>◇</span> Scores</button><div className="nav-separator" /><button className={section === 'profile' ? 'active' : ''} onClick={ownProfile}><span>◉</span> My profile</button><div className="nav-bottom"><span>VOL. 01</span><small>Made for calls that count.</small></div></nav>
      <main>
        {section === 'records' && <ClaimWorkspace profile={profile} connections={connections} />}
        {section === 'friends' && <FriendsPage profile={profile} connections={connections} refresh={refresh} onOpenProfile={openProfile} />}
        {section === 'notices' && <NoticesPage profile={profile} />}
        {section === 'scores' && <ScoresPage profile={profile} connections={connections} onOpenProfile={openProfile} />}
        {section === 'profile' && <ProfilePage profile={visibleProfile} own={!viewedProfile} onSaved={refresh} onBack={() => setSection('friends')} signOut={() => void activeClient.auth.signOut()} />}
      </main>
      <FriendsPanel connections={connections} onNavigate={() => setSection('friends')} onOpenProfile={openProfile} />
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><button className={section === 'records' ? 'active' : ''} onClick={() => setSection('records')}><span>▤</span>Records</button><button className={section === 'friends' ? 'active' : ''} onClick={() => setSection('friends')}><span>♧</span>Friends</button><button className={section === 'notices' ? 'active' : ''} onClick={() => setSection('notices')}><span>◷</span>Notices{dueCount > 0 && <b className="mobile-count">{dueCount}</b>}</button><button className={section === 'scores' ? 'active' : ''} onClick={() => setSection('scores')}><span>◇</span>Scores</button><button className={section === 'profile' ? 'active' : ''} onClick={ownProfile}><span>◉</span>Profile</button></nav>
    <UpdateNotice />
  </div>
}

export default App
