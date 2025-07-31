import { NextRequest, NextResponse } from 'next/server'
import axios, { AxiosError } from 'axios'
import Groq from 'groq-sdk'
import { formatDomainName, POPULAR_EXTENSIONS, parseDomainInput } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'
import { getActivePrompt, getActivePromptId } from '@/lib/prompts'
import { getSessionId, trackDomainSearch, trackDomainSuggestions } from '@/lib/analytics'
import { checkDomainsNamecheap, isDomainAvailable, getDomainPrice, type NamecheapConfig } from '@/lib/namecheap'

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
  isPremium?: boolean // Indicates if this is a premium domain
  price?: number // Price for premium domains (uses same format as EXTENSION_PRICES)
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

    // Configure Namecheap API
    const namecheapConfig: NamecheapConfig = {
      apiKey: process.env.NAMECHEAP_API_KEY || '',
      apiUser: process.env.NAMECHEAP_API_USER || '',
      username: process.env.NAMECHEAP_USERNAME || '',
      clientIp: process.env.NAMECHEAP_CLIENT_IP || '',
      useSandbox: process.env.NAMECHEAP_USE_SANDBOX === 'true'
    }
    
    // Check if API is configured
    if (!namecheapConfig.apiKey || !namecheapConfig.apiUser) {
      // Return mock data if no API configured
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

    // Make API calls for domains
    try {

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

      // Prepare domains to check
      const domainsToCheck = extensionsToCheck.map(ext => cleanBaseDomain + ext)
      
      // Check domains using Namecheap batch API
      let namecheapResults
      try {
        namecheapResults = await checkDomainsNamecheap(domainsToCheck, namecheapConfig)
      } catch (error) {
        console.error('Namecheap API error:', error)
        // On API error, return all domains as unavailable
        namecheapResults = domainsToCheck.map(domain => ({
          domain,
          available: false,
          errorNo: '0',
          description: '',
          isPremiumName: false,
          premiumRegistrationPrice: 0,
          premiumRenewalPrice: 0,
          icannFee: 0,
          eapFee: 0
        }))
      }
      
      // Map Namecheap results to our format
      const exactMatchPromise = Promise.resolve(namecheapResults.map(result => {
        const extension = result.domain.match(/\.[^.]+$/)?.[0] || ''
        const isRequested = hasExtension && extension === extension
        const available = isDomainAvailable(result)
        const price = getDomainPrice(result)
        
        // Cache the result
        setCachedDomainAvailability(result.domain, available)
        
        const domainResult: DomainResult = {
          domain: result.domain,
          available,
          extension,
          requested: isRequested
        }
        
        // Add premium info if applicable
        if (result.isPremiumName) {
          domainResult.isPremium = true
          domainResult.price = price
        }
        
        // Add score if available
        if (available) {
          domainResult.score = scoreDomain(result.domain, extension, true)
        }
        
        return domainResult
      }))

      // Wait for both exact matches and AI variations
      const [results, aiVariations] = await Promise.all([exactMatchPromise, aiVariationsPromise])

      // Now check AI variations with retry mechanism
      const aiResults: DomainResult[] = []
      const allTriedVariations: string[] = []
      
      if (groqApiKey && namecheapConfig.apiKey) {
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
          
          // Prepare variations with extensions
          const extensions = retryCount === 0 ? ['.com'] : 
                           retryCount === 1 ? ['.io', '.co', '.app'] :
                           ['.net', '.org', '.ai']
          
          const variationsWithDomains = variations.map(variation => {
            const extension = extensions[Math.floor(Math.random() * extensions.length)]
            return variation + extension
          })
          
          // Check variations using Namecheap batch API
          let variationResults: Awaited<ReturnType<typeof checkDomainsNamecheap>>
          try {
            variationResults = await checkDomainsNamecheap(variationsWithDomains, namecheapConfig)
          } catch (error) {
            console.error('Namecheap API error for variations:', error)
            variationResults = []
          }
          
          // Map results to our format
          const aiChecks = variationResults.map(result => {
            const ext = result.domain.match(/(\.[a-z]+)$/)?.[0] || '.com'
            const available = isDomainAvailable(result)
            const price = getDomainPrice(result)
            
            // Cache the result
            setCachedDomainAvailability(result.domain, available)
            
            if (!available) return null
            
            const domainResult: DomainResult = {
              domain: result.domain,
              available: true,
              extension: ext,
              suggested: true,
              score: scoreDomain(result.domain, ext, false)
            }
            
            // Add premium info if applicable
            if (result.isPremiumName) {
              domainResult.isPremium = true
              domainResult.price = price
            }
            
            return domainResult
          }).filter(r => r !== null)
          
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
      console.error('Namecheap API error:', apiError)
      
      // Handle specific Namecheap errors
      if (apiError instanceof Error) {
        if (apiError.message.includes('Invalid API key')) {
          return NextResponse.json(
            { error: 'Invalid Namecheap API key. Please check your configuration.' },
            { status: 403 }
          )
        } else if (apiError.message.includes('Failed to parse')) {
          return NextResponse.json(
            { error: 'Invalid response from domain API. Please try again later.' },
            { status: 500 }
          )
        }
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