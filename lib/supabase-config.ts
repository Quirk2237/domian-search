import { createBrowserClient } from '@supabase/ssr'

/**
 * Get the Supabase project URL from environment variables
 */
export async function getProjectUrl(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured')
  }
  return url
}

/**
 * Get the Supabase anon key from environment variables
 */
export function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not configured')
  }
  return key
}

/**
 * Create a Supabase client for use in client components
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}