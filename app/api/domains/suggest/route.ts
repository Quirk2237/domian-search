import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import axios, { AxiosError } from 'axios'
import { formatDomainName } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'
import { getActivePrompt, getActivePromptId } from '@/lib/prompts'
import { getSessionId, trackDomainSearch, trackDomainSuggestions } from '@/lib/analytics'
import { 
  extractGroqTokenUsage, 
  estimateTokenCount, 
  calculateGroqCost,
  logApiUsage,
  updateSearchCosts
} from '@/lib/cost-tracking'
import { checkDomainsNamecheap, isDomainAvailable, getDomainPrice, type NamecheapConfig } from '@/lib/namecheap'

// Simple in-memory cache
interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
  isPremium?: boolean
  price?: number
}

interface CacheEntry {
  data: SuggestionResult[]
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Track API failures to temporarily disable
let apiFailureCount = 0
const MAX_API_FAILURES = 3
let apiDisabledUntil = 0

async function generateMoreSuggestions(
  query: string, 
  existingDomains: string[], 
  basePrompt: string,
  groqApiKey?: string,
  retryCount: number = 0
): Promise<{
  suggestions: Array<{ domain: string; extension?: string; reason?: string }>,
  tokenUsage: { inputTokens: number, outputTokens: number, cost: number }
}> {
  console.log(`Generating more suggestions for retry ${retryCount}. Original query:`, query)
  
  if (!groqApiKey) {
    // Return empty array if no API key
    return { 
      suggestions: [], 
      tokenUsage: { inputTokens: 0, outputTokens: 0, cost: 0 }
    }
  }

  const groq = new Groq({ apiKey: groqApiKey })
  
  // Create retry-specific prompt with pretext to avoid existing domains
  const retryPretext = `IMPORTANT: DO NOT suggest any of these previously suggested domains:
${existingDomains.map(domain => `- ${domain}`).join('\n')}

Generate completely different alternatives following the same framework below.
Focus on maximum creativity and availability - assume common words are taken.

`

  // Adjust extensions based on retry count while maintaining .com requirement
  const extensionGuidance = retryCount === 1 ? 
    '\nFOCUS: Prioritize alternative TLDs (.io, .co, .app) for remaining 40% while still ensuring 60% are .com' :
    retryCount === 2 ? 
    '\nFOCUS: Try .net, .org, .ai domains for remaining 40% while still ensuring 60% are .com' :
    '\nFOCUS: Be maximally creative with invented brandables, ensure 60% are .com domains'

  // Add output format to retry prompt
  const outputFormat = `

OUTPUT FORMAT:
Generate exactly 10 domains as a JSON array with this structure:
[
  {"domain":"example.com","extension":".com","reason":"Brief explanation"},
  {"domain":"another.io","extension":".io","reason":"Why this domain works"}
]

IMPORTANT: Output ONLY the JSON array. Start with [ and end with ].`

  const modifiedPrompt = retryPretext + basePrompt + extensionGuidance + outputFormat

  const retryTemperature = 0.4 // Slightly higher for more variety on retries
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: modifiedPrompt
      },
      {
        role: 'user',
        content: query
      }
    ],
    model: 'gemma2-9b-it',
    temperature: retryTemperature,
    max_tokens: 2000
  })

  const responseContent = completion.choices[0]?.message?.content || '[]'
  console.log('AI Response for retry suggestions:', responseContent)
  
  // Extract token usage for retry
  let inputTokens = 0
  let outputTokens = 0
  const tokenUsage = extractGroqTokenUsage(completion)
  if (tokenUsage) {
    inputTokens = tokenUsage.inputTokens
    outputTokens = tokenUsage.outputTokens
  } else {
    // Estimate if not provided
    inputTokens = estimateTokenCount(modifiedPrompt + query)
    outputTokens = estimateTokenCount(responseContent)
  }
  
  const cost = calculateGroqCost(inputTokens + outputTokens)
  
  // Use the same JSON extraction logic
  let jsonContent = responseContent
  
  const thinkEndIndex = responseContent.indexOf('</think>')
  if (thinkEndIndex !== -1) {
    jsonContent = responseContent.substring(thinkEndIndex + 8).trim()
  } else if (responseContent.includes('<think>')) {
    const thinkStartIndex = responseContent.lastIndexOf('<think>')
    if (thinkStartIndex > 0) {
      jsonContent = responseContent.substring(0, thinkStartIndex).trim()
    }
  }
  
  // Handle code blocks (```json or ```)
  jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  
  // Try to extract JSON array
  const jsonStart = jsonContent.indexOf('[')
  const jsonEnd = jsonContent.lastIndexOf(']')
  
  if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
    // Try to match JSON array pattern - more flexible regex
    const jsonMatch = jsonContent.match(/\[\s*(?:\{[^}]*\}(?:\s*,\s*)?)*\s*\]/)
    if (jsonMatch) {
      jsonContent = jsonMatch[0]
    } else {
      // Try another pattern for complex JSON
      const complexMatch = jsonContent.match(/\[[\s\S]*\]/)
      if (complexMatch) {
        jsonContent = complexMatch[0]
      } else {
        console.error('No valid JSON array found in retry response')
        console.error('Raw response:', responseContent.substring(0, 500))
        console.error('Cleaned content:', jsonContent.substring(0, 500))
        return { 
          suggestions: [], 
          tokenUsage: { inputTokens, outputTokens, cost }
        }
      }
    }
  } else {
    jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
  }
  
  try {
    const suggestions = JSON.parse(jsonContent)
    return {
      suggestions,
      tokenUsage: { inputTokens, outputTokens, cost }
    }
  } catch (error) {
    console.error('Error parsing retry suggestions:', error)
    return { 
      suggestions: [], 
      tokenUsage: { inputTokens, outputTokens, cost }
    }
  }
}

