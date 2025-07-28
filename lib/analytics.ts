import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Generate or retrieve session ID
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: generate new session ID
    return uuidv4()
  }
  
  // Client-side: use localStorage
  const key = 'domain_search_session'
  let sessionId = localStorage.getItem(key)
  
  if (!sessionId) {
    sessionId = uuidv4()
    localStorage.setItem(key, sessionId)
  }
  
  return sessionId
}

// Track a domain search
export async function trackDomainSearch(
  sessionId: string,
  query: string,
  searchMode: 'domain' | 'suggestion',
  promptVersionId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('domain_searches')
      .insert({
        session_id: sessionId,
        query,
        search_mode: searchMode,
        prompt_version_id: promptVersionId
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  } catch (error) {
    console.error('Error tracking domain search:', error)
    throw error
  }
}

// Track domain suggestions
export async function trackDomainSuggestions(
  searchId: string,
  suggestions: Array<{
    domain: string
    extension: string
    available: boolean
    position: number
  }>
) {
  try {
    const { error } = await supabase
      .from('domain_suggestions')
      .insert(
        suggestions.map(s => ({
          search_id: searchId,
          domain: s.domain,
          extension: s.extension,
          available: s.available,
          position: s.position
        }))
      )

    if (error) throw error
  } catch (error) {
    console.error('Error tracking domain suggestions:', error)
    throw error
  }
}

// Track domain click
export async function trackDomainClick(
  suggestionId: string,
  sessionId: string
) {
  try {
    const { error } = await supabase
      .from('domain_clicks')
      .insert({
        suggestion_id: suggestionId,
        session_id: sessionId
      })

    if (error) throw error
  } catch (error) {
    console.error('Error tracking domain click:', error)
    throw error
  }
}

// Get suggestion ID by domain name and search ID
export async function getSuggestionId(
  searchId: string,
  domain: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('domain_suggestions')
      .select('id')
      .eq('search_id', searchId)
      .eq('domain', domain)
      .single()

    if (error || !data) return null
    return data.id
  } catch (error) {
    console.error('Error getting suggestion ID:', error)
    return null
  }
}