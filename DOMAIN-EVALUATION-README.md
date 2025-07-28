# Domain Evaluation System

This system uses Claude to evaluate Groq's domain suggestions against our quality checklist and suggest prompt improvements.

## How to Enable

1. Set your Anthropic API key in `.env.local`:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```

2. Enable evaluation by setting:
   ```
   ENABLE_DOMAIN_EVALUATION=true
   ```

## How It Works

When enabled, every domain suggestion request will:

1. Track all domains that Groq suggests (both available and unavailable)
2. Send the results to Claude for evaluation
3. Log detailed feedback to the console including:
   - Quality scores against our checklist
   - Analysis of why good domains were unavailable
   - Specific prompt improvements
   - A complete improved prompt ready to test

## Console Output Example

```
=== Domain Suggestion Evaluation ===
Query: "AI recipe app"
Overall Score: 6.5/10
Availability Rate: 32%

Checklist Compliance:
  - length: 7/10 domains meet length criteria
  - brandability: Only 3/10 are truly brandable
  - tld: 2/10 are .com (but 5 .com domains were unavailable)
  - pronunciation: 10/10 pass radio test

Strengths:
  ✓ Good variety of extensions
  ✓ All domains are pronounceable
  ✓ No hyphens or numbers

Weaknesses:
  ✗ Too many generic descriptive names
  ✗ Not enough invented brandable names
  ✗ Average length too long (11.2 chars)

Why good domains were unavailable:
  - Short, memorable .com domains (recipe.ai, cookbot.com) already taken
  - Common word combinations are saturated
  - Need more creative/invented approaches

--- SUGGESTED IMPROVED PROMPT ---
Focus more on invented brandable names, less on literal keywords

Specific changes:
  ADD: "Generate 70% invented brandable names (like Spotify, Canva)"
  MODIFY: "Brandability (35%) > Keywords (15%)" 
  ADD: "Assume common words are taken - be creative"
  REMOVE: Redundant voice search instructions

Full improved prompt:
----------------------------------------
[Complete improved prompt shown here]
----------------------------------------

Expected improvements:
  → Higher availability rate (fewer common words)
  → More memorable, brandable suggestions
  → Better balance of creativity vs relevance
=== End Evaluation ===
```

## Updating the Domain Quality Checklist

Edit `DOMAIN-QUALITY-CHECKLIST.md` to refine your criteria. The evaluation system will automatically use the updated checklist.

## Testing Prompt Improvements

1. Copy the improved prompt from the console logs
2. Replace the current prompt in `/app/api/domains/suggest/route.ts`
3. Test with the same query to see improvements
4. Monitor the new evaluation scores

## Performance Impact

- Adds ~1-2 seconds to each request when enabled
- Only runs in development/testing (disable for production)
- Evaluation failures don't affect user experience

## Best Practices

1. Run evaluations on diverse queries to identify patterns
2. Update the checklist based on real-world learning
3. Test prompt changes incrementally
4. Keep track of which prompt versions perform best
5. Disable evaluation in production (`ENABLE_DOMAIN_EVALUATION=false`)