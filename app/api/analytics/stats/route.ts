import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Get total searches
    const { count: totalSearches, error: searchesError } = await supabase
      .from('domain_searches')
      .select('*', { count: 'exact', head: true })

    if (searchesError) throw searchesError

    // Get total domains served (suggestions)
    const { count: totalDomains, error: domainsError } = await supabase
      .from('domain_suggestions')
      .select('*', { count: 'exact', head: true })

    if (domainsError) throw domainsError

    // Get total clicks
    const { count: totalClicks, error: clicksError } = await supabase
      .from('domain_clicks')
      .select('*', { count: 'exact', head: true })

    if (clicksError) throw clicksError

    // Get available domains served
    const { count: availableDomains, error: availableError } = await supabase
      .from('domain_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('available', true)

    if (availableError) throw availableError

    // Calculate click-through rate
    const clickThroughRate = availableDomains && availableDomains > 0 
      ? (totalClicks || 0) / availableDomains * 100 
      : 0

    // Get searches by mode
    const { data: searchesByMode, error: modeError } = await supabase
      .from('domain_searches')
      .select('search_mode')
      .then(result => {
        if (result.error) throw result.error
        const counts = { domain: 0, suggestion: 0 }
        result.data?.forEach(row => {
          counts[row.search_mode as keyof typeof counts]++
        })
        return { data: counts, error: null }
      })

    if (modeError) throw modeError

    // Get recent searches (last 24 hours)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { count: recentSearches, error: recentError } = await supabase
      .from('domain_searches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    if (recentError) throw recentError

    // Get top clicked domains
    const { data: topDomains, error: topError } = await supabase
      .from('domain_clicks')
      .select(`
        suggestion_id,
        domain_suggestions!inner(domain, extension)
      `)
      .limit(10)

    if (topError) throw topError

    // Process top domains to count clicks
    const domainClickCounts = new Map<string, number>()
    topDomains?.forEach((click: any) => {
      const domain = click.domain_suggestions?.domain
      if (domain) {
        domainClickCounts.set(domain, (domainClickCounts.get(domain) || 0) + 1)
      }
    })

    const topClickedDomains = Array.from(domainClickCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, clicks]) => ({ domain, clicks }))

    return NextResponse.json({
      totalSearches: totalSearches || 0,
      totalDomains: totalDomains || 0,
      totalClicks: totalClicks || 0,
      availableDomains: availableDomains || 0,
      clickThroughRate: Math.round(clickThroughRate * 10) / 10,
      searchesByMode: searchesByMode || { domain: 0, suggestion: 0 },
      recentSearches: recentSearches || 0,
      topClickedDomains
    })
  } catch (error) {
    console.error('Error fetching analytics stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}