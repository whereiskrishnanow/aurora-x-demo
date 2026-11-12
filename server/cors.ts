/**
 * Lets the app's pages call the API from another address: the GitHub Pages
 * site calls these Netlify functions. Only the known app addresses are allowed.
 */

const ALLOWED = [
  'https://whereiskrishnanow.github.io',
  'https://aurora-x-test-1.netlify.app',
  'http://localhost:5176',
  'https://localhost:5177',
]

type Handler = (request: Request, apiKey: string | undefined) => Promise<Response>

export function withCors(handler: Handler): Handler {
  return async (request, apiKey) => {
    const origin = request.headers.get('origin') ?? ''
    const allowed = ALLOWED.includes(origin) || /^https:\/\/[a-z0-9]+--aurora-x-test-1\.netlify\.app$/.test(origin)
    const headers: Record<string, string> = allowed
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
          vary: 'origin',
        }
      : {}
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers })
    const response = await handler(request, apiKey)
    if (!allowed) return response
    const merged = new Headers(response.headers)
    Object.entries(headers).forEach(([k, v]) => merged.set(k, v))
    return new Response(response.body, { status: response.status, headers: merged })
  }
}
