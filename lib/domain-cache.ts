interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Shared cache for domain availability
const domainAvailabilityCache = new Map<string, CacheEntry<boolean>>()

// Domain cache TTL: 30 minutes
const DOMAIN_CACHE_TTL = 30 * 60 * 1000

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of domainAvailabilityCache.entries()) {
    if (now - entry.timestamp > DOMAIN_CACHE_TTL) {
      domainAvailabilityCache.delete(key)
    }
  }
}, 5 * 60 * 1000) // Clean every 5 minutes

export function getCachedDomainAvailability(domain: string): boolean | null {
  const cached = domainAvailabilityCache.get(domain.toLowerCase())
  
  if (cached && Date.now() - cached.timestamp < DOMAIN_CACHE_TTL) {
    return cached.data
  }
  
  return null
}

export function setCachedDomainAvailability(domain: string, available: boolean): void {
  domainAvailabilityCache.set(domain.toLowerCase(), {
    data: available,
    timestamp: Date.now()
  })
}

// Request throttling
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 100 // 100ms between requests

export async function throttleRequest(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  
  lastRequestTime = Date.now()
}