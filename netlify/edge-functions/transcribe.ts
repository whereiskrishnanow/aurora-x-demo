import { handleTranscribe } from '../../server/transcribe.ts'
import { withCors } from '../../server/cors.ts'

const handle = withCors(handleTranscribe)

declare const Netlify: { env: { get(name: string): string | undefined } }

// /api/transcribe at the edge, next to /api/chat.
export default (request: Request) => handle(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/transcribe' }
