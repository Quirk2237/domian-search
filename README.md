# Wicked Simple Domains

A modern AI-powered domain name search and suggestion platform built with Next.js 15, featuring real-time availability checking and intelligent domain recommendations.

## Features

### Core Functionality
- **Smart Search Auto-Detection**
  - Single word → Domain availability checking across multiple TLDs
  - Multiple words → AI-powered domain name suggestions
- **Real-time Domain Availability** - Instant checking via Domainr API
- **AI Domain Suggestions** - Powered by Groq (gemma2-9b-it)
- **Analytics Dashboard** - Track searches, suggestions, and user engagement
- **Domain Quality Evaluation** - AI-powered evaluation system for improving suggestions

### Technical Features
- **Authentication** - Secure user sessions with Clerk
- **Payment Integration** - Stripe subscription management
- **Database** - Supabase (PostgreSQL) with Drizzle ORM
- **Analytics Tracking** - Custom analytics for domain searches and clicks
- **Cost Tracking** - Real-time API usage and cost monitoring
- **Mobile Optimized** - Responsive design with touch-friendly interfaces
- **Performance** - Sub-second domain checks, <2s AI suggestions

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI library
- **Backend**: Next.js Server Actions, API Routes
- **Database**: Supabase (PostgreSQL) with Drizzle ORM
- **Authentication**: Clerk
- **Payments**: Stripe
- **AI**: Groq API (domain suggestions), Anthropic Claude (evaluation)
- **Domain API**: Domainr (availability checking)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase CLI (for local development)

### Environment Variables

Create a `.env.local` file:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Stripe Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI Services
GROQ_API_KEY=
ANTHROPIC_API_KEY= # Optional: for domain evaluation

# Domain Services
DOMAINR_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Database (handled by Supabase CLI)
# DATABASE_URL is automatically set by Supabase
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd test-setup

# Install dependencies
npm install

# Start Supabase locally
npx supabase start

# Push database schema
npm run db:push

# Seed database (optional)
npx bun db/seed

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev             # Start development server
npm run build          # Build for production
npm run start          # Start production server

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run types          # TypeScript type checking
npm run format:write   # Format with Prettier
npm run clean          # Run lint:fix + format

# Database
npx drizzle-kit push   # Push schema changes
npx drizzle-kit generate # Generate migrations
npx drizzle-kit migrate # Run migrations
npx supabase start     # Start local Supabase

# Testing
npm run test           # Run all tests
npm run test:unit      # Run unit tests
npm run test:e2e       # Run E2E tests

# Component Management
npx shadcn@latest add [component] # Add Shadcn components
```

## Project Structure

```
├── app/
│   ├── (unauthenticated)/    # Public routes
│   │   ├── (marketing)/       # Landing pages
│   │   └── (auth)/           # Login/signup
│   ├── (authenticated)/       # Protected routes
│   │   └── dashboard/        # User dashboard
│   ├── api/                  # API endpoints
│   │   ├── domains/          # Domain search APIs
│   │   ├── analytics/        # Analytics endpoints
│   │   └── stripe/           # Payment webhooks
│   └── stats/                # Public stats page
├── components/
│   ├── domain-search/        # Domain search UI
│   ├── payments/             # Stripe components
│   └── ui/                   # Shadcn components
├── actions/                  # Server actions
├── db/                       # Database schema
├── lib/                      # Utilities & configs
└── hooks/                    # Custom React hooks
```

## Database Schema

The application uses the following main tables:
- `prompt_versions` - Stores AI prompt versions for domain suggestions
- `domain_searches` - Tracks all domain searches with cost data
- `domain_suggestions` - Stores AI-generated domain suggestions
- `domain_clicks` - Analytics for domain clicks
- `quality_checklist_versions` - Domain quality evaluation criteria
- `domain_search_scores` - Evaluation scores for suggestions
- `api_usage_logs` - Detailed API call tracking and costs

## Key Features Explained

### Smart Search Detection
The search bar automatically detects user intent:
- Single words trigger domain availability checking
- Multi-word phrases trigger AI domain suggestions

### Domain Evaluation System
Automatic scoring via Supabase Edge Function:
- Evaluates AI suggestions against quality criteria
- Stores detailed scores in `domain_search_scores` table
- Triggers automatically after domain suggestions are inserted
- Setup: Set `ANTHROPIC_API_KEY` as Supabase secret:
  ```bash
  npx supabase secrets set ANTHROPIC_API_KEY=your-key
  ```

### Cost Tracking System
Real-time API usage and cost monitoring:
- **Groq API**: $0.20 per 5M tokens (gemma2-9b-it model)
- **Average cost**: ~$0.0003 per domain search
- Tracks token usage (input/output) per search
- Stores LLM model and temperature settings
- Monitors Domainr API request counts
- Detailed cost analytics in dashboard

### Analytics Dashboard
Available at `/stats`, shows:
- Total searches and suggestions
- Popular search queries
- Domain extension distribution
- Recent search activity
- **Cost Analytics** (new):
  - Real-time cost tracking per search
  - Token usage statistics
  - API cost breakdown by provider
  - Estimated monthly costs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Deployment

The application is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with automatic CI/CD

See `VERCEL_ENV_SETUP.md` for detailed deployment instructions.

## License

This project is licensed under the terms specified in the `license` file.