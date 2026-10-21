import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import Avatar from './Avatar'
import { InstallAction } from './InstallActions'
import Toast from './Toast'

type Stats = { correct_claims: number; settled_claims: number; title: string }

export default function ProfilePage({ profile, own, onSaved, onBack, signOut }: {
  profile: Profile
  own: boolean
  onSaved: () => Promise<void>
  onBack: () => void
  signOut: () => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [name, setName] = useState(profile.display_name)
  const [headline, setHeadline] = useState(profile.headline || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setName(profile.display_name)
    setHeadline(profile.headline || '')
    setBio(profile.bio || '')
  }, [profile.id, profile.display_name, profile.headline, profile.bio])

  useEffect(() => { setMessage('') }, [profile.id])

  useEffect(() => {
    let active = true
    setStats(null)
    void (async () => {
      if (!supabase) return
      const { data, error } = await supabase.rpc('profile_stats', { p_user_id: profile.id })
      if (!active) return
      if (error) setMessage(error.message)
      else setStats((data as Stats[])[0])
    })()
    return () => { active = false }
  }, [profile.id])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !own) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: name.trim(), headline: headline.trim(), bio: bio.trim(),
      }).eq('id', profile.id)
      if (error) throw error
      await onSaved()
      setMessage('Profile saved. Your friends can see these details.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save profile.') }
    finally { setBusy(false) }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase || !own) return
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
    if (!extension || file.size > 2 * 1024 * 1024) {
      setMessage('Choose a JPG, PNG, or WebP photo smaller than 2 MB.')
      return
    }
    setBusy(true)
    setMessage('Uploading photo…')
    const path = `${profile.id}/${crypto.randomUUID()}.${extension}`
    try {
      const bucket = supabase.storage.from('profile-photos')
      const uploaded = await bucket.upload(path, file, { contentType: file.type, upsert: false })
      if (uploaded.error) throw uploaded.error
      const updated = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id)
      if (updated.error) {
        await bucket.remove([path])
        throw updated.error
      }
      const oldPath = profile.avatar_path
      await onSaved()
      if (oldPath) await bucket.remove([oldPath])
      setMessage('Photo updated.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not upload photo.') }
    finally { setBusy(false) }
  }

  async function removePhoto() {
    if (!supabase || !own || !profile.avatar_path) return
    setBusy(true)
    setMessage('')
    try {
      const oldPath = profile.avatar_path
      const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', profile.id)
      if (error) throw error
      await onSaved()
      await supabase.storage.from('profile-photos').remove([oldPath])
      setMessage('Photo removed.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not remove photo.') }
    finally { setBusy(false) }
  }

  return <div className="page-content profile-page">
    <div className="page-topline"><span className="eyebrow">{own ? 'ACCOUNT DETAILS' : 'FRIEND PROFILE'}</span><span>05 / PROFILE</span></div>
    {!own && <button className="back-link" onClick={onBack}>← Back</button>}
    <h1>{own ? 'Your profile' : profile.display_name}<span className="period">.</span></h1>
    <Toast message={message} onDismiss={() => setMessage('')} />
    <div className="paper-card profile-card"><Avatar profile={profile} large /><div className="profile-identity"><span className="eyebrow">{stats?.title?.toUpperCase() || 'MEMBER OF THE RECORD'}</span><h2>{profile.display_name}</h2>{profile.headline && <strong className="profile-headline">{profile.headline}</strong>}<p>{profile.bio || (own ? 'Add a few words about yourself below.' : 'No bio yet.')}</p><small>{stats ? `${stats.correct_claims} correct calls · ${stats.settled_claims} settled records` : 'Records are being counted.'}</small>{own && <p>Your friend ID: <strong>{profile.friend_code}</strong></p>}</div></div>
    {own && <>
      <section className="paper-card profile-edit"><span className="eyebrow">MAKE IT YOURS</span><h2>Edit your profile</h2><div className="photo-actions"><label className="button outlined">{busy ? 'Working…' : 'Choose a profile photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => void uploadPhoto(event)} /></label>{profile.avatar_path && <button className="text-button" disabled={busy} onClick={() => void removePhoto()}>Remove photo</button>}</div><p className="muted">JPG, PNG, or WebP, up to 2 MB. Your photo is visible to people who open your profile.</p><form onSubmit={saveProfile}><label>Name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={40} required /></label><label>Personal title<input value={headline} onChange={event => setHeadline(event.target.value)} maxLength={60} placeholder="e.g. Derby night forecaster" /></label><label>About you<textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={240} rows={4} placeholder="A few words for your friends" /></label><button className="button primary" disabled={busy}>Save profile</button></form></section>
      <p className="rank-note">Earned titles: Newcomer · Contender (1 win) · Challenger (5 wins) · Conqueror (15 wins). Friends can share a title.</p>
      <InstallAction />
      <button className="text-button profile-signout" onClick={signOut}>Sign out ↗</button>
    </>}
  </div>
}
