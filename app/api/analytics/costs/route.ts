import { NextRequest, NextResponse } from 'next/server'
import { getCostAnalytics, getCostBreakdownByProvider } from '@/lib/cost-tracking'

interface ProviderBreakdown {
  provider: string
  request_count: string
  total_cost: string
  avg_cost: string
  total_tokens: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('range') || '7d' // Default to last 7 days
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'all':
        startDate.setFullYear(2000) // Effectively all time
        break
      default:
        startDate.setDate(startDate.getDate() - 7)
    }
    
    // Get overall cost analytics
    const analytics = await getCostAnalytics(startDate, endDate)
    
    // Get breakdown by provider
    const providerBreakdown = await getCostBreakdownByProvider(startDate, endDate)
    
    // Calculate additional metrics
    const totalSearches = parseInt(String(analytics.total_searches)) || 0
    const avgCostPerSearch = parseFloat(String(analytics.avg_cost_per_search)) || 0
    const totalCost = parseFloat(String(analytics.total_cost)) || 0
    
    // Format response
    const response = {
      timeRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalSearches,
        totalCost: totalCost.toFixed(6),
        avgCostPerSearch: avgCostPerSearch.toFixed(6),
        totalTokens: parseInt(String(analytics.total_tokens)) || 0,
        avgTokensPerSearch: parseFloat(String(analytics.avg_tokens_per_search)) || 0,
        totalGroqCost: parseFloat(String(analytics.total_groq_cost)) || 0,
        totalDomainrRequests: parseInt(String(analytics.total_domainr_requests)) || 0
      },
      providerBreakdown: providerBreakdown.map((provider) => ({
        provider: String(provider.provider),
        requestCount: parseInt(String(provider.request_count)) || 0,
        totalCost: parseFloat(String(provider.total_cost)) || 0,
        avgCost: parseFloat(String(provider.avg_cost)) || 0,
        totalTokens: parseInt(String(provider.total_tokens)) || 0
      })),
      // Cost per 1000 searches
      costPer1000Searches: totalSearches > 0 ? (totalCost / totalSearches * 1000).toFixed(2) : '0.00',
      // Estimated monthly cost (based on current rate)
      estimatedMonthlyCost: totalSearches > 0 ? 
        (totalCost / totalSearches * totalSearches / (endDate.getTime() - startDate.getTime()) * 30 * 24 * 60 * 60 * 1000).toFixed(2) : 
        '0.00'
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching cost analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cost analytics' },
      { status: 500 }
    )
  }
}