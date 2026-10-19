import { supabase, type Profile } from '../lib/supabase'

export default function Avatar({ profile, large = false }: { profile: Pick<Profile, 'display_name' | 'avatar_path'>; large?: boolean }) {
  const path = profile.avatar_path
  const url = path && supabase ? supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl : null
  return <span className={`avatar${large ? ' profile-avatar' : ''}`}>
    {url ? <img src={url} alt={`${profile.display_name}'s profile photo`} loading="lazy" /> : profile.display_name.slice(0, 1).toUpperCase()}
  </span>
}
