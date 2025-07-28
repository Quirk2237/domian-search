import { NextRequest, NextResponse } from 'next/server'
import { trackDomainClick } from '@/lib/analytics'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { domain, sessionId } = await request.json()
    
    if (!domain || !sessionId) {
      return NextResponse.json(
        { error: 'Domain and sessionId are required' },
        { status: 400 }
      )
    }

    // Find the most recent suggestion for this domain and session
    const { data: suggestion, error: suggestionError } = await supabase
      .from('domain_suggestions')
      .select('id, search_id')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (suggestionError || !suggestion) {
      console.error('Could not find suggestion for domain:', domain)
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      )
    }

    // Track the click
    await trackDomainClick(suggestion.id, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking domain click:', error)
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    )
  }
}