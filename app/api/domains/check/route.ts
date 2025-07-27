import { NextRequest, NextResponse } from 'next/server'
import axios, { AxiosError } from 'axios'
import { formatDomainName, POPULAR_EXTENSIONS, parseDomainInput } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { getCachedDomainAvailability, setCachedDomainAvailability, throttleRequest } from '@/lib/domain-cache'

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
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
      
      // Transform the response to our format
      const results = await Promise.all(extensionsToCheck.map(async ext => {
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
          
          return {
            domain: fullDomain,
            available,
            extension: ext,
            requested: hasExtension && ext === extension
          }
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

      // Cache the results
      cache.set(cacheKey, { data: results, timestamp: Date.now() })

      return NextResponse.json({ results })
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