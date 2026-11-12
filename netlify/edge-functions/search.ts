import { handleSearch } from '../../server/search.ts'
import { withCors } from '../../server/cors.ts'

const handle = withCors(handleSearch)

declare const Netlify: { env: { get(name: string): string | undefined } }

export default (request: Request) => handle(request, Netlify.env.get('GOOGLE_AI_API_KEY'))

export const config = { path: '/api/search' }