async function checkDomainAvailabilityBatch(domains: string[], namecheapConfig: NamecheapConfig): Promise<{ domain: string; available: boolean; isPremium?: boolean; price?: number }[]> {
  // Check cache first for all domains
  const results: { domain: string; available: boolean; isPremium?: boolean; price?: number }[] = []
  const domainsToCheck: string[] = []
  
  for (const domain of domains) {
    const cached = getCachedDomainAvailability(domain)
    if (cached !== null) {
      console.log(`Cache hit for ${domain}: ${cached}`)
      results.push({ domain, available: cached })
    } else {
      domainsToCheck.push(domain)
    }
  }
  
  if (domainsToCheck.length === 0) {
    return results
  }
  
  console.log(`Checking availability for ${domainsToCheck.length} domains`)
  
  // Check if API is temporarily disabled due to failures
  if (apiDisabledUntil > Date.now()) {
    console.log('API temporarily disabled due to failures, returning false for all')
    for (const domain of domainsToCheck) {
      results.push({ domain, available: false })
    }
    return results
  }
  
  if (!namecheapConfig.apiKey || !namecheapConfig.apiUser) {
    console.log('No Namecheap API configured - returning false for all domains')
    for (const domain of domainsToCheck) {
      results.push({ domain, available: false })
    }
    return results
  }

  try {
    const namecheapResults = await checkDomainsNamecheap(domainsToCheck, namecheapConfig)
    
    // Reset failure count on success
    apiFailureCount = 0
    
    for (const result of namecheapResults) {
      const available = isDomainAvailable(result)
      const price = getDomainPrice(result)
      
      // Cache the result
      setCachedDomainAvailability(result.domain, available)
      
      results.push({
        domain: result.domain,
        available,
        isPremium: result.isPremiumName,
        price
      })
    }
    
    return results
  } catch (error) {
    console.error('Namecheap API error:', error)
    
    // Don't disable API for authentication/configuration errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isConfigError = errorMessage.includes('API Error') || 
                         errorMessage.includes('Invalid') ||
                         errorMessage.includes('authentication') ||
                         errorMessage.includes('API key')
    
    if (!isConfigError) {
      // Only increment failure count for temporary/network errors
      apiFailureCount++
      if (apiFailureCount >= MAX_API_FAILURES) {
        apiDisabledUntil = Date.now() + 5 * 60 * 1000 // Disable for 5 minutes
        console.log('API disabled for 5 minutes due to repeated failures')
      }
    } else {
      console.error('Configuration error detected, not disabling API:', errorMessage)
    }
    
    // Return all domains as unavailable on error
    for (const domain of domainsToCheck) {
      results.push({ domain, available: false })
    }
    
    return results
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIp = getClientIp(request)
    const { allowed, remaining, resetTime } = checkRateLimit(clientIp)
    
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': process.env.RATE_LIMIT_PER_MINUTE || '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString()
          }
        }
      )
    }

    const { query } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }
    
    console.log('User input for domain suggestions:', query)

    // Preprocess very long queries to extract key concepts
    let processedQuery = query
    if (query.length > 500) {
      // Extract key phrases and concepts for better domain suggestions
      const keyPhrases = [
        query.match(/free\s+\w+/gi)?.[0],
        query.match(/before\s+\w+/gi)?.[0],
        query.match(/no\s+\w+/gi)?.[0],
        query.match(/save\s+\w+/gi)?.[0],
        query.match(/eliminate\s+\w+/gi)?.[0],
        query.match(/automat\w+/gi)?.[0],
        query.match(/proof\s+\w+/gi)?.[0]
      ].filter(Boolean).join(' ')
      
      processedQuery = `${query.substring(0, 300)}... KEY CONCEPTS: ${keyPhrases || query.substring(0, 100)}`
      console.log('Processed query (truncated):', processedQuery)
    }
    
    // Check cache first
    const cacheKey = `suggest:${query.toLowerCase()}`
    const cached = cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ suggestions: cached.data })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    
    // Configure Namecheap API
    const namecheapConfig: NamecheapConfig = {
      apiKey: process.env.NAMECHEAP_API_KEY || '',
      apiUser: process.env.NAMECHEAP_API_USER || '',
      username: process.env.NAMECHEAP_USERNAME || '',
      clientIp: process.env.NAMECHEAP_CLIENT_IP || '',
      useSandbox: process.env.NAMECHEAP_USE_SANDBOX === 'true'
    }

    if (!groqApiKey) {
      // Return empty suggestions if no API key to avoid misleading results
      console.log('No GROQ API key configured - returning empty suggestions')
      return NextResponse.json({ suggestions: [] })
    }

    // Initialize Groq client
    const groq = new Groq({ apiKey: groqApiKey })

    // Get active prompt from database
    let currentPrompt: string
    let promptVersionId: string
    try {
      currentPrompt = await getActivePrompt('suggestion')
      promptVersionId = await getActivePromptId('suggestion')
    } catch (error) {
      console.error('Error fetching prompt:', error)
      return NextResponse.json(
        { error: 'Configuration error. Please try again later.' },
        { status: 500 }
      )
    }

    // Get session ID from request headers
    const sessionId = request.headers.get('x-session-id') || getSessionId()

    // Analyze query context using NLP
    let contextAnalysis = null
    try {
      const { getDomainContext } = await import('@/lib/context-detection')
      contextAnalysis = await getDomainContext(processedQuery)
      console.log('Context analysis result:', JSON.stringify(contextAnalysis, null, 2))
    } catch (error) {
      console.error('Error in context analysis:', error)
      // Continue without context analysis if it fails
    }

    // Build context-aware prompt
    let contextSection = ''
    if (contextAnalysis) {
      contextSection = `

CONTEXT ANALYSIS RESULTS:
- Query Type: ${contextAnalysis.type.toUpperCase()} domain
- Primary Category: ${contextAnalysis.primary_category}
- Key Entities/Terms: ${contextAnalysis.entity_keywords.join(', ')}
- Suggested Extensions: ${contextAnalysis.suggested_extensions.join(', ')}
- Context: ${contextAnalysis.type === 'religious' ? 'Religious/spiritual content - focus on trust, community, learning' :
             contextAnalysis.type === 'educational' ? 'Educational content - focus on knowledge, authority, accessibility' :
             contextAnalysis.type === 'business' ? 'Business content - focus on professionalism, efficiency, growth' :
             contextAnalysis.type === 'tech' ? 'Technology content - focus on innovation, scalability, modern appeal' :
             contextAnalysis.type === 'creative' ? 'Creative content - focus on inspiration, expression, artistic appeal' :
             contextAnalysis.type === 'health' ? 'Health/wellness content - focus on care, trust, healing' :
             'General content - balanced approach'}

CRITICAL REQUIREMENTS FOR THIS QUERY:
1. MUST incorporate these key terms in domain suggestions: ${contextAnalysis.entity_keywords.slice(0, 3).join(', ')}
2. PRIORITIZE these extensions: ${contextAnalysis.suggested_extensions.slice(0, 3).join(', ')}
3. Use ${contextAnalysis.type}-appropriate naming conventions
4. Ensure domains reflect the ${contextAnalysis.type} context and audience expectations`
    }

    // Append context information and output format to the prompt
    const fullPrompt = currentPrompt + contextSection + `

OUTPUT FORMAT:
Generate exactly 10 domains as a JSON array with this structure:
[
  {"domain":"example.com","extension":".com","reason":"Brief explanation"},
  {"domain":"another.io","extension":".io","reason":"Why this domain works"}
]

IMPORTANT: Output ONLY the JSON array. Start with [ and end with ].`

    // Track total token usage and cost
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalGroqCost = 0
    let namecheapRequestCount = 0

    // Generate domain suggestions using AI
    let completion
    const startTime = Date.now()
    const model = 'gemma2-9b-it'
    const temperature = 0.3
    
    try {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: fullPrompt
          },
          {
            role: 'user',
            content: query.length > 500 ? 
              `Business description: ${processedQuery}` : 
              `${processedQuery}\n\nREMEMBER: Follow ANY specific domain requirements mentioned above exactly as requested!`
          }
        ],
        model,
        temperature,
        max_tokens: 2000
      })
      
      // Extract token usage
      const tokenUsage = extractGroqTokenUsage(completion)
      if (tokenUsage) {
        totalInputTokens += tokenUsage.inputTokens
        totalOutputTokens += tokenUsage.outputTokens
      } else {
        // Estimate if not provided
        const promptTokens = estimateTokenCount(fullPrompt + processedQuery)
        const completionTokens = estimateTokenCount(completion.choices[0]?.message?.content || '')
        totalInputTokens += promptTokens
        totalOutputTokens += completionTokens
      }
      
      const responseTime = Date.now() - startTime
      const cost = calculateGroqCost(totalInputTokens + totalOutputTokens)
      totalGroqCost += cost
      
      // Log initial API usage (will log after search is created)
      
    } catch (groqError) {
      const error = groqError as { status?: number; message?: string }
      console.error('GROQ API error:', error.status, error.message)
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Invalid GROQ API key. Please check your environment configuration.' },
          { status: 500 }
        )
      }
      throw groqError
    }

    const responseContent = completion.choices[0]?.message?.content || '[]'
    console.log('AI Response for domain suggestions:', responseContent)
    
    // Extract JSON from response (handle <think> tags and other markup)
    let jsonContent = responseContent
    
    // First, remove <think> tags if present
    const thinkEndIndex = responseContent.indexOf('</think>')
    if (thinkEndIndex !== -1) {
      jsonContent = responseContent.substring(thinkEndIndex + 8).trim()
    } else if (responseContent.includes('<think>')) {
      // If there's a <think> tag but no closing tag, skip everything after <think>
      const thinkStartIndex = responseContent.lastIndexOf('<think>')
      if (thinkStartIndex > 0) {
        jsonContent = responseContent.substring(0, thinkStartIndex).trim()
      }
    }
    
    // Handle code blocks (```json or ```)
    jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Try to extract JSON array - first attempt: look for array brackets
    const jsonStart = jsonContent.indexOf('[')
    const jsonEnd = jsonContent.lastIndexOf(']')
    
    // If no array found, try to find JSON in the content using regex
    if (jsonStart === -1 || jsonEnd === -1) {
      // Try to match JSON array pattern
      const jsonMatch = jsonContent.match(/\[\s*\{[\s\S]*?\}\s*\]/)
      if (jsonMatch) {
        jsonContent = jsonMatch[0]
      } else {
        console.error('No valid JSON array found in response')
        console.error('Cleaned content:', jsonContent)
        throw new Error('Invalid response format from AI')
      }
    } else {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
    }
    
    // Validate JSON structure by checking bracket balance
    const openBrackets = (jsonContent.match(/[\[{]/g) || []).length
    const closeBrackets = (jsonContent.match(/[\]}]/g) || []).length
    
    if (openBrackets !== closeBrackets) {
      console.error('Incomplete JSON structure detected')
      throw new Error('AI response contains incomplete JSON')
    }
    
    try {
      const suggestedDomains = JSON.parse(jsonContent)
      console.log('Parsed domains from AI:', suggestedDomains.length)
      
      const allSuggestedDomains: string[] = []
      const availableDomains: SuggestionResult[] = []
      const unavailableDomains: Array<{ domain: string; extension: string; reason?: string }> = []
      let retryCount = 0
      const maxRetries = 5 // Increased retry attempts for better availability
      const targetAvailableDomains = 5 // Match domain mode target
      
      // Keep trying until we have enough available domains or hit max retries
      while (availableDomains.length < targetAvailableDomains && retryCount < maxRetries) {
        console.log(`Attempt ${retryCount + 1}: Checking domains...`)
        
        // Get current batch of domains to check
        let currentBatch
        if (retryCount === 0) {
          currentBatch = suggestedDomains
        } else {
          const retryResult = await generateMoreSuggestions(processedQuery, allSuggestedDomains, currentPrompt, groqApiKey, retryCount)
          currentBatch = retryResult.suggestions
          
          // Track token usage for retries
          totalInputTokens += retryResult.tokenUsage.inputTokens
          totalOutputTokens += retryResult.tokenUsage.outputTokens
          totalGroqCost += retryResult.tokenUsage.cost
        }
        
        console.log(`${retryCount === 0 ? 'Checking' : `Retry ${retryCount}:`} ${currentBatch.length} domains in parallel...`)
        
        // Prepare domains with extensions for batch checking
        const domainsToCheck = currentBatch.map((suggestion: { domain: string; extension?: string; reason?: string }) => {
          let fullDomain = suggestion.domain
          
          // If no extension provided or we're on a retry, assign based on retry count
          if (!fullDomain.includes('.')) {
            const extensions = retryCount === 0 ? ['.com'] :
                             retryCount === 1 ? ['.io', '.co', '.app'] :
                             ['.net', '.org', '.ai']
            
            // Use suggested extension if valid for this retry, otherwise pick randomly
            const suggestedExt = suggestion.extension || '.com'
            const useExtension = extensions.includes(suggestedExt) ? 
              suggestedExt : 
              extensions[Math.floor(Math.random() * extensions.length)]
            
            fullDomain = fullDomain + useExtension
          } else if (suggestion.extension && !fullDomain.includes('.')) {
            // Handle case where extension is provided separately
            const extensionWithoutDot = suggestion.extension.substring(1)
            if (fullDomain.endsWith(extensionWithoutDot)) {
              fullDomain = fullDomain.slice(0, -extensionWithoutDot.length) + suggestion.extension
            } else {
              fullDomain = fullDomain + suggestion.extension
            }
          }
          
          return {
            ...suggestion,
            fullDomain: formatDomainName(fullDomain)
          }
        })
        
        // Check all domains in batch using Namecheap
        const batchResults = await checkDomainAvailabilityBatch(
          domainsToCheck.map((d: { fullDomain: string }) => d.fullDomain), 
          namecheapConfig
        )
        namecheapRequestCount += batchResults.length // Track API calls
        
        // Map batch results back to suggestions
        const suggestionsWithAvailability = domainsToCheck.map((domainData: { fullDomain: string; reason?: string; domain: string; extension?: string }) => {
          const batchResult = batchResults.find(r => r.domain === domainData.fullDomain)
          if (!batchResult) return null
          
          const extension = domainData.fullDomain.match(/(\.[^.]+)$/)?.[0] || '.com'
          
          if (batchResult.available) {
            console.log(`✓ Domain ${domainData.fullDomain} is AVAILABLE`)
            const result: SuggestionResult & { status: 'available' } = {
              domain: domainData.fullDomain,
              available: true,
              extension,
              reason: domainData.reason,
              status: 'available' as const
            }
            
            // Add premium info if applicable
            if (batchResult.isPremium) {
              result.isPremium = true
              result.price = batchResult.price
            }
            
            return result
          } else {
            console.log(`✗ Domain ${domainData.fullDomain} is TAKEN`)
            // Track unavailable domains
            unavailableDomains.push({
              domain: domainData.fullDomain,
              extension,
              reason: domainData.reason
            })
            return {
              domain: domainData.fullDomain,
              available: false,
              extension,
              reason: domainData.reason,
              status: 'unavailable' as const
            }
          }
        }).filter((r: unknown) => r !== null)
        
        // Separate available and unavailable results
        const results = suggestionsWithAvailability.filter((r: unknown) => r !== null) as Array<SuggestionResult & { status: 'available' | 'unavailable' }>
        const newAvailableResults = results.filter((r: SuggestionResult & { status: 'available' | 'unavailable' }) => r.status === 'available')
        availableDomains.push(...newAvailableResults)
        
        // Add all checked domains to our tracking list
        allSuggestedDomains.push(...currentBatch.map((d: { domain: string }) => d.domain))
        
        console.log(`Found ${newAvailableResults.length} available domains (total: ${availableDomains.length})`)
        console.log(`Total unavailable domains checked: ${unavailableDomains.length}`)
        
        retryCount++
        
        // If we found some domains but not enough, continue; if none found, try again
        if (availableDomains.length >= targetAvailableDomains) {
          break
        }
        
        // Add a small delay between retries to avoid rate limits
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        }
      }
      
      // Remove duplicates based on domain name
      const uniqueDomains = availableDomains.reduce((acc, current) => {
        const exists = acc.find(item => item.domain === current.domain)
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [] as SuggestionResult[])

      // Limit to best 10 available domains
      const finalDomains = uniqueDomains.slice(0, 10)

      // Track the search and suggestions
      let searchId: string | undefined
      try {
        searchId = await trackDomainSearch(sessionId, query, 'suggestion', promptVersionId)
        
        // Update search with cost information
        await updateSearchCosts(searchId, {
          llmModel: model,
          llmTemperature: temperature,
          totalTokens: totalInputTokens + totalOutputTokens,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          groqCost: totalGroqCost,
          domainrRequests: namecheapRequestCount,
          totalCost: totalGroqCost // For now, only Groq costs (Domainr is free tier)
        })
        
        // Log API usage details
        await logApiUsage({
          searchId,
          provider: 'groq',
          endpoint: '/chat/completions',
          model,
          temperature,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          cost: totalGroqCost
        })
        
        // Track all suggestions with their positions
        await trackDomainSuggestions(
          searchId,
          finalDomains.map((domain, index) => ({
            domain: domain.domain,
            extension: domain.extension || '.com',
            available: domain.available,
            position: index + 1
          }))
        )
      } catch (trackingError) {
        console.error('Error tracking analytics:', trackingError)
        // Don't fail the request if tracking fails
      }

      // Cache the results
      cache.set(cacheKey, { data: finalDomains, timestamp: Date.now() })

      return NextResponse.json({ 
        suggestions: finalDomains,
        searchId: searchId // Include the search ID for score polling
      })
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      console.error('Response content:', responseContent)
      console.error('Extracted JSON content:', jsonContent)
      
      // Try one more time with a simpler extraction
      try {
        // Look for anything that looks like a domain suggestion
        const fallbackMatch = responseContent.match(/\{[^}]*"domain"[^}]*\}/g)
        if (fallbackMatch && fallbackMatch.length > 0) {
          const fallbackDomains = fallbackMatch.map(match => {
            try {
              return JSON.parse(match)
            } catch {
              return null
            }
          }).filter(d => d !== null)
          
          if (fallbackDomains.length > 0) {
            console.log('Recovered domains using fallback method:', fallbackDomains.length)
            // Continue with fallback domains
            const allSuggestedDomains: string[] = []
            const availableDomains: SuggestionResult[] = []
            // ... rest of the logic would continue here
          }
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError)
      }
      
      return NextResponse.json(
        { error: 'Failed to parse domain suggestions. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Domain suggestion error:', error)
    
    // Check if it's a specific error message
    if (error instanceof Error) {
      if (error.message.includes('Too many requests')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      } else if (error.message.includes('API is unavailable')) {
        return NextResponse.json(
          { error: 'Domain availability service is currently unavailable. Please try again later.' },
          { status: 503 }
        )
      } else if (error.message.includes('Invalid') && error.message.includes('API')) {
        return NextResponse.json(
          { error: 'Invalid domain checking API key. Please check your Namecheap API configuration.' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate domain suggestions. Please try again later.' },
      { status: 500 }
    )
  }
}