import { supabase, type Profile } from './supabase'

export type Claim = {
  id: string
  creator_id: string
  topic: string
  due_at: string
  status: 'collecting' | 'locked' | 'settled'
  title: string | null
  question: string | null
  options: string[] | null
  locked_at: string | null
  revision: number
  settled_option: string | null
  settled_at: string | null
  created_at: string
}

export type ClaimMember = {
  user_id: string
  invite_status: 'pending' | 'answered' | 'declined'
  original_answer: string | null
  normalized_choice: string | null
  vote: string | null
  joined_at: string
  profile?: Profile
}

export type ClaimDetail = { claim: Claim; members: ClaimMember[] }

export async function listClaims(): Promise<Claim[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('claims').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Claim[]
}

export async function getClaimDetail(id: string): Promise<ClaimDetail> {
  if (!supabase) throw new Error('Supabase is not configured')
  const [claimResult, memberResult] = await Promise.all([
    supabase.from('claims').select('*').eq('id', id).single(),
    supabase.rpc('get_claim_members', { p_claim_id: id }),
  ])
  if (claimResult.error) throw claimResult.error
  if (memberResult.error) throw memberResult.error
  const members = (memberResult.data || []) as ClaimMember[]
  const ids = members.map(member => member.user_id)
  if (!ids.length) return { claim: claimResult.data as Claim, members }
  const profileResult = await supabase.from('profiles').select('*').in('id', ids)
  if (profileResult.error) throw profileResult.error
  const byId = new Map((profileResult.data as Profile[]).map(person => [person.id, person]))
  return {
    claim: claimResult.data as Claim,
    members: members.map(member => ({ ...member, profile: byId.get(member.user_id) })),
  }
}

export function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function isDue(claim: Claim) {
  return claim.status === 'locked' && new Date(claim.due_at).getTime() <= Date.now()
}

export async function checkAndLockClaim(claimId: string, revisedAnswer?: string): Promise<{ locked: boolean; feedback?: string }> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke('clarify-claim', { body: { claimId, ...(revisedAnswer === undefined ? {} : { revisedAnswer }) } })
  if (error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const payload = await context.json()
        throw new Error(payload.error || payload.feedback || error.message)
      } catch (cause) {
        if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input') throw cause
      }
    }
    throw error
  }
  if (!data || typeof data.locked !== 'boolean') throw new Error('AI returned an unexpected response')
  return data as { locked: boolean; feedback?: string }
}
