import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (for MVP)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

export function checkRateLimit(
  identifier: string,
  limit: number = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'),
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    const resetTime = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: limit - 1, resetTime }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  // Increment count
  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime }
}