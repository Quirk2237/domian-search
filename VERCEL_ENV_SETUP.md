# Vercel Environment Variables Setup

To deploy this application on Vercel in MVP mode (without authentication), add the following environment variables in your Vercel project settings:

## Required Environment Variables

### MVP Mode Configuration
```
NEXT_PUBLIC_MVP_MODE=true
```

### Clerk (Dummy values for MVP)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dummy
CLERK_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
```

### Stripe (Optional for MVP)
```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
```

### Domain Search APIs (Optional)
```
DOMAINR_RAPIDAPI_KEY=your_key_here
GROQ_API_KEY=your_key_here
RATE_LIMIT_PER_MINUTE=100
```

## Enabling Authentication

When you're ready to enable authentication:

1. Set `NEXT_PUBLIC_MVP_MODE=false`
2. Replace the dummy Clerk keys with real ones from your Clerk dashboard
3. Add real Stripe keys if using payments
4. Redeploy your application

## Notes

- The dummy Clerk keys are required to satisfy build-time validation
- In MVP mode, all routes are accessible without authentication
- The font warnings during build are non-critical and can be ignored