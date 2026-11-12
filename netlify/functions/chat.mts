import { handleChat } from '../../server/chat'

// Live version of the dev server's /api/chat. Set GOOGLE_AI_API_KEY in the
// Netlify site's environment variables; it stays on the server.
export default (request: Request) => handleChat(request, process.env.GOOGLE_AI_API_KEY)

export const config = { path: '/api/chat' }
