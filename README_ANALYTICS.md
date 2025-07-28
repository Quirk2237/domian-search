# Domain Search Analytics System

This project now includes a comprehensive analytics system to track domain searches, suggestions, and user interactions.

## Features

### 1. Database Schema
- **prompt_versions**: Tracks different AI prompt versions for A/B testing
- **domain_searches**: Records all search queries with session tracking
- **domain_suggestions**: Stores generated domain suggestions with availability status
- **domain_clicks**: Tracks user clicks on domain registration links

### 2. Dynamic Prompt Management
- Prompts are loaded from the database instead of being hardcoded
- Supports versioning for A/B testing different prompts
- 5-minute cache for optimal performance

### 3. Analytics Tracking
- Anonymous session-based tracking
- Tracks search queries, modes, and results
- Records which domains users click to register
- No personal data collection

### 4. Stats Dashboard
Access the analytics dashboard at `/dashboard/stats` to view:
- Total searches entered
- Total domains served
- Total clicks on domains
- Click-through rate
- Search mode distribution
- Top clicked domains

The dashboard features smooth Framer Motion animations and real-time data updates.

## API Endpoints

### Analytics Endpoints
- `POST /api/analytics/track` - Track domain clicks
- `GET /api/analytics/stats` - Retrieve aggregated statistics

### Updated Domain Endpoints
- `POST /api/domains/suggest` - Now tracks searches and uses DB prompts
- `POST /api/domains/check` - Now tracks searches and uses DB prompts

## Environment Variables

Make sure to set these environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Migrations

The following migrations have been applied:
1. `create_analytics_tables` - Creates all analytics tables and indexes
2. `seed_initial_prompts` - Seeds the initial AI prompts

## Usage

1. The system automatically tracks all searches and suggestions
2. Click tracking is handled client-side when users click domain links
3. Access `/dashboard/stats` to view analytics (authentication required)
4. Prompts can be updated directly in the database

## Future Enhancements

- Historical trend charts
- Prompt A/B testing with performance comparison
- Export functionality for analytics data
- Real-time dashboard updates with WebSockets