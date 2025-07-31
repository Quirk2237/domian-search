# Namecheap API Implementation

This document describes the implementation of Namecheap API integration for domain availability checking, replacing the previous Domainr API.

## Overview

The migration from Domainr to Namecheap API provides:
- **Batch domain checking** (up to 50 domains per request)
- **Premium domain support** with pricing information
- **XML response parsing** with comprehensive error handling
- **Sandbox and production environment support**

## API Configuration

### Environment Variables

Required environment variables in `.env.local`:

```env
# Namecheap API Configuration
NAMECHEAP_API_KEY=be3bac797a014fb6882d4b3133959c67
NAMECHEAP_API_USER=ideazap
NAMECHEAP_USERNAME=ideazap
# Local development: 63.65.170.130, Production: 216.198.79.1
NAMECHEAP_CLIENT_IP=63.65.170.130
NAMECHEAP_USE_SANDBOX=true
```

### API Endpoints

- **Sandbox**: `https://api.sandbox.namecheap.com/xml.response`
- **Production**: `https://api.namecheap.com/xml.response`

### IP Whitelisting

The Namecheap API requires IP whitelisting for security. You must add your IP addresses to the Namecheap account:

1. **Local Development IP**: `63.65.170.130`
2. **Production IP**: `216.198.79.1`

Both IPs should be whitelisted in your Namecheap account settings to allow seamless development and deployment.

## Implementation Details

### Core Components

1. **Namecheap Utility Library** (`/lib/namecheap.ts`)
   - XML response parsing using `fast-xml-parser`
   - Batch domain checking (up to 50 domains)
   - Error handling and caching integration
   - Premium domain detection and pricing

2. **Domain Check Route** (`/app/api/domains/check/route.ts`)
   - Migrated from individual API calls to batch processing
   - Premium domain support with pricing display
   - Namecheap-specific error handling

3. **Domain Suggest Route** (`/app/api/domains/suggest/route.ts`)
   - Batch availability checking for AI-generated suggestions
   - Premium domain inclusion in results
   - Improved performance with fewer API calls

### XML Response Structure

```xml
<ApiResponse Status="OK">
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult 
      Domain="example.com" 
      Available="true|false"
      IsPremiumName="true|false"
      PremiumRegistrationPrice="13000.0000"
      ErrorNo="0"
      Description=""
    />
  </CommandResponse>
</ApiResponse>
```

### Data Flow

1. **Domain Collection**: Gather domains to check (up to 50 per batch)
2. **API Request**: Send batch request to Namecheap API
3. **XML Parsing**: Parse response using fast-xml-parser
4. **Result Processing**: Extract availability, premium status, and pricing
5. **UI Display**: Show results with premium badges and pricing

## Premium Domain Handling

### Display Strategy

- **Premium Badge**: Simple amber badge showing "Premium"
- **Pricing**: Display actual premium price (e.g., "$13,000/year")
- **Positioning**: Premium domains shown after regular results
- **UI Impact**: Minimal styling changes, consistent with existing design

### Data Structure

```typescript
interface DomainResult {
  domain: string
  available: boolean
  extension: string
  isPremium?: boolean
  price?: number // Only for premium domains
}
```

## Error Handling

### Namecheap Error Codes

| Code | Description |
|------|-------------|
| 2011338 | Domain name not valid |
| 2030280 | TLD not supported |
| 2011170 | Missing required parameters |
| 2011165 | Invalid API key |
| 2011166 | Invalid IP address |

### Error Recovery

- **API Failures**: Fallback to marking domains as unavailable
- **XML Parsing Errors**: Comprehensive error logging and graceful degradation
- **Rate Limiting**: Built-in throttling and retry mechanisms

## Performance Improvements

### Batch Processing Benefits

- **Reduced API Calls**: 50 domains per request vs. 1 domain per request
- **Lower Latency**: Single network round-trip for multiple domains
- **Better Rate Limiting**: Fewer requests = less likely to hit limits

### Caching Strategy

- **Domain-level caching**: Individual domain results cached for 5 minutes
- **Batch optimization**: Cache hits reduce domains to check in batch
- **Memory efficiency**: Existing caching infrastructure reused

## Testing

### API Validation

The implementation has been tested with:
- ✅ TypeScript compilation
- ✅ Batch domain checking
- ✅ Premium domain detection
- ✅ XML response parsing
- ✅ Error handling scenarios

### UI Components

- ✅ Premium badge display
- ✅ Dynamic pricing display
- ✅ Consistent styling across components

## Migration Notes

### Key Differences from Domainr

1. **Response Format**: XML instead of JSON
2. **Batch Capability**: Up to 50 domains per request
3. **Premium Information**: Included in standard response
4. **Error Handling**: Different error codes and structure

### Breaking Changes

- **API Configuration**: New environment variables required
- **Response Structure**: Premium fields added to interfaces
- **Error Messages**: Updated for Namecheap-specific errors

## Important Notes

### Stripe API Version Warning

**DO NOT UPDATE** the Stripe API version in `lib/stripe.ts`. The current version `"2025-05-28.basil"` should remain unchanged to avoid deployment issues with Vercel. This is a known issue that repeats and causes deployment failures.

### Production Deployment

To switch to production:
1. Set `NAMECHEAP_USE_SANDBOX=false` in environment variables
2. Ensure all API credentials are valid for production
3. Test thoroughly with production API before full deployment

## Files Modified

- `/lib/namecheap.ts` - New utility library
- `/app/api/domains/check/route.ts` - Migrated to Namecheap
- `/app/api/domains/suggest/route.ts` - Migrated to Namecheap
- `/components/domain-search/*.tsx` - Added premium UI support
- `/.env.example` - Added Namecheap variables
- `/package.json` - Added fast-xml-parser dependency

## Next Steps

1. **Production Testing**: Test with production API when ready
2. **Monitoring**: Implement additional logging for production use
3. **Rate Limiting**: Monitor API usage and adjust throttling if needed
4. **UI Enhancements**: Consider additional premium domain features if needed