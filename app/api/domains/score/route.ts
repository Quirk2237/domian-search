import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const searchId = searchParams.get('searchId')
    
    if (!searchId) {
      return NextResponse.json(
        { error: 'searchId parameter is required' },
        { status: 400 }
      )
    }

    // Fetch the score for this search
    const { data, error } = await supabase
      .from('domain_search_scores')
      .select(`
        overall_score,
        score_details,
        scored_at
      `)
      .eq('search_id', searchId)
      .single()

    if (error) {
      // If no score found yet, return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ score: null })
      }
      throw error
    }

    // Extract key information from score_details
    const scoreData = {
      overall_score: data.overall_score,
      scored_at: data.scored_at,
      summary: data.score_details?.summary || '',
      strengths: data.score_details?.strengths || [],
      weaknesses: data.score_details?.weaknesses || [],
      criteria_scores: data.score_details?.criteria_scores || {}
    }

    return NextResponse.json({ score: scoreData })
  } catch (error) {
    console.error('Error fetching domain score:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domain score' },
      { status: 500 }
    )
  }
}