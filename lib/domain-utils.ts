export type SearchMode = 'domain' | 'suggestion'

export function detectSearchMode(input: string): SearchMode {
  const trimmed = input.trim()
  
  // If input contains spaces or is longer than 15 characters, it's likely a business idea
  if (trimmed.includes(' ') || trimmed.length > 15) {
    return 'suggestion'
  }
  
  return 'domain'
}

export function formatDomainName(domain: string): string {
  // Keep dots for proper domain format (e.g., example.com)
  return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '')
}

export const POPULAR_EXTENSIONS = [
  '.com',
  '.net', 
  '.org',
  '.io',
  '.co',
  '.ai',
  '.app',
  '.dev',
  '.tech',
  '.online',
  '.store',
  '.site'
]

export const EXTENSION_PRICES: Record<string, number> = {
  '.com': 12.99,
  '.net': 14.99,
  '.org': 14.99,
  '.io': 34.99,
  '.co': 29.99,
  '.ai': 89.99,
  '.app': 19.99,
  '.dev': 19.99,
  '.tech': 49.99,
  '.online': 39.99,
  '.store': 49.99,
  '.site': 29.99
}