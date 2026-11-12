import type { Message } from './chat'

/** Mirrors META_MARK in server/chat.ts. */
const META_MARK = '@@META'

export interface ReplyMeta {
  chips: string[]
  title: string
  place: string
  listings: boolean
}

/** What the model sees of the conversation. */
function toTurns(history: Message[]) {
  return history.flatMap((m) => {
    if (m.kind === 'user') return [{ role: 'user', text: m.text }]
    if (m.kind === 'assistant') return [{ role: 'assistant', text: m.text }]
    if (m.kind === 'question') return [{ role: 'assistant', text: m.question.text }]
    return [{ role: 'assistant', text: '(The app showed the user a few sample homes that match.)' }]
  })
}

function parseMeta(raw: string): ReplyMeta {
  const fallback: ReplyMeta = { chips: [], title: '', place: '', listings: false }
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    const data = JSON.parse(match[0])
    return {
      chips: Array.isArray(data.chips) ? data.chips.map(String).filter(Boolean).slice(0, 5) : [],
      title: typeof data.title === 'string' ? data.title.trim() : '',
      place: typeof data.place === 'string' ? data.place.trim() : '',
      listings: data.listings === true,
    }
  } catch {
    return fallback
  }
}

/**
 * Ask the assistant for its next reply. `onText` receives the visible text so
 * far as it streams in; the promise resolves with the final text and meta.
 */
export async function streamReply(
  history: Message[],
  place: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<{ text: string; meta: ReplyMeta }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: toTurns(history), place }),
    signal,
  })
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.error ?? `Chat failed (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  let shown = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
    // Hide the meta line, and any partial "@@" that might be its start.
    const cut = raw.indexOf(META_MARK)
    let visible = cut === -1 ? raw : raw.slice(0, cut)
    if (cut === -1) visible = visible.replace(/@{1,2}[A-Z]*$/, '')
    visible = visible.trim()
    if (visible !== shown) {
      shown = visible
      onText(shown)
    }
  }
  const cut = raw.indexOf(META_MARK)
  const text = (cut === -1 ? raw : raw.slice(0, cut)).trim()
  const meta = cut === -1 ? parseMeta('') : parseMeta(raw.slice(cut + META_MARK.length))
  return { text, meta }
}
