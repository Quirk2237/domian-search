import { db } from '@/db'
import { eq } from 'drizzle-orm'

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
    await db.execute(`
      INSERT INTO api_usage_logs (
        search_id, provider, endpoint, model, temperature,
        input_tokens, output_tokens, total_tokens, cost,
        response_time_ms, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      usage.searchId,
      usage.provider,
      usage.endpoint,
      usage.model || null,
      usage.temperature || null,
      usage.inputTokens || null,
      usage.outputTokens || null,
      usage.totalTokens || null,
      usage.cost,
      usage.responseTimeMs || null,
      usage.errorMessage || null
    ])
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
    const updates: string[] = []
    const values: (string | number | null)[] = []
    let paramCount = 1

    if (data.llmModel !== undefined) {
      updates.push(`llm_model = $${paramCount}`)
      values.push(data.llmModel)
      paramCount++
    }

    if (data.llmTemperature !== undefined) {
      updates.push(`llm_temperature = $${paramCount}`)
      values.push(data.llmTemperature)
      paramCount++
    }

    if (data.totalTokens !== undefined) {
      updates.push(`total_tokens = COALESCE(total_tokens, 0) + $${paramCount}`)
      values.push(data.totalTokens)
      paramCount++
    }

    if (data.inputTokens !== undefined) {
      updates.push(`input_tokens = COALESCE(input_tokens, 0) + $${paramCount}`)
      values.push(data.inputTokens)
      paramCount++
    }

    if (data.outputTokens !== undefined) {
      updates.push(`output_tokens = COALESCE(output_tokens, 0) + $${paramCount}`)
      values.push(data.outputTokens)
      paramCount++
    }

    if (data.groqCost !== undefined) {
      updates.push(`groq_cost = COALESCE(groq_cost, 0) + $${paramCount}`)
      values.push(data.groqCost)
      paramCount++
    }

    if (data.domainrRequests !== undefined) {
      updates.push(`domainr_requests = COALESCE(domainr_requests, 0) + $${paramCount}`)
      values.push(data.domainrRequests)
      paramCount++
    }

    if (data.totalCost !== undefined) {
      updates.push(`total_cost = COALESCE(total_cost, 0) + $${paramCount}`)
      values.push(data.totalCost)
      paramCount++
    }

    if (updates.length > 0) {
      values.push(searchId)
      await db.execute(`
        UPDATE domain_searches
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
      `, values)
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
  const dateFilter = startDate && endDate ? 
    `WHERE created_at >= $1 AND created_at <= $2` : ''
  const params = startDate && endDate ? [startDate, endDate] : []

  const result = await db.execute(`
    SELECT 
      COUNT(*)::int as total_searches,
      SUM(total_cost)::numeric as total_cost,
      AVG(total_cost)::numeric as avg_cost_per_search,
      SUM(total_tokens)::int as total_tokens,
      AVG(total_tokens)::numeric as avg_tokens_per_search,
      SUM(groq_cost)::numeric as total_groq_cost,
      SUM(domainr_requests)::int as total_domainr_requests
    FROM domain_searches
    ${dateFilter}
  `, params)

  return result.rows[0]
}

/**
 * Get detailed cost breakdown by provider
 */
export async function getCostBreakdownByProvider(startDate?: Date, endDate?: Date) {
  const dateFilter = startDate && endDate ? 
    `WHERE created_at >= $1 AND created_at <= $2` : ''
  const params = startDate && endDate ? [startDate, endDate] : []

  const result = await db.execute(`
    SELECT 
      provider,
      COUNT(*)::int as request_count,
      SUM(cost)::numeric as total_cost,
      AVG(cost)::numeric as avg_cost,
      SUM(total_tokens)::int as total_tokens
    FROM api_usage_logs
    ${dateFilter}
    GROUP BY provider
    ORDER BY total_cost DESC
  `, params)

  return result.rows
}