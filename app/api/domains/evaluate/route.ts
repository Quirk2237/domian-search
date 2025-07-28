import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { query, currentPrompt, results } = await request.json()
    
    if (!query || !currentPrompt || !results) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      console.error('No Anthropic API key configured')
      return NextResponse.json(
        { error: 'Evaluation service not configured' },
        { status: 500 }
      )
    }

    // Read the domain quality checklist
    const checklistPath = path.join(process.cwd(), 'DOMAIN-QUALITY-CHECKLIST.md')
    const checklistContent = await readFile(checklistPath, 'utf-8')

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    })

    // Prepare the evaluation prompt
    const evaluationPrompt = `You are evaluating domain name suggestions against a quality checklist. Your goal is to:
1. Score each domain against the checklist criteria
2. Identify patterns in what's working and what's not
3. Suggest specific improvements to the Groq prompt

Here's the context:

USER QUERY: ${query}

DOMAIN QUALITY CHECKLIST:
${checklistContent}

CURRENT GROQ PROMPT:
${currentPrompt}

RESULTS:
- Suggested domains (shown to user): ${JSON.stringify(results.suggested, null, 2)}
- All attempted domains: ${JSON.stringify(results.attempted, null, 2)}
- Unavailable domains (would have been better): ${JSON.stringify(results.unavailable, null, 2)}

Please provide:
1. An evaluation of the suggested domains against the checklist
2. Analysis of why certain domains were unavailable (what patterns made them taken)
3. Specific improvements to the Groq prompt based on these results

Format your response as JSON:
{
  "evaluation": {
    "overallScore": 0-10,
    "averageAvailabilityRate": "percentage of domains that were available",
    "checklistCompliance": {
      "length": "X/Y domains meet length criteria",
      "brandability": "assessment",
      "tld": "X/Y are .com",
      "pronunciation": "X/Y pass radio test",
      // ... other criteria
    },
    "strengths": ["list of what's working well"],
    "weaknesses": ["list of issues"],
    "unavailablePatterns": ["why good domains were taken"]
  },
  "promptAnalysis": {
    "currentIssues": ["specific problems with current prompt"],
    "missedOpportunities": ["what the prompt should emphasize more"]
  },
  "improvedPrompt": {
    "summary": "Brief description of key changes",
    "specificChanges": [
      "ADD: specific instruction to add",
      "MODIFY: specific change to make",
      "REMOVE: specific instruction to remove"
    ],
    "fullPrompt": "The complete improved prompt with changes applied"
  },
  "expectedImprovements": ["list of expected outcomes from these changes"]
}`

    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: evaluationPrompt
        }
      ]
    })

    const responseContent = completion.content[0].type === 'text' 
      ? completion.content[0].text 
      : ''

    // Parse the JSON response
    try {
      const evaluation = JSON.parse(responseContent)
      
      // Log the evaluation results
      console.log('\n=== Domain Suggestion Evaluation ===')
      console.log(`Query: "${query}"`)
      console.log(`Overall Score: ${evaluation.evaluation.overallScore}/10`)
      console.log(`Availability Rate: ${evaluation.evaluation.averageAvailabilityRate}`)
      console.log('\nChecklist Compliance:')
      Object.entries(evaluation.evaluation.checklistCompliance).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value}`)
      })
      console.log('\nStrengths:')
      evaluation.evaluation.strengths.forEach((s: string) => console.log(`  ✓ ${s}`))
      console.log('\nWeaknesses:')
      evaluation.evaluation.weaknesses.forEach((w: string) => console.log(`  ✗ ${w}`))
      console.log('\nWhy good domains were unavailable:')
      evaluation.evaluation.unavailablePatterns.forEach((p: string) => console.log(`  - ${p}`))
      console.log('\n--- SUGGESTED IMPROVED PROMPT ---')
      console.log(evaluation.improvedPrompt.summary)
      console.log('\nSpecific changes:')
      evaluation.improvedPrompt.specificChanges.forEach((c: string) => console.log(`  ${c}`))
      console.log('\nFull improved prompt:')
      console.log('----------------------------------------')
      console.log(evaluation.improvedPrompt.fullPrompt)
      console.log('----------------------------------------')
      console.log('\nExpected improvements:')
      evaluation.expectedImprovements.forEach((i: string) => console.log(`  → ${i}`))
      console.log('=== End Evaluation ===\n')

      return NextResponse.json({ evaluation })
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError)
      console.error('Raw response:', responseContent)
      return NextResponse.json(
        { error: 'Failed to parse evaluation response' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Domain evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate domain suggestions' },
      { status: 500 }
    )
  }
}