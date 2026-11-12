/**
 * Where the AI endpoints live. Empty on Netlify and in development (same
 * site); the GitHub Pages build sets VITE_API_BASE to the Netlify address.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

export const api = (path: string) => `${API_BASE}${path}`
