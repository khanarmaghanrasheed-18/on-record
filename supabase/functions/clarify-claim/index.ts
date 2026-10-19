import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Member = {
  user_id: string
  invite_status: 'pending' | 'answered' | 'declined'
  original_answer: string | null
}

type Judgment = {
  clear: boolean
  feedback: string
  title: string
  question: string
  options: string[]
  matches: { userId: string; option: string }[]
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function serverKey(): string | null {
  try {
    const named = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, unknown>
    if (typeof named.default === 'string') return named.default
  } catch { /* Older Supabase projects expose only the legacy key. */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function validJudgment(value: unknown, members: Member[]): value is Judgment {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<Judgment>
  if (typeof result.clear !== 'boolean' || typeof result.feedback !== 'string') return false
  if (!result.clear) return true
  if (typeof result.title !== 'string' || result.title.trim().length < 4 || result.title.length > 80) return false
  if (typeof result.question !== 'string' || result.question.trim().length < 10 || result.question.length > 300) return false
  if (!Array.isArray(result.options) || result.options.length < 2 || result.options.length > 6) return false
  if (!result.options.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 80)) return false
  if (new Set(result.options).size !== result.options.length) return false
  if (result.options.includes('NONE_OF_THESE')) return false
  if (!Array.isArray(result.matches) || result.matches.length !== members.length) return false
  const expectedIds = new Set(members.map(member => member.user_id))
  const seen = new Set<string>()
  for (const match of result.matches) {
    if (!match || typeof match.userId !== 'string' || !expectedIds.has(match.userId) || seen.has(match.userId)) return false
    if (typeof match.option !== 'string' || !result.options.includes(match.option)) return false
    seen.add(match.userId)
  }
  return seen.size === expectedIds.size
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = serverKey()
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!url || !serviceKey || !geminiKey) return json({ error: 'AI checking is not configured yet' }, 503)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Sign in first' }, 401)
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: identity, error: authError } = await admin.auth.getUser(token)
  if (authError || !identity.user) return json({ error: 'Sign in again' }, 401)

  let claimId: string
  try {
    const body = await request.json()
    claimId = body.claimId
    if (typeof claimId !== 'string' || !/^[0-9a-f-]{36}$/i.test(claimId)) throw new Error('invalid')
  } catch {
    return json({ error: 'Choose a claim to check' }, 400)
  }

  const { data: claim, error: claimError } = await admin.from('claims')
    .select('id, creator_id, topic, due_at, status').eq('id', claimId).single()
  if (claimError || !claim) return json({ error: 'Claim unavailable' }, 404)
  const { data: allMembers, error: membersError } = await admin.from('claim_members')
    .select('user_id, invite_status, original_answer').eq('claim_id', claimId).order('joined_at')
  if (membersError || !allMembers) return json({ error: 'Could not read answers. Try again.' }, 503)

  const members = (allMembers as Member[]).filter(member => member.invite_status !== 'declined')
  if (!members.some(member => member.user_id === identity.user.id)) return json({ error: 'You are not part of this claim' }, 403)
  if (claim.status !== 'collecting') return json({ locked: true, feedback: 'Another participant already locked this claim.' })
  if (new Date(claim.due_at).getTime() <= Date.now()) return json({ error: 'The check time has passed' }, 409)
  if (members.length < 2) return json({ locked: false, feedback: 'Add at least one active friend before locking.' }, 409)
  if (members.some(member => member.invite_status !== 'answered' || !member.original_answer)) {
    return json({ locked: false, feedback: 'Every active friend must write an answer before AI can check the claim.' }, 409)
  }

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      clear: { type: 'BOOLEAN' },
      feedback: { type: 'STRING' },
      title: { type: 'STRING' },
      question: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      matches: {
        type: 'ARRAY', items: {
          type: 'OBJECT',
          properties: { userId: { type: 'STRING' }, option: { type: 'STRING' } },
          required: ['userId', 'option'],
        },
      },
    },
    required: ['clear', 'feedback', 'title', 'question', 'options', 'matches'],
  }

  const instructions = `You are a strict referee for a friends' prediction record book. Check only the current topic and current answers below. Decide whether this upcoming claim can be settled objectively at the check time. Return clear=false if the topic or any answer is subjective, vague, not measurable, about a different event, or impossible to map fairly. Give specific, actionable feedback identifying what is missing: for example a location, measured quantity, time window, evidence source, or an answer that does not fit the topic. Do not repeat a generic rejection if the current wording is measurable. Do not judge the real-world result now. Do not change or invent an original answer. If clear=true: produce a short neutral title, a precise question with settlement criteria, two to six mutually exclusive outcome options, and one match for every active userId mapping the original answer to one exact option string. Include a draw option when relevant. If any answer cannot be mapped, return clear=false. Keep feedback empty when clear=true. Return JSON only.\n\nCheck time: ${claim.due_at}\nCurrent topic: ${claim.topic}\nCurrent original answers: ${JSON.stringify(members.map(member => ({ userId: member.user_id, answer: member.original_answer })))}`

  let judgment: unknown
  try {
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instructions }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 },
      }),
    })
    if (!aiResponse.ok) throw new Error(`Gemini returned ${aiResponse.status}`)
    const payload = await aiResponse.json()
    const content = payload.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => part.text)?.text
    if (!content) throw new Error('Gemini returned no judgment')
    judgment = JSON.parse(content)
  } catch (error) {
    console.error('Gemini check failed', error)
    return json({ error: 'AI checking is temporarily unavailable. Your answers are still editable; retry shortly.' }, 503)
  }

  if (!validJudgment(judgment, members)) {
    return json({ error: 'AI returned an incomplete result. Your answers are still editable; retry.' }, 503)
  }
  if (!judgment.clear) {
    return json({ locked: false, feedback: judgment.feedback.trim() || 'Make the topic and every answer more specific.' })
  }

  const matchById = new Map(judgment.matches.map(match => [match.userId, match.option]))
  const { error: lockError } = await admin.rpc('finalize_claim', {
    p_claim_id: claimId,
    p_title: judgment.title.trim(),
    p_question: judgment.question.trim(),
    p_options: judgment.options,
    p_member_ids: members.map(member => member.user_id),
    p_choices: members.map(member => matchById.get(member.user_id)),
  })
  if (lockError) {
    const { data: current } = await admin.from('claims').select('status').eq('id', claimId).single()
    if (current?.status === 'locked' || current?.status === 'settled') return json({ locked: true })
    console.error('Claim lock failed', lockError)
    return json({ error: 'This claim changed during checking. Reload and try again.' }, 409)
  }
  return json({ locked: true, title: judgment.title, question: judgment.question, options: judgment.options })
})
