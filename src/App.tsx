import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type FriendConnection, type Friendship, type Profile } from './lib/supabase'
import ClaimWorkspace from './components/ClaimWorkspace'

type Section = 'records' | 'friends' | 'notices' | 'profile'

function AuthScreen() {
  const [registering, setRegistering] = useState(true)
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
      if (registering) {
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
        <h2>{registering ? 'Open your record book' : 'Welcome back'}</h2>
        <p className="muted">{registering ? 'One account keeps every prediction and rivalry together.' : 'Your friends and records are waiting.'}</p>
        <form onSubmit={submit}>
          {registering && <label>Your name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={40} placeholder="What your friends call you" required autoComplete="name" /></label>}
          <label>Email<input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" /></label>
          <label>Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={6} placeholder="At least 6 characters" required autoComplete={registering ? 'new-password' : 'current-password'} /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button primary full" disabled={busy}>{busy ? 'One moment…' : registering ? 'Create account' : 'Sign in'} <span aria-hidden>↗</span></button>
        </form>
        <button className="text-button auth-toggle" onClick={() => { setRegistering(!registering); setMessage('') }}>{registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      </div>
    </section>
  </div>
}

function FriendsPanel({ connections, onNavigate }: { connections: FriendConnection[], onNavigate: () => void }) {
  const accepted = connections.filter(connection => connection.status === 'accepted')
  const incoming = connections.filter(connection => connection.status === 'pending' && connection.requested_by === connection.person.id)
  return <aside className="friends-panel">
    <div className="panel-heading"><div><span className="eyebrow">YOUR CIRCLE</span><h3>Friends <span>{accepted.length}</span></h3></div><button className="icon-button" onClick={onNavigate} aria-label="Manage friends">↗</button></div>
    {accepted.length ? <div className="friend-list">{accepted.map(connection => <div className="friend-row" key={connection.id}><span className="avatar">{connection.person.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{connection.person.display_name}</strong><small>In your circle</small></div><span className="online-dot" /></div>)}</div> : <p className="panel-empty">Your circle starts with one friend. Add them using their ID.</p>}
    {incoming.length > 0 && <div className="sidebar-note">{incoming.length} request{incoming.length === 1 ? '' : 's'} waiting <button onClick={onNavigate}>View requests →</button></div>}
    <button className="button outlined full" onClick={onNavigate}>＋ Add a friend</button>
  </aside>
}

function FriendsPage({ profile, connections, refresh }: { profile: Profile, connections: FriendConnection[], refresh: () => Promise<void> }) {
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
    <section className="connection-list"><div className="section-head"><h2>Connected friends</h2><span>{accepted.length} TOTAL</span></div>{accepted.length ? accepted.map(connection => <div className="connection-row" key={connection.id}><span className="avatar">{connection.person.display_name[0]}</span><strong>{connection.person.display_name}</strong><span className="muted">{connection.person.friend_code}</span><span className="connection-status">CONNECTED</span></div>) : <div className="empty-line">No friends yet. Share your ID or send your first request.</div>}{outgoing.length > 0 && <><h3 className="subsection-title">Sent requests</h3>{outgoing.map(connection => <div className="connection-row" key={connection.id}><span className="avatar">{connection.person.display_name[0]}</span><strong>{connection.person.display_name}</strong><span className="muted">Awaiting a response</span><span className="connection-status waiting">PENDING</span></div>)}</>}</section>
  </div>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [section, setSection] = useState<Section>('records')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    client.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
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

  if (!supabase) return <div className="setup-message"><div className="brand"><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></div><h1>Connect your record book</h1><p>Copy <code>.env.example</code> to <code>.env</code> and enter your Supabase project URL and publishable key. Then restart the development server.</p></div>
  const activeClient = supabase
  if (loading || (session && !profile && !error)) return <div className="loading-screen">Opening the record book…</div>
  if (!session) return <AuthScreen />
  if (error) return <div className="setup-message"><h1>Could not open the record book</h1><p>{error}</p><button className="button primary" onClick={() => void refresh()}>Try again</button><button className="text-button" onClick={() => void activeClient.auth.signOut()}>Sign out</button></div>
  if (!profile) return null

  const pendingCount = connections.filter(connection => connection.status === 'pending' && connection.requested_by !== profile.id).length
  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={() => setSection('records')}><span className="brand-mark">OR<span>●</span></span><span>ON RECORD</span></button><span className="header-subtitle">THE FRIENDSHIP LEDGER</span><div className="header-user"><span className="avatar small-avatar">{profile.display_name[0].toUpperCase()}</span><span>{profile.display_name}</span></div></header>
    <div className="app-body"><nav className="main-nav" aria-label="Main navigation"><div className="nav-label">THE BOOK</div><button className={section === 'records' ? 'active' : ''} onClick={() => setSection('records')}><span>▤</span> Records</button><button className={section === 'friends' ? 'active' : ''} onClick={() => setSection('friends')}><span>♧</span> Friends {pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}</button><button className={section === 'notices' ? 'active' : ''} onClick={() => setSection('notices')}><span>◷</span> Notices</button><div className="nav-separator" /><button className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}><span>◉</span> My profile</button><div className="nav-bottom"><span>VOL. 01</span><small>Made for calls that count.</small></div></nav>
      <main>{section === 'records' && <ClaimWorkspace profile={profile} connections={connections} />}{section === 'friends' && <FriendsPage profile={profile} connections={connections} refresh={refresh} />}{section === 'notices' && <div className="page-content"><div className="page-topline"><span className="eyebrow">DUE & UPCOMING</span><span>03 / NOTICES</span></div><h1>Nothing due yet<span className="period">.</span></h1><p className="page-lead">Your claims will appear here when it is time to settle them.</p></div>}{section === 'profile' && <div className="page-content"><div className="page-topline"><span className="eyebrow">ACCOUNT DETAILS</span><span>04 / PROFILE</span></div><h1>Your profile<span className="period">.</span></h1><div className="paper-card profile-card"><div className="profile-avatar">{profile.display_name[0].toUpperCase()}</div><div><span className="eyebrow">MEMBER OF THE RECORD</span><h2>{profile.display_name}</h2><p>Your friend ID: <strong>{profile.friend_code}</strong></p><button className="text-button" onClick={() => void activeClient.auth.signOut()}>Sign out ↗</button></div></div></div>}</main>
      <FriendsPanel connections={connections} onNavigate={() => setSection('friends')} />
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><button className={section === 'records' ? 'active' : ''} onClick={() => setSection('records')}><span>▤</span>Records</button><button className={section === 'friends' ? 'active' : ''} onClick={() => setSection('friends')}><span>♧</span>Friends</button><button className={section === 'notices' ? 'active' : ''} onClick={() => setSection('notices')}><span>◷</span>Notices</button><button className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}><span>◉</span>Profile</button></nav>
  </div>
}

export default App
