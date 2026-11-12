import { handleSearch } from '../../server/search.ts'

declare const Netlify: { env: { get(name: string): string | undefined } }

export default (request: Request) => handleSearch(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/search' }
