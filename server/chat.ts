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

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

/**
 * Fastest first. Each model has its own free-tier quota, so when one is
 * exhausted or busy the next takes over.
 */
const MODELS = [env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

/**
 * Models known to be out of quota, retired or overloaded, and until when to
 * skip them. Lives as long as the server instance, so a warm instance stops
 * paying a failed round trip on every request.
 */
const benched = new Map<string, number>()
const bench = (model: string, seconds: number) => benched.set(model, Date.now() + seconds * 1000)

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

  const ask = (model: string, signal: AbortSignal) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM}\n\nThe area shown in the app right now: ${place || 'not set'}.` }],
        },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 400,
          // Replies are short and conversational: answer fast rather than think long.
          thinkingConfig: model.startsWith('gemini-2') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' },
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    })

  /** Why a model failed, and how long to leave it alone. */
  const sideline = (model: string, status: number, detail: string) => {
    console.error(`[api/chat] ${model} ${status}: ${detail.slice(0, 160)}`)
    const retry = Number(detail.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 0)
    if (status === 429) bench(model, Math.min(Math.max(retry, 60), 30 * 60))
    else if (status === 404) bench(model, 6 * 60 * 60) // retired or unavailable to this key
    else if (status >= 500) bench(model, 30) // overloaded: brief rest
  }

  type Outcome = { ok: true; body: ReadableStream<Uint8Array>; stop: () => void } | { ok: false; status: number }

  /** One model, up to its first real event (a busy model can say so inside a 200). */
  const attempt = async (model: string, controller: AbortController): Promise<Outcome> => {
    try {
      const upstream = await ask(model, controller.signal)
      if (!upstream.ok || !upstream.body) {
        sideline(model, upstream.status, await upstream.text().catch(() => ''))
        return { ok: false, status: upstream.status }
      }
      const reader = upstream.body.getReader()
      const head: Uint8Array[] = []
      const peek = new TextDecoder()
      let seen = ''
      while (!/^data:.*\n/m.test(seen)) {
        const { done, value } = await reader.read()
        if (done) break
        head.push(value)
        seen += peek.decode(value, { stream: true })
      }
      if (/^data:\s*\{\s*"error"/m.test(seen) || seen.trim() === '') {
        reader.cancel().catch(() => undefined)
        const status = Number(seen.match(/"code":\s*(\d+)/)?.[1] ?? 503)
        sideline(model, status, seen)
        return { ok: false, status }
      }
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          head.forEach((chunk) => c.enqueue(chunk))
        },
        async pull(c) {
          const { done, value } = await reader.read()
          if (done) c.close()
          else c.enqueue(value)
        },
        cancel() {
          reader.cancel().catch(() => undefined)
        },
      })
      return { ok: true, body, stop: () => controller.abort() }
    } catch {
      return { ok: false, status: controller.signal.aborted ? 499 : 503 }
    }
  }

  /*
   * Staggered race: start the fastest model; if it hasn't begun answering
   * within HEDGE_MS (or fails), start the next one too. The first to answer
   * wins and the others are cancelled. Slow requests cost one extra call;
   * normal ones cost nothing extra.
   */
  const HEDGE_MS = 2500
  const now = Date.now()
  const available = MODELS.filter((m) => (benched.get(m) ?? 0) <= now)
  const queue = available.length ? available : MODELS
  const controllers: AbortController[] = []
  request.signal.addEventListener('abort', () => controllers.forEach((c) => c.abort()))

  let lastStatus = 0
  const winner = await new Promise<Extract<Outcome, { ok: true }> | null>((resolve) => {
    let next = 0
    let running = 0
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const launch = () => {
      if (settled || next >= queue.length) {
        if (!settled && running === 0) {
          settled = true
          resolve(null)
        }
        return
      }
      const controller = new AbortController()
      controllers.push(controller)
      running += 1
      clearTimeout(timer)
      timer = setTimeout(launch, HEDGE_MS)
      attempt(queue[next++], controller).then((outcome) => {
        running -= 1
        if (settled) {
          if (outcome.ok) outcome.stop()
          return
        }
        if (outcome.ok) {
          settled = true
          clearTimeout(timer)
          controllers.forEach((c) => c !== controller && c.abort())
          resolve(outcome)
          return
        }
        lastStatus = outcome.status
        if ([400, 401, 403].includes(outcome.status)) {
          settled = true // a bad request or key won't improve on another model
          clearTimeout(timer)
          controllers.forEach((c) => c.abort())
          resolve(null)
          return
        }
        launch() // failed fast: don't wait for the hedge timer
      })
    }
    launch()
  })
  const body = winner?.body ?? null

  if (!body) {
    const limited = lastStatus === 429 || lastStatus === 404 || lastStatus === 503
    return json(limited ? 429 : 502, {
      error: limited
        ? 'The assistant has reached its usage limit for now. Please try again later.'
        : `The AI service returned ${lastStatus || 'nothing'}`,
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
  const stream = body.pipeThrough(
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
