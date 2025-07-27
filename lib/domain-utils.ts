export type SearchMode = 'domain' | 'suggestion'

export function detectSearchMode(input: string): SearchMode {
  const trimmed = input.trim()
  
  // Only switch to suggestion mode if input contains multiple words (spaces)
  if (trimmed.includes(' ')) {
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

export function parseDomainInput(input: string): {
  baseDomain: string
  extension?: string
  hasExtension: boolean
} {
  const cleaned = input.toLowerCase().trim()
  
  // Check if input contains a known extension
  for (const ext of POPULAR_EXTENSIONS) {
    if (cleaned.endsWith(ext)) {
      return {
        baseDomain: cleaned.slice(0, -ext.length),
        extension: ext,
        hasExtension: true
      }
    }
  }
  
  // Check for any extension pattern (dot followed by 2-6 letters)
  const extensionMatch = cleaned.match(/^(.+)(\.[a-z]{2,6})$/)
  if (extensionMatch) {
    return {
      baseDomain: extensionMatch[1],
      extension: extensionMatch[2],
      hasExtension: true
    }
  }
  
  // No extension found
  return {
    baseDomain: cleaned,
    hasExtension: false
  }
}