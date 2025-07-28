import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import axios, { AxiosError } from 'axios'
import { formatDomainName } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'
import { getActivePrompt, getActivePromptId } from '@/lib/prompts'
import { getSessionId, trackDomainSearch, trackDomainSuggestions } from '@/lib/analytics'

// Simple in-memory cache
interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
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
): Promise<Array<{ domain: string; extension?: string; reason?: string }>> {
  console.log(`Generating more suggestions for retry ${retryCount}. Original query:`, query)
  
  if (!groqApiKey) {
    // Return empty array if no API key
    return []
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

  const modifiedPrompt = retryPretext + basePrompt + extensionGuidance

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
    temperature: 0.4, // Slightly higher for more variety on retries
    max_tokens: 2000
  })

  const responseContent = completion.choices[0]?.message?.content || '[]'
  console.log('AI Response for retry suggestions:', responseContent)
  
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
        return []
      }
    }
  } else {
    jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
  }
  
  try {
    return JSON.parse(jsonContent)
  } catch (error) {
    console.error('Error parsing retry suggestions:', error)
    return []
  }
}

async function checkDomainAvailability(domain: string, apiKey?: string): Promise<boolean> {
  // Check cache first
  const cached = getCachedDomainAvailability(domain)
  if (cached !== null) {
    console.log(`Cache hit for ${domain}: ${cached}`)
    return cached
  }
  
  console.log(`Checking availability for: ${domain}, API key exists: ${!!apiKey}`)
  
  // Check if API is temporarily disabled due to failures
  if (apiDisabledUntil > Date.now()) {
    console.log('API temporarily disabled due to failures, using mock data')
    apiKey = undefined
  }
  
  if (!apiKey) {
    // Without API key, we can't verify availability
    // Return false to be safe and avoid showing taken domains as available
    console.log(`No Domainr API key for ${domain}: cannot verify availability`)
    return false
  }
  
  // Throttle API requests
  await throttleRequest()

  try {
    const response = await axios.get(`https://domainr.p.rapidapi.com/v2/status`, {
      params: { domain },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'domainr.p.rapidapi.com'
      },
      timeout: 5000 // 5 second timeout
    })
    
    console.log(`API response for ${domain}:`, JSON.stringify(response.data, null, 2))
    
    // Check if we have status data
    if (!response.data.status || !Array.isArray(response.data.status)) {
      console.log(`No status array in response for ${domain}`)
      return false
    }
    
    // Check all status entries (domain might be split into parts)
    const statuses = response.data.status
    let isAvailable = false
    
    // Helper function to check if a status indicates availability
    const isStatusAvailable = (status: string) => {
      const statusLower = status?.toLowerCase() || ''
      
      // Check for statuses that indicate the domain is NOT available
      const unavailableStatuses = [
        'active', 'parked', 'marketed', 'claimed', 'reserved', 'dpml', 'premium',
        'expiring', 'deleting', 'priced', 'transferable', 'pending',
        'disallowed', 'invalid', 'suffix', 'zone', 'tld'
      ]
      
      // If status contains any unavailable keyword, it's not available
      // We need to be careful with substring matching - use word boundaries
      for (const unavailableStatus of unavailableStatuses) {
        // Create a regex with word boundaries to avoid false matches
        // For example, "marketed" should not match in "undelegated"
        const regex = new RegExp(`\\b${unavailableStatus}\\b`)
        if (regex.test(statusLower)) {
          return false
        }
      }
      
      // Check for available statuses
      // "inactive" or "undelegated" indicate availability
      if (statusLower.includes('inactive') || statusLower.includes('undelegated')) {
        return true
      }
      
      // Special case: "unknown" status means error/misconfiguration, not available
      if (statusLower.includes('unknown')) {
        return false
      }
      
      // Log truly unexpected statuses
      console.log(`Unexpected domain status: "${status}" - marking as not available`)
      return false
    }
    
    // A domain is available if ALL parts are available
    const allPartsAvailable = statuses.every((s: { domain: string; status: string }) => isStatusAvailable(s.status))
    
    // Also check if the exact domain has an available status
    const exactDomainStatus = statuses.find((s: { domain: string; status: string }) => s.domain === domain)
    if (exactDomainStatus) {
      isAvailable = isStatusAvailable(exactDomainStatus.status)
    } else {
      isAvailable = allPartsAvailable
    }
    
    console.log(`API result for ${domain}: ${statuses.map((s: { domain: string; status: string }) => `${s.domain}:${s.status}`).join(', ')} -> ${isAvailable}`)
    
    // Reset failure count on success
    apiFailureCount = 0
    
    // Cache the result
    setCachedDomainAvailability(domain, isAvailable)
    
    return isAvailable
  } catch (error) {
    const axiosError = error as AxiosError<{ message: string; error?: { message?: string } }>
    console.error('Domainr API error:', axiosError.response?.status, axiosError.response?.data || axiosError.message)
    
    // Check for 401 unauthorized specifically
    if (axiosError.response?.status === 401) {
      console.error('Domainr API key is invalid')
      // Don't increment failure count for auth errors
      throw new Error('Invalid Domainr API key')
    }
    
    // Increment failure count and disable API if too many failures
    apiFailureCount++
    if (apiFailureCount >= MAX_API_FAILURES) {
      apiDisabledUntil = Date.now() + 5 * 60 * 1000 // Disable for 5 minutes
      console.log('API disabled for 5 minutes due to repeated failures')
    }
    
    // Throw the error to be handled by the caller
    throw axiosError
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
    const domainrApiKey = process.env.DOMAINR_RAPIDAPI_KEY

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


    // Generate domain suggestions using AI
    let completion
    try {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: currentPrompt
          },
          {
            role: 'user',
            content: query.length > 500 ? 
              `Business description: ${processedQuery}` : 
              `${processedQuery}\n\nREMEMBER: Follow ANY specific domain requirements mentioned above exactly as requested!`
          }
        ],
        model: 'gemma2-9b-it',
        temperature: 0.3,
        max_tokens: 2000
      })
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
        const currentBatch = retryCount === 0 ? suggestedDomains : 
          await generateMoreSuggestions(processedQuery, allSuggestedDomains, currentPrompt, groqApiKey, retryCount)
        
        console.log(`${retryCount === 0 ? 'Checking' : `Retry ${retryCount}:`} ${currentBatch.length} domains in parallel...`)
        
        // Process domains in parallel for better performance
        const suggestionsWithAvailability = await Promise.all(
          currentBatch.map(async (suggestion: { domain: string; extension?: string; reason?: string }) => {
            // Smart extension rotation based on retry count
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
            
            const cleanDomain = formatDomainName(fullDomain)
            
            try {
              const available = await checkDomainAvailability(cleanDomain, domainrApiKey)
              
              if (available) {
                console.log(`✓ Domain ${cleanDomain} is AVAILABLE`)
                return {
                  domain: cleanDomain,
                  available,
                  extension: suggestion.extension || '.com',
                  reason: suggestion.reason,
                  status: 'available' as const
                }
              } else {
                console.log(`✗ Domain ${cleanDomain} is TAKEN`)
                // Track unavailable domains
                unavailableDomains.push({
                  domain: cleanDomain,
                  extension: suggestion.extension || '.com',
                  reason: suggestion.reason
                })
                return {
                  domain: cleanDomain,
                  available: false,
                  extension: suggestion.extension || '.com',
                  reason: suggestion.reason,
                  status: 'unavailable' as const
                }
              }
            } catch (error) {
              // If domain check fails, return null
              const err = error as Error
              console.log(`✗ Domain ${cleanDomain} check failed:`, err.message)
              
              // If it's an API key error, throw it to stop processing
              if (err.message === 'Invalid Domainr API key') {
                throw err
              }
              return null
            }
          })
        )
        
        // Separate available and unavailable results
        const results = suggestionsWithAvailability.filter(r => r !== null) as Array<SuggestionResult & { status: 'available' | 'unavailable' }>
        const newAvailableResults = results.filter(r => r.status === 'available')
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

      // Evaluate the suggestions if evaluation is enabled
      if (process.env.ENABLE_DOMAIN_EVALUATION === 'true') {
        try {
          // Prepare all attempted domains (including from all retries)
          const allAttempted = suggestedDomains.concat(
            ...Array.from({ length: retryCount }, (_, i) => 
              allSuggestedDomains.slice(suggestedDomains.length + i * 10, suggestedDomains.length + (i + 1) * 10)
            ).flat()
          )

          const evaluationPayload = {
            query: processedQuery,
            currentPrompt: currentPrompt,
            results: {
              suggested: finalDomains,
              attempted: allAttempted,
              unavailable: unavailableDomains
            }
          }

          // Call evaluation endpoint
          const evalResponse = await fetch(`${request.nextUrl.origin}/api/domains/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evaluationPayload)
          })

          if (!evalResponse.ok) {
            console.error('Evaluation failed:', await evalResponse.text())
          }
          // Evaluation results are logged in the evaluate endpoint
        } catch (evalError) {
          console.error('Error during domain evaluation:', evalError)
          // Don't fail the request if evaluation fails
        }
      }

      // Track the search and suggestions
      try {
        const searchId = await trackDomainSearch(sessionId, query, 'suggestion', promptVersionId)
        
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

      return NextResponse.json({ suggestions: finalDomains })
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
      } else if (error.message === 'Invalid Domainr API key') {
        return NextResponse.json(
          { error: 'Invalid domain checking API key. Please check your Domainr API configuration.' },
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