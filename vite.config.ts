import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { Readable } from 'node:stream'
import { handleChat } from './server/chat'
import { handleTranscribe } from './server/transcribe'

const ROUTES: Record<string, (request: Request, apiKey: string | undefined) => Promise<Response>> = {
  '/api/chat': handleChat,
  '/api/transcribe': handleTranscribe,
}

/**
 * Serves /api/chat and /api/transcribe from the dev server. The key is read from .env.local on
 * the server side only (no VITE_ prefix), so it never reaches the browser.
 */
function chatApi(apiKey: string | undefined): Plugin {
  return {
    name: 'chat-api',
    configureServer(server) {
      for (const [route, handler] of Object.entries(ROUTES))
        server.middlewares.use(route, async (req, res) => {
          const controller = new AbortController()
          res.on('close', () => controller.abort())
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const request = new Request(`http://localhost${route}`, {
              method: req.method,
              headers: { 'content-type': String(req.headers['content-type'] ?? 'application/json') },
              body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
              signal: controller.signal,
            })
            const response = await handler(request, apiKey)
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            if (response.body) Readable.fromWeb(response.body as never).pipe(res)
            else res.end()
          } catch (error) {
            if (controller.signal.aborted) return
            console.error(`[${route}]`, error)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Chat failed' }))
          }
        })
    },
  }
}

// `npm run dev:phone` serves over HTTPS on the local network: phones only
// share the gyroscope (and the microphone) with secure pages.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const phone = mode === 'phone'
  return {
    plugins: [react(), chatApi(env.GOOGLE_AI_API_KEY), ...(phone ? [basicSsl()] : [])],
    server: { port: phone ? 5177 : 5176, strictPort: true, host: true },
  }
})
