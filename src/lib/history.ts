// Sub-pages inside a tab (a claim, the new-claim form, a notice) get their own
// browser history entries so the browser or phone Back gesture steps out of them.
export type SubView = { kind: 'claim'; id: string } | { kind: 'new-claim' } | { kind: 'notice'; id: string }

export function readSubView(state: unknown = window.history.state): SubView | null {
  if (!state || typeof state !== 'object' || !('__onRecordSub' in state)) return null
  const sub = state.__onRecordSub
  if (!sub || typeof sub !== 'object' || !('kind' in sub)) return null
  if (sub.kind === 'new-claim') return { kind: 'new-claim' }
  if ((sub.kind === 'claim' || sub.kind === 'notice') && 'id' in sub && typeof sub.id === 'string') return { kind: sub.kind, id: sub.id }
  return null
}

function stateWith(sub: SubView | null) {
  const current = window.history.state
  const next: Record<string, unknown> = { ...(current && typeof current === 'object' ? current : {}) }
  if (sub) next.__onRecordSub = sub
  else delete next.__onRecordSub
  return next
}

export function pushSubView(sub: SubView) { window.history.pushState(stateWith(sub), '') }
export function replaceSubView(sub: SubView | null) { window.history.replaceState(stateWith(sub), '') }

// Leave a sub-page by stepping back through history. Returns false when the
// current entry is not that sub-page, so the caller updates the view itself.
export function leaveSubView(kind: SubView['kind']) {
  if (readSubView()?.kind !== kind) return false
  window.history.back()
  return true
}
