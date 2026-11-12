/**
 * POST /api/search — prototype of Aurora's "call around" step.
 *
 * This build can't place phone calls, so one Gemini call imagines a realistic
 * outcome for the brief: how many businesses were called and a few example
 * results. Everything is fictional and the app labels it as a demo.
 */

const MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest']

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    found: { type: 'INTEGER' },
    called: { type: 'INTEGER' },
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          rating: { type: 'NUMBER' },
          reviews: { type: 'INTEGER' },
          distance: { type: 'STRING' },
          price: { type: 'STRING' },
          detail: { type: 'STRING' },
          quote: { type: 'STRING' },
          badge: { type: 'STRING' },
        },
        required: ['name', 'rating', 'reviews', 'distance', 'price', 'detail', 'quote', 'badge'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['found', 'called', 'results', 'summary'],
}

const prompt = (brief: string) => `You are simulating the result of an AI agent that phoned local businesses in Bengaluru, India, for this request:

"${brief}"

Invent a realistic outcome for a product prototype:
- found: how many relevant businesses were discovered (20 to 200).
- called: how many were called (8 to 40, fewer than found).
- results: 4 businesses that confirmed they can help, best first. Use fictional but believable names (never real brands or chains). For each:
  name; rating 4.0 to 5.0; reviews count; distance like "1.2 km"; price in rupees using the ₹ sign (e.g. "₹1,800", "₹28,000/month", "₹450/visit");
  detail: one short line of the key facts (e.g. "Delivers by 4:30 PM · 2 dozen in stock");
  quote: what the person on the phone said, one natural sentence;
  badge: one of "Best price", "Fastest", "Closest", "Top rated", "In stock" (each at most once).
- summary: one or two short speakable sentences for the user summarising what you found and the best option, e.g. "I called 18 florists and 4 can deliver by 5 PM. Petal & Stem is cheapest at ₹1,650."`

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function handleSearch(request: Request, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'POST only' })
  if (!apiKey) return json(500, { error: 'GOOGLE_AI_API_KEY is not set on the server' })
  const { brief } = (await request.json().catch(() => ({}))) as { brief?: string }
  if (!brief) return json(400, { error: 'Missing brief' })

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        // Give up on a model that stops answering.
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt(String(brief).slice(0, 1500)) }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            thinkingConfig: model.startsWith('gemini-2') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' },
          },
        }),
      }).catch(() => null)
      if (response?.ok) {
        const body = await response.json().catch(() => null)
        const text = body?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text
        try {
          return json(200, JSON.parse(text))
        } catch {
          // malformed: try again
        }
      } else if (response?.status === 429 || response?.status === 400) {
        break
      }
    }
  }
  return json(503, { error: 'The search couldn’t run right now. Please try again in a moment.' })
}
