import { handleChat } from '../../server/chat.ts'

declare const Netlify: { env: { get(name: string): string | undefined } }

// /api/chat at the edge: runs in the Netlify location nearest the user
// (Mumbai for India) instead of one US region, cutting round trips.
export default (request: Request) => handleChat(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/chat' }
