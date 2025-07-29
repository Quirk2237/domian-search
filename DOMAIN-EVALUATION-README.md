# Domain Evaluation System

This system uses Claude to evaluate and score domain suggestions against our quality checklist, storing the results in the database for analysis and optimization.

## How It Works

The evaluation system uses a Supabase Edge Function that:
1. Automatically triggers after domain suggestions are inserted into the database
2. Evaluates suggestions against the quality checklist using Claude
3. Stores detailed scoring and analysis in the `domain_search_scores` table
4. Enables data-driven optimization of domain suggestion prompts

## Setup

### 1. Set the Anthropic API Key as a Supabase Secret

```bash
npx supabase secrets set ANTHROPIC_API_KEY=your-api-key-here
```

### 2. Deploy the Edge Function

The `score-domain-search` edge function is already deployed and will automatically trigger via database triggers when new domain suggestions are inserted.

### 3. Manual Scoring

You can manually score any domain search using the RPC function:

```sql
-- Score a specific search
SELECT manually_score_domain_search('search-id-here'::uuid);

-- View scoring results
SELECT * FROM domain_search_scores WHERE search_id = 'search-id-here';
```

## Database Schema

### Tables Used

- `domain_searches` - Stores search queries
- `domain_suggestions` - Stores AI-generated suggestions
- `quality_checklist_versions` - Contains evaluation criteria
- `domain_search_scores` - Stores evaluation results

### Scoring Details

The `score_details` JSONB field contains:
- `overall_score` - Weighted score from 0-10
- `criteria_scores` - Individual scores for each quality criterion
- `quality_filters` - Pass/fail for quality checks
- `naming_techniques_analysis` - Analysis of naming strategies used
- `industry_relevance_assessment` - How well suggestions match the query
- `strengths` and `weaknesses` - Key insights
- `summary` - Overall assessment

## Monitoring & Analysis

### View Recent Scores
```sql
SELECT 
  ds.query,
  dss.overall_score,
  dss.score_details->>'summary' as summary,
  dss.scored_at
FROM domain_search_scores dss
JOIN domain_searches ds ON ds.id = dss.search_id
ORDER BY dss.scored_at DESC
LIMIT 10;
```

### Average Scores by Day
```sql
SELECT 
  DATE(scored_at) as date,
  AVG((overall_score)::numeric) as avg_score,
  COUNT(*) as searches_scored
FROM domain_search_scores
GROUP BY DATE(scored_at)
ORDER BY date DESC;
```

### Find Low-Scoring Searches
```sql
SELECT 
  ds.query,
  dss.overall_score,
  dss.score_details->'weaknesses' as weaknesses
FROM domain_search_scores dss
JOIN domain_searches ds ON ds.id = dss.search_id
WHERE dss.overall_score < 5
ORDER BY dss.overall_score ASC;
```

## Automatic Triggering

The system uses PostgreSQL triggers to automatically score searches:
- Triggers after 5+ suggestions are inserted
- Only scores "suggestion" mode searches (not single domain checks)
- Skips already-scored searches
- Uses `pg_net` for async HTTP calls to avoid blocking

## Troubleshooting

### Edge Function Errors

Check edge function logs:
```bash
npx supabase functions logs score-domain-search
```

### Missing Scores

Verify the search has suggestions:
```sql
SELECT 
  ds.id,
  ds.query,
  COUNT(dsg.id) as suggestion_count,
  EXISTS(SELECT 1 FROM domain_search_scores WHERE search_id = ds.id) as is_scored
FROM domain_searches ds
LEFT JOIN domain_suggestions dsg ON dsg.search_id = ds.id
WHERE ds.search_mode = 'suggestion'
GROUP BY ds.id
HAVING COUNT(dsg.id) > 0 AND NOT EXISTS(SELECT 1 FROM domain_search_scores WHERE search_id = ds.id);
```

### Re-score Searches

To re-score all unscored searches:
```sql
SELECT manually_score_domain_search(id)
FROM domain_searches ds
WHERE search_mode = 'suggestion'
AND EXISTS (SELECT 1 FROM domain_suggestions WHERE search_id = ds.id)
AND NOT EXISTS (SELECT 1 FROM domain_search_scores WHERE search_id = ds.id);
```

## Best Practices

1. **Regular Monitoring** - Check scores weekly to identify trends
2. **Prompt Optimization** - Use low-scoring patterns to improve prompts
3. **Quality Threshold** - Consider alerts for scores below 6.0
4. **Checklist Updates** - Evolve criteria based on user feedback
5. **Performance** - Edge function runs async, no user impact