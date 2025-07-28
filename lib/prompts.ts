import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple in-memory cache for prompts
interface CacheEntry {
  content: string
  timestamp: number
}

const promptCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getActivePrompt(type: 'domain' | 'suggestion'): Promise<string> {
  // Check cache first
  const cacheKey = `prompt:${type}`
  const cached = promptCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content
  }

  try {
    // Query database for active prompt
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('prompt_content')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new Error(`No active prompt found for type: ${type}`)
    }

    // Cache the result
    promptCache.set(cacheKey, {
      content: data.prompt_content,
      timestamp: Date.now()
    })

    return data.prompt_content
  } catch (error) {
    console.error(`Error fetching prompt for ${type}:`, error)
    throw error
  }
}

// Clear cache (useful for testing or when prompts are updated)
export function clearPromptCache() {
  promptCache.clear()
}

// Get prompt version ID for tracking
export async function getActivePromptId(type: 'domain' | 'suggestion'): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('id')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new Error(`No active prompt found for type: ${type}`)
    }

    return data.id
  } catch (error) {
    console.error(`Error fetching prompt ID for ${type}:`, error)
    throw error
  }
}