import { NextRequest, NextResponse } from 'next/server'
import axios, { AxiosError } from 'axios'
import Groq from 'groq-sdk'
import { formatDomainName, POPULAR_EXTENSIONS, parseDomainInput } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'
import { getActivePrompt, getActivePromptId } from '@/lib/prompts'
import { getSessionId, trackDomainSearch, trackDomainSuggestions } from '@/lib/analytics'

// Simple in-memory cache
interface CacheEntry {
  data: DomainResult[]
  timestamp: number
}

interface DomainResult {
  domain: string
  available: boolean
  extension: string
  requested?: boolean // Indicates if this was the specific domain requested
  suggested?: boolean // Indicates if this is an AI-suggested variation
  score?: number // Quality score for ranking
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Score a domain based on various factors
function scoreDomain(domain: string, extension: string, isExactMatch: boolean): number {
  let score = 0
  
  // Extension value (out of 40 points)
  const extensionScores: Record<string, number> = {
    '.com': 40,
    '.net': 25,
    '.org': 25,
    '.io': 30,
    '.co': 28,
    '.ai': 35,
    '.app': 20,
    '.dev': 20,
    '.tech': 15,
    '.online': 10,
    '.store': 15,
    '.site': 10
  }
  score += extensionScores[extension] || 5
  
  // Length bonus (out of 30 points) - shorter is better
  const nameLength = domain.replace(extension, '').length
  if (nameLength <= 5) score += 30
  else if (nameLength <= 7) score += 25
  else if (nameLength <= 10) score += 20
  else if (nameLength <= 12) score += 15
  else if (nameLength <= 15) score += 10
  else score += 5
  
  // Exact match bonus (out of 20 points)
  if (isExactMatch) score += 20
  
  // Memorability (out of 10 points)
  const name = domain.replace(extension, '')
  // No numbers
  if (!/\d/.test(name)) score += 3
  // No hyphens
  if (!name.includes('-')) score += 3
  // Easy to spell (no repeated letters)
  if (!/(.)\1{2,}/.test(name)) score += 2
  // Starts with common prefix
  if (/^(get|my|the|try)/.test(name)) score += 2
  
  return score
}

// Generate domain variations using AI
async function generateDomainVariations(baseDomain: string, groqApiKey: string, excludeDomains: string[] = [], domainPrompt?: string): Promise<string[]> {
  try {
    const groq = new Groq({ apiKey: groqApiKey })
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: domainPrompt || `You are a domain name expert. Generate creative domain variations for a single word by adding prefixes or suffixes.

RULES:
1. Generate exactly 15 variations
2. Use a mix of prefixes (get, try, use, my, the, go, buy, find, best, shop, super, easy, quick, smart, daily, new, big, top, all) and suffixes (hq, app, hub, lab, pro, now, zone, base, central, store, world, market, place, online, direct, plus, max, one)
3. Consider the word's context and meaning
4. Keep variations short and brandable
5. Output ONLY a JSON array of strings
6. Be creative - if many domains are taken, try more unique combinations

GRAMMAR RULES:
- For PLURAL words ending in 's' (bags, shoes, cars): 
  * Use prefixes WITHOUT 'a': "getbags", "buybags" (NOT "getabags")
  * Or add suffixes: "bagsapp", "bagshub", "bagsstore"
- For SINGULAR words: Normal rules apply

Examples:
- Input: "mouse" → ["getmouse", "trymouse", "mousehq", "mouseapp", "gomouse", "mouselab", "mousehub", "bestmouse", "mousecentral", "usemouse"]
- Input: "bags" → ["getbags", "mybags", "bagsapp", "bagshub", "buybags", "bagsstore", "bagspro", "findbags", "bestbags", "bagscentral"]
- Input: "book" → ["getbook", "mybook", "bookapp", "bookhub", "trybook", "booklab", "bookzone", "booknow", "findbook", "bookcentral"]

Output format: ["variation1", "variation2", ...]`
        },
        {
          role: 'user',
          content: excludeDomains.length > 0 
            ? `Generate domain variations for: "${baseDomain}"\n\nIMPORTANT: Do NOT suggest these domains as they've already been tried: ${excludeDomains.join(', ')}`
            : `Generate domain variations for: "${baseDomain}"`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 500
    })

    const responseContent = completion.choices[0]?.message?.content || '[]'
    
