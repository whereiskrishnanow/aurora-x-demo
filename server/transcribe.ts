/**
 * POST /api/transcribe — turns a short voice recording (16 kHz mono WAV)
 * into text with Gemini. Used by dictation when the browser's own
 * speech-to-text is missing or fails (Chrome on iPhone, Brave, Firefox, or a
 * speech service that silently does nothing).
 *
 * Web-standard Request/Response, so it runs both in the Vite dev server and as
 * a Netlify edge function.
 */

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

/** Tried in order; each has its own free-tier quota and its own bad moments. */
const MODELS = [env.GEMINI_TRANSCRIBE_MODEL || 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

const MAX_BYTES = 4 * 1024 * 1024 // about two minutes of 16 kHz speech

const PROMPT = `Transcribe this voice message exactly as spoken. The speaker is using a rental-search app in Bengaluru, India, so expect Indian English, area names (Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar...), BHK, and rupee amounts.
Write numbers naturally (2BHK, 30K, 15,000). Reply with only the spoken words: no quotes, labels or notes. If nothing intelligible was said, reply with an empty string.`

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Base64 without blowing the call stack on large buffers. */
function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function handleTranscribe(request: Request, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'POST only' })
  if (!apiKey) return json(500, { error: 'GOOGLE_AI_API_KEY is not set on the server' })

  const audio = new Uint8Array(await request.arrayBuffer())
  if (audio.length < 1000) return json(200, { text: '' })
  if (audio.length > MAX_BYTES) return json(413, { error: 'That recording is too long. Try a shorter message.' })
  const mimeType = request.headers.get('content-type')?.split(';')[0] || 'audio/wav'
  const data = toBase64(audio)

  /** One model, with one quick retry on Google's occasional empty 404 / busy 503. */
  const attempt = async (model: string, signal: AbortSignal): Promise<{ text: string } | { status: number }> => {
    let status = 0
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data } }, { text: PROMPT }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 600,
            thinkingConfig: model.startsWith('gemini-2') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' },
          },
        }),
      }).catch(() => null)
      status = response?.status ?? 0
      if (response?.ok) {
        const body = await response.json().catch(() => null)
        const text = (body?.candidates?.[0]?.content?.parts ?? [])
          .filter((p: { text?: string; thought?: boolean }) => typeof p.text === 'string' && !p.thought)
          .map((p: { text: string }) => p.text)
          .join('')
          .replace(/^["'\s]+|["'\s]+$/g, '')
        return { text }
      }
      const detail = (await response?.text().catch(() => '')) ?? ''
      if (!signal.aborted) console.error(`[api/transcribe] ${model} ${status}: ${detail.slice(0, 160)}`)
      if ([400, 401, 403, 429].includes(status) || signal.aborted) break
    }
    return { status }
  }

  /*
   * Staggered race, as in /api/chat: start the first model; if it hasn't
   * answered in HEDGE_MS (or fails), start the next too. First answer wins.
   */
  const HEDGE_MS = 4000
  const controllers: AbortController[] = []
  request.signal.addEventListener('abort', () => controllers.forEach((c) => c.abort()))
  let lastStatus = 0
  const result = await new Promise<{ text: string } | null>((resolve) => {
    let next = 0
    let running = 0
    let done = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const launch = () => {
      if (done) return
      if (next >= MODELS.length) {
        if (running === 0) {
          done = true
          resolve(null)
        }
        return
      }
      const controller = new AbortController()
      controllers.push(controller)
      running += 1
      clearTimeout(timer)
      timer = setTimeout(launch, HEDGE_MS)
      attempt(MODELS[next++], controller.signal).then((outcome) => {
        running -= 1
        if (done) return
        if ('text' in outcome) {
          done = true
          clearTimeout(timer)
          controllers.forEach((c) => c !== controller && c.abort())
          resolve(outcome)
          return
        }
        lastStatus = outcome.status
        if ([400, 401, 403].includes(outcome.status)) {
          done = true
          clearTimeout(timer)
          controllers.forEach((c) => c.abort())
          resolve(null)
          return
        }
        launch()
      })
    }
    launch()
  })
  if (result) return json(200, result)
  if ([400, 401, 403].includes(lastStatus)) return json(502, { error: 'The transcription service rejected the audio.' })
  const limited = lastStatus === 429 || lastStatus === 404 || lastStatus === 503
  return json(limited ? 429 : 502, {
    error: limited
      ? 'Transcription is busy or over its limit right now. Please try again in a moment.'
      : 'Couldn’t transcribe that recording.',
  })
}
