import { XMLParser } from 'fast-xml-parser'

// Namecheap API configuration
export interface NamecheapConfig {
  apiKey: string
  apiUser: string
  username: string
  clientIp: string
  useSandbox: boolean
}

// Domain check result from Namecheap API
export interface NamecheapDomainResult {
  domain: string
  available: boolean
  errorNo: string
  description: string
  isPremiumName: boolean
  premiumRegistrationPrice: number
  premiumRenewalPrice: number
  icannFee: number
  eapFee: number
}

// API response structure
interface NamecheapApiResponse {
  ApiResponse: {
    '@_Status': string
    '@_xmlns': string
    Errors?: unknown
    Warnings?: unknown
    RequestedCommand: string
    CommandResponse: {
      '@_Type': string
      DomainCheckResult: NamecheapDomainCheckResult | NamecheapDomainCheckResult[]
    }
    Server: string
    GMTTimeDifference: string
    ExecutionTime: string
  }
}

interface NamecheapDomainCheckResult {
  '@_Domain': string
  '@_Available': string
  '@_ErrorNo': string
  '@_Description': string
  '@_IsPremiumName': string
  '@_PremiumRegistrationPrice': string
  '@_PremiumRenewalPrice': string
  '@_PremiumRestorePrice': string
  '@_PremiumTransferPrice': string
  '@_IcannFee': string
  '@_EapFee': string
}

// Error codes from Namecheap API
export const NAMECHEAP_ERROR_CODES: Record<string, string> = {
  '1011102': 'API Key is invalid or API access has not been enabled',
  '2011338': 'Domain name not valid',
  '2030280': 'TLD not supported', 
  '2011170': 'Missing required parameters',
  '2011165': 'Invalid API key',
  '2011166': 'Invalid IP address',
  '2011168': 'Domain name is missing',
  '2011169': 'Command parameter is missing',
  '2011280': 'API access denied',
  '2050900': 'Unknown error occurred'
}

// Initialize XML parser
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
})

/**
 * Get Namecheap API endpoint based on environment
 */
export function getNamecheapEndpoint(useSandbox: boolean): string {
  return useSandbox 
    ? 'https://api.sandbox.namecheap.com/xml.response'
    : 'https://api.namecheap.com/xml.response'
}

/**
 * Parse Namecheap XML response to extract domain results
 */
