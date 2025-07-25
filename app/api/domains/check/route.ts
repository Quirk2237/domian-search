import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { formatDomainName, POPULAR_EXTENSIONS } from '@/lib/domain-utils'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'

// Simple in-memory cache
interface CacheEntry {
  data: DomainResult[]
  timestamp: number
}

interface DomainResult {
  domain: string
  available: boolean
  extension: string
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

    const cleanDomain = formatDomainName(domain)
    
    // Check cache first
    const cacheKey = `domain:${cleanDomain}`
    const cached = cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ results: cached.data })
    }

    // Check if API key is configured
    const apiKey = process.env.DOMAINR_RAPIDAPI_KEY
    if (!apiKey) {
      // Return mock data if no API key
      const mockResults = POPULAR_EXTENSIONS.map(ext => ({
        domain: cleanDomain + ext,
        available: Math.random() > 0.7,
        extension: ext
      }))
      
      // Ensure .com is always first and show as taken for common words
      mockResults[0].available = cleanDomain.length > 8
      
      cache.set(cacheKey, { data: mockResults, timestamp: Date.now() })
      return NextResponse.json({ results: mockResults })
    }

    // Make API call to Domainr
    const response = await axios.get(`https://domainr.p.rapidapi.com/v2/status`, {
      params: {
        domain: cleanDomain
      },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'domainr.p.rapidapi.com'
      }
    })

    // Transform the response to our format
    const results = POPULAR_EXTENSIONS.map(ext => {
      const fullDomain = cleanDomain + ext
      const domainStatus = response.data.status?.find((s: { domain: string; status: string }) => s.domain === fullDomain)
      
      return {
        domain: fullDomain,
        available: domainStatus ? domainStatus.status === 'available' : false,
        extension: ext
      }
    })

    // Cache the results
    cache.set(cacheKey, { data: results, timestamp: Date.now() })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Domain check error:', error)
    return NextResponse.json(
      { error: 'Failed to check domain availability' },
      { status: 500 }
    )
  }
}