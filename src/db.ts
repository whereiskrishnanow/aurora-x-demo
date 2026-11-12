import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SearchResult } from './chat'

/**
 * Supabase storage for saved searches.
 *
 * The publishable key is meant for browsers; what protects the data is
 * row-level security (see supabase/schema.sql). Each browser signs in
 * anonymously, so every saved search belongs to that browser's own user.
 *
 * Everything here fails soft: if Supabase isn't configured, the table is
 * missing or anonymous sign-ins are off, saving is skipped and the menu
 * falls back to its sample list.
 */

export interface SavedSearch {
  id: string
  title: string
  place: string | null
  query: string | null
  brief: string | null
  result: SearchResult | null
  created_at: string
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

let client: SupabaseClient | null = null
let signingIn: Promise<boolean> | null = null

function db() {
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

/** Make sure this browser has its (anonymous) user. */
function ensureUser(): Promise<boolean> {
  const supabase = db()
  if (!supabase) return Promise.resolve(false)
  signingIn ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return true
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('[db] anonymous sign-in failed:', error.message)
      signingIn = null // allow a retry later (e.g. once it's enabled)
      return false
    }
    return true
  })()
  return signingIn
}

export async function saveSearch(entry: {
  title: string
  place: string
  query: string
  brief: string
  result: SearchResult
}): Promise<SavedSearch | null> {
  const supabase = db()
  if (!supabase || !(await ensureUser())) return null
  const { data, error } = await supabase.from('searches').insert(entry).select().single()
  if (error) {
    console.warn('[db] save failed:', error.message)
    return null
  }
  return data as SavedSearch
}

/** This browser's recent searches, newest first; null if storage isn't available. */
export async function listSearches(limit = 20): Promise<SavedSearch[] | null> {
  const supabase = db()
  if (!supabase || !(await ensureUser())) return null
  const { data, error } = await supabase
    .from('searches')
    .select('id, title, place, query, brief, result, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[db] list failed:', error.message)
    return null
  }
  return data as SavedSearch[]
}
