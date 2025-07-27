import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import axios, { AxiosError } from 'axios'
import { formatDomainName } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'

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
  groqApiKey?: string
): Promise<Array<{ domain: string; extension?: string; reason?: string }>> {
  if (!groqApiKey) {
    // Return empty array if no API key
    return []
  }

  const groq = new Groq({ apiKey: groqApiKey })
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `Generate 10 domain name suggestions. Output ONLY a JSON array starting with [ and ending with ].

IMPORTANT: For long business descriptions, first identify:
1. The UNIQUE value proposition (what makes them different)
2. The main benefit to customers
3. Key differentiators from competitors
4. Emotional hooks or promises

Then create domains that capture THESE SPECIFIC ASPECTS, not generic industry terms.

Examples of good vs bad:
- Bad: taskautomation.com (generic)
- Good: freetaskfix.com (captures "free" + solving problems)
- Bad: efficienza.app (generic efficiency)  
- Good: proofirst.io (unique "proof before payment" concept)

JSON format:
[{"domain":"example.com","extension":".com","reason":"Brief reason"}]

Rules:
- Domains under 15 characters
- Use .com, .io, .co, .ai, .app, .dev
- Focus on UNIQUE aspects, not generic terms
- Mix benefit-driven names with creative abstractions
- NO THINKING, NO TAGS, NO EXPLANATIONS - ONLY JSON

IMPORTANT: Avoid these already suggested domains: ${existingDomains.join(', ')}
Create completely different alternatives.`
      },
      {
        role: 'user',
        content: query
      }
    ],
    model: 'llama-3.1-8b-instant',
    temperature: 0.4, // Slightly higher for more variety
    max_tokens: 2000
  })

  const responseContent = completion.choices[0]?.message?.content || '[]'
  
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
  
  const jsonStart = jsonContent.indexOf('[')
  const jsonEnd = jsonContent.lastIndexOf(']')
  
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error('No valid JSON array found in retry response')
    return []
  }
  
  jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
  
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

    // Generate domain suggestions using AI
    let completion
    try {
      completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Generate 10 domain name suggestions. Output ONLY a JSON array starting with [ and ending with ].

IMPORTANT: For long business descriptions, first identify:
1. The UNIQUE value proposition (what makes them different)
2. The main benefit to customers
3. Key differentiators from competitors
4. Emotional hooks or promises

Then create domains that capture THESE SPECIFIC ASPECTS, not generic industry terms.

Examples of good vs bad:
- Bad: taskautomation.com (generic)
- Good: freetaskfix.com (captures "free" + solving problems)
- Bad: efficienza.app (generic efficiency)  
- Good: proofirst.io (unique "proof before payment" concept)

JSON format:
[{"domain":"example.com","extension":".com","reason":"Brief reason"}]

Rules:
- Domains under 15 characters
- Use .com, .io, .co, .ai, .app, .dev
- Focus on UNIQUE aspects, not generic terms
- Mix benefit-driven names with creative abstractions
- NO THINKING, NO TAGS, NO EXPLANATIONS - ONLY JSON`
        },
        {
          role: 'user',
          content: query.length > 500 ? 
            `Business description: ${processedQuery}\n\nIMPORTANT: Extract and focus on their UNIQUE selling points and differentiators. Create domains that capture their SPECIFIC value proposition, not generic industry terms.` : 
            processedQuery
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 2000
    })
    } catch (groqError: any) {
      console.error('GROQ API error:', groqError.status, groqError.message)
      if (groqError.status === 401) {
        return NextResponse.json(
          { error: 'Invalid GROQ API key. Please check your environment configuration.' },
          { status: 500 }
        )
      }
      throw groqError
    }

    const responseContent = completion.choices[0]?.message?.content || '[]'
    
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
    
    // Then extract the JSON array
    const jsonStart = jsonContent.indexOf('[')
    const jsonEnd = jsonContent.lastIndexOf(']')
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error('No valid JSON array found in response')
      throw new Error('Invalid response format from AI')
    }
    
    jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
    
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
      let availableDomains: SuggestionResult[] = []
      let retryCount = 0
      const maxRetries = 1 // Reduced from 3 to avoid rate limits
      const targetAvailableDomains = 3 // Reduced from 5 to minimize API calls
      
      // Keep trying until we have enough available domains or hit max retries
      while (availableDomains.length < targetAvailableDomains && retryCount < maxRetries) {
        console.log(`Attempt ${retryCount + 1}: Checking domains...`)
        
        // Get current batch of domains to check
        const currentBatch = retryCount === 0 ? suggestedDomains : 
          await generateMoreSuggestions(processedQuery, allSuggestedDomains, groqApiKey)
        
        // Check availability for each suggested domain (reduced batch size)
        const batchSize = 5 // Reduced from 10
        const suggestionsToCheck = currentBatch.slice(0, batchSize)
        
        // Process domains sequentially with delay to avoid rate limits
        const suggestionsWithAvailability = []
        for (const suggestion of suggestionsToCheck) {
          // Ensure domain includes extension if not already present
          let fullDomain = suggestion.domain
          if (!fullDomain.includes('.') && suggestion.extension) {
            // Remove extension from domain if it's been incorrectly appended without dot
            const extensionWithoutDot = suggestion.extension.substring(1)
            if (fullDomain.endsWith(extensionWithoutDot)) {
              fullDomain = fullDomain.slice(0, -extensionWithoutDot.length) + suggestion.extension
            } else {
              fullDomain = fullDomain + suggestion.extension
            }
          }
          
          const cleanDomain = formatDomainName(fullDomain)
          console.log(`Checking domain: original="${suggestion.domain}", extension="${suggestion.extension}", full="${fullDomain}", clean="${cleanDomain}"`)
          
          try {
            const available = await checkDomainAvailability(cleanDomain, domainrApiKey)
            
            // Log the result
            if (available) {
              console.log(`✓ Domain ${cleanDomain} is AVAILABLE`)
            } else {
              console.log(`✗ Domain ${cleanDomain} is TAKEN`)
            }
            
            suggestionsWithAvailability.push({
              domain: cleanDomain,
              available,
              extension: suggestion.extension || '.com',
              reason: suggestion.reason
            })
          } catch (error: any) {
            // If domain check fails, don't include it in results
            console.log(`✗ Domain ${cleanDomain} check failed:`, error.message)
            
            // If it's an API key error, throw it to stop processing
            if (error.message === 'Invalid Domainr API key') {
              throw error
            }
          }
        }
        
        // Filter out failed checks
        const validSuggestions = suggestionsWithAvailability.filter(s => s !== null) as SuggestionResult[]
        
        // If all domain checks failed due to API errors, throw error
        if (validSuggestions.length === 0 && suggestionsWithAvailability.length > 0) {
          const error = new Error('Domain availability API is unavailable')
          if (apiDisabledUntil > Date.now()) {
            throw new Error('Too many requests. Please try again later.')
          }
          throw error
        }
        
        // Add all suggested domains to our tracking list
        allSuggestedDomains.push(...validSuggestions.map(d => d.domain))
        
        // Filter available domains and add to our results
        const newAvailableDomains = validSuggestions.filter(d => d.available)
        availableDomains.push(...newAvailableDomains)
        
        console.log(`Found ${newAvailableDomains.length} available domains in this batch`)
        console.log(`Total available domains so far: ${availableDomains.length}`)
        
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
      
      // Limit to best 10 available domains
      availableDomains = availableDomains.slice(0, 10)

      // Cache the results
      cache.set(cacheKey, { data: availableDomains, timestamp: Date.now() })

      return NextResponse.json({ suggestions: availableDomains })
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      console.error('Response content:', responseContent)
      return NextResponse.json(
        { error: 'Failed to parse domain suggestions from AI response' },
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