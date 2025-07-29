import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Pricing constants (per million tokens)
const GROQ_GEMMA2_PRICE_PER_M = 0.04 // $0.04 per million tokens (both input and output)
const DOMAINR_FREE_TIER_LIMIT = 10000 // 10k requests per month

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ApiUsageLog {
  searchId: string
  provider: 'groq' | 'domainr' | 'anthropic'
  endpoint: string
  model?: string
  temperature?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost: number
  responseTimeMs?: number
  errorMessage?: string
}

/**
 * Calculate the cost for Groq API usage
 */
export function calculateGroqCost(tokens: number): number {
  return (tokens / 1_000_000) * GROQ_GEMMA2_PRICE_PER_M
}

/**
 * Extract token usage from Groq API response
 */
export function extractGroqTokenUsage(response: {
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}): TokenUsage | null {
  // Groq API may include usage information in the response
  if (response?.usage) {
    return {
      inputTokens: response.usage.prompt_tokens || 0,
      outputTokens: response.usage.completion_tokens || 0,
      totalTokens: response.usage.total_tokens || 0
    }
  }
  
  // If no usage data, return null (will need to estimate)
  return null
}

/**
 * Estimate token count for a string (rough approximation)
 * More accurate counting would require tiktoken library
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  // This is a simplified estimation - for production, use tiktoken
  return Math.ceil(text.length / 4)
}

/**
 * Log API usage to the database
 */
export async function logApiUsage(usage: ApiUsageLog): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_usage_logs')
      .insert({
        search_id: usage.searchId,
        provider: usage.provider,
        endpoint: usage.endpoint,
        model: usage.model || null,
        temperature: usage.temperature || null,
        input_tokens: usage.inputTokens || null,
        output_tokens: usage.outputTokens || null,
        total_tokens: usage.totalTokens || null,
        cost: usage.cost,
        response_time_ms: usage.responseTimeMs || null,
        error_message: usage.errorMessage || null
      })
    
    if (error) {
      console.error('Error logging API usage:', error)
    }
  } catch (error) {
    console.error('Error logging API usage:', error)
    // Don't throw - logging errors shouldn't break the main flow
  }
}

/**
 * Update domain search with cost information
 */
export async function updateSearchCosts(
  searchId: string,
  data: {
    llmModel?: string
    llmTemperature?: number
    totalTokens?: number
    inputTokens?: number
    outputTokens?: number
    groqCost?: number
    domainrRequests?: number
    totalCost?: number
  }
): Promise<void> {
  try {
    // First, get current values to handle increments
    const { data: currentData } = await supabase
      .from('domain_searches')
      .select('total_tokens, input_tokens, output_tokens, groq_cost, domainr_requests, total_cost')
      .eq('id', searchId)
      .single()
    
    const updateData: Record<string, string | number> = {}
    
    if (data.llmModel !== undefined) {
      updateData.llm_model = data.llmModel
    }

    if (data.llmTemperature !== undefined) {
      updateData.llm_temperature = data.llmTemperature
    }

    if (data.totalTokens !== undefined) {
      updateData.total_tokens = (currentData?.total_tokens || 0) + data.totalTokens
    }

    if (data.inputTokens !== undefined) {
      updateData.input_tokens = (currentData?.input_tokens || 0) + data.inputTokens
    }

    if (data.outputTokens !== undefined) {
      updateData.output_tokens = (currentData?.output_tokens || 0) + data.outputTokens
    }

    if (data.groqCost !== undefined) {
      updateData.groq_cost = (currentData?.groq_cost || 0) + data.groqCost
    }

    if (data.domainrRequests !== undefined) {
      updateData.domainr_requests = (currentData?.domainr_requests || 0) + data.domainrRequests
    }

    if (data.totalCost !== undefined) {
      updateData.total_cost = (currentData?.total_cost || 0) + data.totalCost
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('domain_searches')
        .update(updateData)
        .eq('id', searchId)
      
      if (error) {
        console.error('Error updating search costs:', error)
      }
    }
  } catch (error) {
    console.error('Error updating search costs:', error)
    // Don't throw - cost tracking errors shouldn't break the main flow
  }
}

/**
 * Get cost analytics for a given time period
 */
export async function getCostAnalytics(startDate?: Date, endDate?: Date) {
  try {
    let query = supabase
      .from('domain_searches')
      .select('total_cost, total_tokens, groq_cost, domainr_requests', { count: 'exact' })
    
    if (startDate && endDate) {
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('Error fetching cost analytics:', error)
      return {
        total_searches: 0,
        total_cost: 0,
        avg_cost_per_search: 0,
        total_tokens: 0,
        avg_tokens_per_search: 0,
        total_groq_cost: 0,
        total_domainr_requests: 0
      }
    }
    
    // Calculate aggregates
    const stats = data?.reduce((acc, row) => ({
      total_cost: acc.total_cost + (row.total_cost || 0),
      total_tokens: acc.total_tokens + (row.total_tokens || 0),
      total_groq_cost: acc.total_groq_cost + (row.groq_cost || 0),
      total_domainr_requests: acc.total_domainr_requests + (row.domainr_requests || 0)
    }), { total_cost: 0, total_tokens: 0, total_groq_cost: 0, total_domainr_requests: 0 }) || 
    { total_cost: 0, total_tokens: 0, total_groq_cost: 0, total_domainr_requests: 0 }
    
    const totalSearches = count || 0
    
    return {
      total_searches: totalSearches,
      total_cost: stats.total_cost,
      avg_cost_per_search: totalSearches > 0 ? stats.total_cost / totalSearches : 0,
      total_tokens: stats.total_tokens,
      avg_tokens_per_search: totalSearches > 0 ? stats.total_tokens / totalSearches : 0,
      total_groq_cost: stats.total_groq_cost,
      total_domainr_requests: stats.total_domainr_requests
    }
  } catch (error) {
    console.error('Error in getCostAnalytics:', error)
    return {
      total_searches: 0,
      total_cost: 0,
      avg_cost_per_search: 0,
      total_tokens: 0,
      avg_tokens_per_search: 0,
      total_groq_cost: 0,
      total_domainr_requests: 0
    }
  }
}

/**
 * Get detailed cost breakdown by provider
 */
export async function getCostBreakdownByProvider(startDate?: Date, endDate?: Date) {
  try {
    let query = supabase
      .from('api_usage_logs')
      .select('provider, cost, total_tokens')
    
    if (startDate && endDate) {
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching cost breakdown:', error)
      return []
    }
    
    // Group by provider and calculate aggregates
    const breakdown = data?.reduce((acc, row) => {
      const provider = row.provider
      if (!acc[provider]) {
        acc[provider] = {
          provider,
          request_count: 0,
          total_cost: 0,
          total_tokens: 0
        }
      }
      acc[provider].request_count++
      acc[provider].total_cost += row.cost || 0
      acc[provider].total_tokens += row.total_tokens || 0
      return acc
    }, {} as Record<string, {
      provider: string
      request_count: number
      total_cost: number
      total_tokens: number
    }>) || {}
    
    // Convert to array and calculate averages
    return Object.values(breakdown)
      .map(item => ({
        ...item,
        avg_cost: item.request_count > 0 ? item.total_cost / item.request_count : 0
      }))
      .sort((a, b) => b.total_cost - a.total_cost)
  } catch (error) {
    console.error('Error in getCostBreakdownByProvider:', error)
    return []
  }
}