/**
 * POST /api/chat — the only place the Google AI key is used.
 *
 * Takes the conversation so far and streams Gemini's reply back as plain
 * text. The reply ends with a `@@META` line carrying JSON the app uses for
 * quick-reply chips, the header title/area and whether to show listings.
 *
 * Written against web-standard Request/Response so the same handler runs in
 * the Vite dev server and, later, as a serverless function when published.
 */

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export const META_MARK = '@@META'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
/** Tried in order when the main model is overloaded or rate-limited. */
const BACKUP_MODELS = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest']

/** The model writes "Rs 25K"; people see "₹25K". (Writing ₹ inside JSON trips some models up.) */
const rupees = (text: string) => text.replace(/\b(?:Rs\.?|INR)\s?(?=\d)/g, '₹')

const SYSTEM = `You are the assistant inside "Find Anything", a mobile app that helps people find homes to rent in Bengaluru, India.

How to talk:
- Warm, natural and brief: at most 2 short sentences per reply. Replies may be read aloud, so no markdown, lists, emoji or headings.
- Ask exactly one question at a time to understand what they need: budget (monthly rent), furnishing, move-in timing, who will stay, and any must-haves (parking, pets, metro, gym...). Skip anything they already told you.
- Use Indian conventions: write rupee amounts as Rs with K for thousands (Rs 25K; the app shows the ₹ sign), BHK, area names like Indiranagar, HSR Layout, Koramangala, Whitefield.
- Once you know the area plus at least budget and furnishing, say you're showing a few example homes (live listings are being connected soon), then ask one refinement question. Never claim they are real matches.
- If they ask something general about renting (deposits, agreements, neighbourhoods), answer helpfully and briefly, then steer back.
- Never invent specific listings, addresses, landlord names or phone numbers.

Respond as JSON with these fields:
- reply: what you say to the user (the brief, speakable text described above).
- chips: 2 to 5 tap-to-answer options for the question you just asked, each at most 4 words (e.g. "Less than Rs 15K", "Rs 15K - 25K", "Semi furnished", "Within a month"). Always include chips when your reply asks a question; use [] only if you asked nothing.
- title: a short lowercase title for this search, e.g. "2bhk house for rent". Empty string if unknown.
- place: the Bengaluru area they want, e.g. "HSR Layout". Empty string if unknown.
- listings: true only in the reply where you say you're showing example homes.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    chips: { type: 'ARRAY', items: { type: 'STRING' } },
    title: { type: 'STRING' },
    place: { type: 'STRING' },
    listings: { type: 'BOOLEAN' },
  },
  required: ['reply', 'chips', 'title', 'place', 'listings'],
  // reply first, so it can be streamed to the screen while the rest arrives
  propertyOrdering: ['reply', 'chips', 'title', 'place', 'listings'],
}

/**
 * Read the value of the "reply" field from JSON that may still be arriving.
 * Returns what has been decoded so far.
 */
function partialReply(json: string) {
  const start = json.match(/"reply"\s*:\s*"/)
  if (!start || start.index === undefined) return ''
  let out = ''
  for (let i = start.index + start[0].length; i < json.length; i++) {
    const c = json[i]
    if (c === '"') break
    if (c !== '\\') {
      out += c
      continue
    }
    const n = json[i + 1]
    if (n === undefined) break
    if (n === 'u') {
      const hex = json.slice(i + 2, i + 6)
      if (hex.length < 4) break
      out += String.fromCharCode(parseInt(hex, 16))
      i += 5
      continue
    }
    out += ({ n: '\n', t: '\t', r: '', b: '', f: '' } as Record<string, string>)[n] ?? n
    i += 1
  }
  return out
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function handleChat(request: Request, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'POST only' })
  if (!apiKey) return json(500, { error: 'GOOGLE_AI_API_KEY is not set on the server' })

  let turns: ChatTurn[]
  let place = ''
  try {
    const body = (await request.json()) as { messages?: ChatTurn[]; place?: string }
    turns = (body.messages ?? []).filter((t) => t && t.text && (t.role === 'user' || t.role === 'assistant'))
    place = String(body.place ?? '').slice(0, 60)
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
    return json(400, { error: 'The last message must be from the user' })
  }
  // Keep requests small and bounded.
  turns = turns.slice(-24).map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }))

  const ask = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: request.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM}\n\nThe area shown in the app right now: ${place || 'not set'}.` }],
        },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 450,
          // Replies are short and conversational: answer fast rather than think long.
          thinkingConfig: model.startsWith('gemini-2') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' },
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    })

  let upstream: Response | null = null
  for (const model of [MODEL, ...BACKUP_MODELS]) {
    upstream = await ask(model)
    if (upstream.ok && upstream.body) break
    const detail = await upstream.text().catch(() => '')
    console.error(`[api/chat] ${model} ${upstream.status}: ${detail.slice(0, 200)}`)
    // Each model has its own quota: on limits, overload or a model this key
    // can't reach, try the next one. Bad requests or a bad key won't improve.
    if ([400, 401, 403].includes(upstream.status)) break
  }
  if (!upstream || !upstream.ok || !upstream.body) {
    const limited = upstream?.status === 429 || upstream?.status === 404
    return json(limited ? 429 : 502, {
      error: limited
        ? 'The assistant has reached its usage limit for now. Please try again later.'
        : `The AI service returned ${upstream?.status ?? 'nothing'}`,
      code: limited ? 'limit' : 'upstream',
    })
  }

  // Re-emit only the text parts of Gemini's server-sent events.
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let raw = ''
  let sent = 0
  // Hold back a few characters so "Rs 1" can still become "₹1" before it is sent.
  const HOLD = 4
  const stream = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const event = JSON.parse(line.slice(5))
            for (const part of event.candidates?.[0]?.content?.parts ?? []) {
              if (typeof part.text === 'string' && !part.thought) raw += part.text
            }
          } catch {
            // ignore keep-alives and partial lines
          }
        }
        // Stream the reply text as it forms.
        const reply = rupees(partialReply(raw))
        if (reply.length - HOLD > sent) {
          controller.enqueue(encoder.encode(reply.slice(sent, reply.length - HOLD)))
          sent = reply.length - HOLD
        }
      },
      flush(controller) {
        let data: { reply?: string; chips?: string[]; title?: string; place?: string; listings?: boolean } = {}
        try {
          data = JSON.parse(raw)
        } catch {
          // Cut off or malformed: keep whatever reply text arrived, without chips.
          console.error('[api/chat] could not parse reply JSON:', raw.slice(0, 200))
          data = { reply: partialReply(raw) }
        }
        const rest = rupees(String(data.reply ?? '')).slice(sent)
        if (rest) controller.enqueue(encoder.encode(rest))
        const chips = (Array.isArray(data.chips) ? data.chips : [])
          .map((chip) => rupees(String(chip)).trim())
          .filter((chip) => chip && chip.length <= 32)
        const meta = { chips, title: data.title ?? '', place: data.place ?? '', listings: !!data.listings }
        controller.enqueue(encoder.encode(`\n${META_MARK}\n${JSON.stringify(meta)}`))
      },
    }),
  )

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