    // Extract JSON array
    const jsonMatch = responseContent.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in AI response')
      return []
    }

    try {
      const variations = JSON.parse(jsonMatch[0])
      // Filter and clean variations
      return variations
        .filter((v: unknown) => typeof v === 'string' && v.length > 0)
        .map((v: string) => formatDomainName(v))
        .slice(0, 15) // Ensure max 15 variations
    } catch (error) {
      console.error('Error parsing AI variations:', error)
      return []
    }
  } catch (error) {
    console.error('Error generating domain variations:', error)
    // Fallback to simple variations
    const prefixes = ['get', 'try', 'use', 'my', 'the', 'go']
    const suffixes = ['hq', 'app', 'hub', 'lab', 'pro', 'now']
    
    const fallbackVariations: string[] = []
    // Add prefix variations
    prefixes.forEach(prefix => {
      fallbackVariations.push(formatDomainName(prefix + baseDomain))
    })
    // Add suffix variations
    suffixes.forEach(suffix => {
      fallbackVariations.push(formatDomainName(baseDomain + suffix))
    })
    
    return fallbackVariations
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

    const { domain } = await request.json()
    
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Domain parameter is required' },
        { status: 400 }
      )
    }

    // Parse the domain to check if it has an extension
    const { baseDomain, extension, hasExtension } = parseDomainInput(domain)
    const cleanBaseDomain = formatDomainName(baseDomain)
    
    // Check cache first
    const cacheKey = `domain:${domain.toLowerCase()}`
    const cached = cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ results: cached.data })
    }

    // Check if API key is configured
    const apiKey = process.env.DOMAINR_RAPIDAPI_KEY
    if (!apiKey) {
      // Return mock data if no API key
      // Determine which extensions to check
      let extensionsToCheck = POPULAR_EXTENSIONS
      
      if (hasExtension && extension) {
        extensionsToCheck = [extension, ...POPULAR_EXTENSIONS.filter(ext => ext !== extension)]
      }
      
      const mockResults = extensionsToCheck.map(ext => ({
        domain: cleanBaseDomain + ext,
        available: Math.random() > 0.7,
        extension: ext,
        requested: hasExtension && ext === extension
      }))
      
      // Ensure .com is always first and show as taken for common words
      mockResults[0].available = cleanBaseDomain.length > 8
      
      cache.set(cacheKey, { data: mockResults, timestamp: Date.now() })
      return NextResponse.json({ results: mockResults })
    }

    // Make API calls for each domain
    try {

      // Helper function to check if a status indicates availability
      const isAvailable = (status: string) => {
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

      // Determine which extensions to check
      let extensionsToCheck = POPULAR_EXTENSIONS
      
      // If user provided a specific extension, check that first
      if (hasExtension && extension) {
        // Put the requested extension first, then other popular ones
        extensionsToCheck = [extension, ...POPULAR_EXTENSIONS.filter(ext => ext !== extension)]
      }
      
      // Get session ID from request headers
      const sessionId = request.headers.get('x-session-id') || getSessionId()

      // Fetch active prompt from database
      let domainPrompt: string | undefined
      let promptVersionId: string | undefined
      const groqApiKey = process.env.GROQ_API_KEY
      
      if (groqApiKey) {
        try {
          domainPrompt = await getActivePrompt('domain')
          promptVersionId = await getActivePromptId('domain')
        } catch (error) {
          console.error('Error fetching domain prompt:', error)
          // Continue without database prompt, use hardcoded fallback
        }
      }

      // Start AI generation immediately in parallel (don't wait for exact match results)
      const aiVariationsPromise = groqApiKey 
        ? generateDomainVariations(cleanBaseDomain, groqApiKey, [], domainPrompt)
          .then(variations => {
            console.log(`Generated ${variations.length} AI variations for "${cleanBaseDomain}"`)
            return variations
          })
          .catch(err => {
            console.error('Error generating AI variations:', err)
            return []
          })
        : Promise.resolve([])

      // Check exact matches in parallel
      const exactMatchPromise = Promise.all(extensionsToCheck.map(async ext => {
        const fullDomain = cleanBaseDomain + ext
        
        // Check cache first
        const cached = getCachedDomainAvailability(fullDomain)
        if (cached !== null) {
          return {
            domain: fullDomain,
            available: cached,
            extension: ext
          }
        }
        
        // Throttle requests
        await throttleRequest()
        
        try {
          // Make API call for this specific domain
          const domainResponse = await axios.get(`https://domainr.p.rapidapi.com/v2/status`, {
            params: {
              domain: fullDomain
            },
            headers: {
              'X-RapidAPI-Key': apiKey,
              'X-RapidAPI-Host': 'domainr.p.rapidapi.com'
            },
            timeout: 5000
          })
          
          const domainStatus = domainResponse.data.status?.find((s: { domain: string; status: string }) => s.domain === fullDomain)
          const available = domainStatus ? isAvailable(domainStatus.status) : false
          
          // Cache the result
          setCachedDomainAvailability(fullDomain, available)
          
          const result = {
            domain: fullDomain,
            available,
            extension: ext,
            requested: hasExtension && ext === extension
          }
          
          // Add score if available
          if (available) {
            return {
              ...result,
              score: scoreDomain(fullDomain, ext, true)
            }
          }
          
          return result
        } catch (error) {
          console.error(`Error checking domain ${fullDomain}:`, error)
          // On error, mark as unavailable
          return {
            domain: fullDomain,
            available: false,
            extension: ext,
            requested: hasExtension && ext === extension
          }
        }
      }))

      // Wait for both exact matches and AI variations
      const [results, aiVariations] = await Promise.all([exactMatchPromise, aiVariationsPromise])

      // Now check AI variations with retry mechanism
      const aiResults: DomainResult[] = []
      const allTriedVariations: string[] = []
      
      if (groqApiKey && apiKey) {
        let retryCount = 0
        const maxRetries = 3
        const targetResults = 5
        
        // Keep trying until we have enough results or hit max retries
        while (aiResults.length < targetResults && retryCount < maxRetries) {
          // Get variations (excluding already tried ones)
          const variations = retryCount === 0 ? aiVariations : 
            await generateDomainVariations(cleanBaseDomain, groqApiKey, allTriedVariations, domainPrompt)
          
          if (variations.length === 0) break
          
          console.log(`${retryCount === 0 ? 'Checking' : `Retry ${retryCount}:`} ${variations.length} AI variations in parallel...`)
          
          // Track these as tried
          allTriedVariations.push(...variations)
          
          // Check all variations in parallel
          const aiChecks = await Promise.all(
            variations.map(async (variation) => {
            // Try different extensions based on retry count
            const extensions = retryCount === 0 ? ['.com'] : 
                             retryCount === 1 ? ['.io', '.co', '.app'] :
                             ['.net', '.org', '.ai']
            
            const fullDomain = variation + extensions[Math.floor(Math.random() * extensions.length)]
            
            // Check cache first
            const cached = getCachedDomainAvailability(fullDomain)
            if (cached !== null) {
              if (!cached) return null
              const ext = fullDomain.match(/(\.[a-z]+)$/)?.[0] || '.com'
              return {
                domain: fullDomain,
                available: cached,
                extension: ext,
                suggested: true,
                score: scoreDomain(fullDomain, ext, false)
              }
            }
            
            // Throttle requests
            await throttleRequest()
            
            try {
              const domainResponse = await axios.get(`https://domainr.p.rapidapi.com/v2/status`, {
                params: { domain: fullDomain },
                headers: {
                  'X-RapidAPI-Key': apiKey,
                  'X-RapidAPI-Host': 'domainr.p.rapidapi.com'
                },
                timeout: 5000
              })
              
              const domainStatus = domainResponse.data.status?.find((s: { domain: string; status: string }) => s.domain === fullDomain)
              const available = domainStatus ? isAvailable(domainStatus.status) : false
              
              // Cache the result
              setCachedDomainAvailability(fullDomain, available)
              
              if (!available) return null
              const ext = fullDomain.match(/(\.[a-z]+)$/)?.[0] || '.com'
              return {
                domain: fullDomain,
                available: true,
                extension: ext,
                suggested: true,
                score: scoreDomain(fullDomain, ext, false)
              }
            } catch (error) {
              console.error(`Error checking variation ${fullDomain}:`, error)
              return null
            }
            })
          )
          
          // Filter out null results and add to our collection
          const newResults = aiChecks.filter(r => r !== null) as DomainResult[]
          aiResults.push(...newResults)
          
          console.log(`Found ${newResults.length} available domains (total: ${aiResults.length})`)
          
          retryCount++
        }
      }
      
      // Combine and filter results
      let allResults = [...results, ...aiResults]
      
      // Filter based on whether extension was specified
      if (!hasExtension) {
        // No extension specified - only show available domains
        allResults = allResults.filter(r => r.available)
      }
      
      // Deduplicate results based on domain name
      const uniqueResults = allResults.reduce((acc, current) => {
        const exists = acc.find(item => item.domain === current.domain)
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [] as DomainResult[])

      // Sort results by score (highest first), with requested domain always first
      uniqueResults.sort((a, b) => {
        // Requested domain always comes first (if not available)
        if (a.requested && !a.available) return -1
        if (b.requested && !b.available) return 1
        
        // Sort by score (higher is better)
        const scoreA = a.score || 0
        const scoreB = b.score || 0
        return scoreB - scoreA
      })

      // Track the search and results
      if (promptVersionId) {
        try {
          const searchId = await trackDomainSearch(sessionId, domain, 'domain', promptVersionId)
          
          // Track all checked domains with their positions
          await trackDomainSuggestions(
            searchId,
            uniqueResults.map((result, index) => ({
              domain: result.domain,
              extension: result.extension,
              available: result.available,
              position: index + 1
            }))
          )
        } catch (trackingError) {
          console.error('Error tracking analytics:', trackingError)
          // Don't fail the request if tracking fails
        }
      }

      // Cache the unique results 
      cache.set(cacheKey, { data: uniqueResults, timestamp: Date.now() })

      return NextResponse.json({ results: uniqueResults })
    } catch (apiError) {
      const error = apiError as AxiosError<{ message: string }>
      console.error('Domainr API error:', error.response?.status, error.response?.data || error.message)
      
      // Handle specific error cases and return appropriate error messages
      if (error.response?.status === 403) {
        console.error('API Key is invalid or forbidden')
        return NextResponse.json(
          { error: 'API Key is invalid or you are not subscribed to this API.' },
          { status: 403 }
        )
      } else if (error.response?.status === 429) {
        console.error('API rate limit exceeded')
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
      
      // Generic error for other cases
      return NextResponse.json(
        { error: 'Failed to check domain availability. Please try again later.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Domain check error:', error)
    return NextResponse.json(
      { error: 'Failed to check domain availability' },
      { status: 500 }
    )
  }
}