export function parseNamecheapResponse(xmlData: string): NamecheapDomainResult[] {
  try {
    const parsed = parser.parse(xmlData) as NamecheapApiResponse
    console.log('Parsed Namecheap Response:', JSON.stringify(parsed, null, 2))
    
    // Check if API returned an error
    if (parsed.ApiResponse['@_Status'] !== 'OK') {
      // Try to extract error details
      let errorMessage = 'Namecheap API returned an error status'
      
      if (parsed.ApiResponse.Errors && typeof parsed.ApiResponse.Errors === 'object' && 'Error' in parsed.ApiResponse.Errors) {
        const errorData = parsed.ApiResponse.Errors as { Error: unknown | unknown[] }
        const errors = Array.isArray(errorData.Error) 
          ? errorData.Error 
          : [errorData.Error]
        
        const errorDetails = errors.map((err: Record<string, unknown>) => 
          `${err['@_Number']}: ${err['#text'] || err}`)
        
        errorMessage = `Namecheap API Error: ${errorDetails.join(', ')}`
      }
      
      console.error('Namecheap API Error Details:', {
        status: parsed.ApiResponse['@_Status'],
        errors: parsed.ApiResponse.Errors,
        warnings: parsed.ApiResponse.Warnings,
        server: parsed.ApiResponse.Server,
        executionTime: parsed.ApiResponse.ExecutionTime
      })
      
      throw new Error(errorMessage)
    }

    const commandResponse = parsed.ApiResponse.CommandResponse
    if (!commandResponse || !commandResponse.DomainCheckResult) {
      throw new Error('Missing DomainCheckResult in API response')
    }
    
    const checkResults = commandResponse.DomainCheckResult

    // Handle single result or array of results
    const results = Array.isArray(checkResults) ? checkResults : [checkResults]

    return results.map(result => {
      // Debug the actual values being parsed
      console.log('Domain availability debug:', {
        domain: result['@_Domain'],
        rawAvailable: result['@_Available'],
        availableType: typeof result['@_Available'],
        rawPremium: result['@_IsPremiumName'],
        premiumType: typeof result['@_IsPremiumName']
      })
      
      // More robust availability parsing - handle both boolean and string values
      const availableValue = result['@_Available']
      const isAvailable = String(availableValue).toLowerCase() === 'true'
      
      // More robust premium parsing 
      const premiumValue = result['@_IsPremiumName']
      const isPremium = String(premiumValue).toLowerCase() === 'true'
      
      return {
        domain: result['@_Domain'],
        available: isAvailable,
        errorNo: result['@_ErrorNo'] || '0',
        description: result['@_Description'] || '',
        isPremiumName: isPremium,
        premiumRegistrationPrice: parseFloat(result['@_PremiumRegistrationPrice'] || '0'),
        premiumRenewalPrice: parseFloat(result['@_PremiumRenewalPrice'] || '0'),
        icannFee: parseFloat(result['@_IcannFee'] || '0'),
        eapFee: parseFloat(result['@_EapFee'] || '0')
      }
    })
  } catch (error) {
    console.error('Error parsing Namecheap XML response:', error)
    console.error('Raw XML data:', xmlData)
    throw new Error(`Failed to parse Namecheap API response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Check domain availability using Namecheap API
 * Supports batch checking up to 50 domains at once
 */
export async function checkDomainsNamecheap(
  domains: string[],
  config: NamecheapConfig
): Promise<NamecheapDomainResult[]> {
  if (domains.length === 0) {
    return []
  }

  // Namecheap supports up to 50 domains per request
  if (domains.length > 50) {
    throw new Error('Cannot check more than 50 domains at once')
  }

  const endpoint = getNamecheapEndpoint(config.useSandbox)
  const domainList = domains.join(',')

  const requestParams = {
    ApiUser: config.apiUser,
    ApiKey: config.apiKey,
    UserName: config.username,
    Command: 'namecheap.domains.check',
    ClientIp: config.clientIp,
    DomainList: domainList
  }

  const requestUrl = `${endpoint}?${new URLSearchParams(requestParams)}`
  
  console.log('Namecheap API Request:', {
    endpoint,
    params: { ...requestParams, ApiKey: '[REDACTED]' },
    domainCount: domains.length,
    domainList: domainList.substring(0, 100) + (domainList.length > 100 ? '...' : '')
  })

  try {
    const response = await fetch(requestUrl)

    if (!response.ok) {
      console.error('Namecheap API HTTP Error:', response.status, response.statusText)
      throw new Error(`Namecheap API request failed: ${response.status} ${response.statusText}`)
    }

    const xmlData = await response.text()
    console.log('Namecheap API Raw Response (first 500 chars):', xmlData.substring(0, 500))
    
    return parseNamecheapResponse(xmlData)
  } catch (error) {
    console.error('Namecheap API error:', error)
    throw error
  }
}

/**
 * Check a single domain's availability
 */
export async function checkDomainNamecheap(
  domain: string,
  config: NamecheapConfig
): Promise<NamecheapDomainResult> {
  const results = await checkDomainsNamecheap([domain], config)
  if (results.length === 0) {
    throw new Error('No results returned from Namecheap API')
  }
  return results[0]
}

/**
 * Convert Namecheap error code to user-friendly message
 */
export function getNamecheapErrorMessage(errorNo: string): string {
  return NAMECHEAP_ERROR_CODES[errorNo] || `Unknown error (code: ${errorNo})`
}

/**
 * Check if a domain is available for registration (not premium or taken)
 * For our purposes, premium domains are considered available but with a price
 */
export function isDomainAvailable(result: NamecheapDomainResult): boolean {
  return result.available && result.errorNo === '0'
}

/**
 * Get the price for a domain (0 for regular domains, actual price for premium)
 */
export function getDomainPrice(result: NamecheapDomainResult): number | undefined {
  if (result.isPremiumName && result.premiumRegistrationPrice > 0) {
    return result.premiumRegistrationPrice
  }
  return undefined // Regular domains use the fixed prices from EXTENSION_PRICES
}