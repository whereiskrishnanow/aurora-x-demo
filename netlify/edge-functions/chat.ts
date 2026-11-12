import { handleChat } from '../../server/chat.ts'
import { withCors } from '../../server/cors.ts'

const handle = withCors(handleChat)

declare const Netlify: { env: { get(name: string): string | undefined } }

// /api/chat at the edge: runs in the Netlify location nearest the user
// (Mumbai for India) instead of one US region, cutting round trips.
export default (request: Request) => handle(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/chat' }
