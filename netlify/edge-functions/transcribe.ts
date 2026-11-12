import { handleTranscribe } from '../../server/transcribe.ts'

declare const Netlify: { env: { get(name: string): string | undefined } }

// /api/transcribe at the edge, next to /api/chat.
export default (request: Request) => handleTranscribe(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/transcribe' }
