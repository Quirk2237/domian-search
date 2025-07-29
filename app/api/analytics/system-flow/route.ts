import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use anon key for read operations
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    // Check for required environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const versionId = searchParams.get('versionId')
    
    // If specific version requested, return that version's content
    if (versionId) {
      const { data: versionData, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('id', versionId)
        .single()
      
      if (error || !versionData) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({ version: versionData })
    }
    // Fetch current active prompt version
    const { data: activePrompt, error: promptError } = await supabase
      .from('prompt_versions')
      .select(`
        id,
        version,
        prompt_type,
        prompt_content,
        created_at,
        improvement_notes,
        previous_version_id,
        trigger_score_id
      `)
      .eq('prompt_type', 'suggestion')
      .eq('is_active', true)
      .single()

    if (promptError) {
      console.error('Error fetching active prompt:', promptError)
    }

    // Fetch prompt version history with all versions
    const { data: promptHistory, error: historyError } = await supabase
      .from('prompt_versions')
      .select(`
        id,
        version,
        created_at,
        improvement_notes,
        trigger_score_id,
        domain_search_scores (
          overall_score,
          score_details
        )
      `)
      .eq('prompt_type', 'suggestion')
      .order('version', { ascending: false })
      .limit(50)

    if (historyError) {
      console.error('Error fetching prompt history:', historyError)
    }

    // Fetch active checklist version
    const { data: activeChecklist, error: checklistError } = await supabase
      .from('quality_checklist_versions')
      .select(`
        id,
        version,
        checklist_content,
        created_at
      `)
      .eq('is_active', true)
      .single()

    if (checklistError) {
      console.error('Error fetching active checklist:', checklistError)
    }

    // Fetch active improvement template
    const { data: activeTemplate, error: templateError } = await supabase
      .from('prompt_improvement_templates')
      .select(`
        id,
        version,
        template_content,
        created_at,
        improvement_notes
      `)
      .eq('prompt_type', 'suggestion')
      .eq('is_active', true)
      .single()

    if (templateError) {
      console.error('Error fetching active template:', templateError)
    }

    // Fetch recent domain searches with scores
    const { data: recentSearches, error: searchError } = await supabase
      .from('domain_searches')
      .select(`
        id,
        query,
        search_mode,
        created_at,
        llm_model,
        llm_temperature,
        total_tokens,
        groq_cost,
        domain_search_scores (
          overall_score,
          score_details
        ),
        domain_suggestions (
          id,
          domain,
          available
        )
      `)
      .eq('search_mode', 'suggestion')
      .order('created_at', { ascending: false })
      .limit(20)

    if (searchError) {
      console.error('Error fetching recent searches:', searchError)
    }

    // Calculate metrics - only from searches that have been scored
    const scoredSearches = recentSearches?.filter(
      search => search.domain_search_scores && search.domain_search_scores.length > 0
    ) || []
    
    const recentScores = scoredSearches
      .map(search => search.domain_search_scores![0].overall_score)
      .filter(score => score !== null && score !== undefined)
    
    const avgRecentScore = recentScores.length > 0 
      ? recentScores.reduce((a, b) => a + parseFloat(b), 0) / recentScores.length
      : 0

    // Get improvement frequency (searches that triggered improvements)
    const improvementsTriggered = promptHistory?.filter(
      version => version.trigger_score_id !== null
    ).length || 0

    // Get model/temperature distribution - only from scored searches
    const modelStats = scoredSearches.reduce((acc, search) => {
      const key = `${search.llm_model || 'unknown'}@${search.llm_temperature || '0.7'}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Build response
    const response = {
      currentState: {
        prompt: activePrompt ? {
          version: activePrompt.version,
          id: activePrompt.id,
          createdAt: activePrompt.created_at,
          improvementNotes: activePrompt.improvement_notes,
          content: activePrompt.prompt_content
        } : null,
        checklist: activeChecklist ? {
          version: activeChecklist.version,
          id: activeChecklist.id,
          createdAt: activeChecklist.created_at,
          content: activeChecklist.checklist_content
        } : null,
        improvementTemplate: activeTemplate ? {
          version: activeTemplate.version,
          id: activeTemplate.id,
          createdAt: activeTemplate.created_at,
          content: activeTemplate.template_content,
          notes: activeTemplate.improvement_notes
        } : null
      },
      metrics: {
        averageRecentScore: avgRecentScore.toFixed(2),
        totalSearches: scoredSearches.length,
        improvementsTriggered,
        improvementRate: promptHistory && promptHistory.length > 0 ? 
          ((improvementsTriggered / promptHistory.length) * 100).toFixed(1) : '0',
        modelDistribution: modelStats
      },
      versionHistory: promptHistory?.map(version => ({
        id: version.id,
        version: version.version,
        createdAt: version.created_at,
        improvementNotes: version.improvement_notes,
        triggerScore: version.domain_search_scores?.[0]?.overall_score || null,
        scoreDetails: version.domain_search_scores?.[0]?.score_details || null
      })) || [],
      recentActivity: recentSearches?.slice(0, 5).map(search => ({
        query: search.query,
        createdAt: search.created_at,
        model: search.llm_model,
        temperature: search.llm_temperature,
        score: search.domain_search_scores?.[0]?.overall_score || null,
        domainCount: search.domain_suggestions?.length || 0,
        availableCount: search.domain_suggestions?.filter(d => d.available).length || 0
      })) || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in system flow API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint for updating versions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, content, notes } = body

    if (!type || !id || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id, content' },
        { status: 400 }
      )
    }

    switch (type) {
      case 'activate': {
        // Activate a specific version
        const { data: version, error: fetchError } = await supabase
          .from('prompt_versions')
          .select('prompt_type')
          .eq('id', id)
          .single()

        if (fetchError || !version) {
          return NextResponse.json(
            { error: 'Version not found' },
            { status: 404 }
          )
        }

        // Deactivate all versions of this type
        await supabase
          .from('prompt_versions')
          .update({ is_active: false })
          .eq('prompt_type', version.prompt_type)

        // Activate the selected version
        const { error: updateError } = await supabase
          .from('prompt_versions')
          .update({ is_active: true })
          .eq('id', id)

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to activate version' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Version activated successfully'
        })
      }

      case 'prompt': {
        // Get current version
        const { data: current, error: fetchError } = await supabase
          .from('prompt_versions')
          .select('version, prompt_type')
          .eq('id', id)
          .single()

        if (fetchError || !current) {
          return NextResponse.json(
            { error: 'Prompt version not found' },
            { status: 404 }
          )
        }

        // Deactivate current version
        await supabase
          .from('prompt_versions')
          .update({ is_active: false })
          .eq('prompt_type', current.prompt_type)
          .eq('is_active', true)

        // Create new version
        const { data: newVersion, error: createError } = await supabase
          .from('prompt_versions')
          .insert({
            version: current.version + 1,
            prompt_type: current.prompt_type,
            prompt_content: content,
            is_active: true,
            improvement_notes: notes || `Manual update via System Flow UI`,
            previous_version_id: id
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json(
            { error: 'Failed to create new version' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          newVersion: newVersion.version,
          id: newVersion.id
        })
      }

      case 'checklist': {
        // Get current version
        const { data: current, error: fetchError } = await supabase
          .from('quality_checklist_versions')
          .select('version')
          .eq('id', id)
          .single()

        if (fetchError || !current) {
          return NextResponse.json(
            { error: 'Checklist version not found' },
            { status: 404 }
          )
        }

        // Deactivate current version
        await supabase
          .from('quality_checklist_versions')
          .update({ is_active: false })
          .eq('is_active', true)

        // Create new version
        const { data: newVersion, error: createError } = await supabase
          .from('quality_checklist_versions')
          .insert({
            version: current.version + 1,
            checklist_content: content,
            is_active: true
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json(
            { error: 'Failed to create new version' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          newVersion: newVersion.version,
          id: newVersion.id
        })
      }

      case 'template': {
        // Get current version
        const { data: current, error: fetchError } = await supabase
          .from('prompt_improvement_templates')
          .select('version, prompt_type')
          .eq('id', id)
          .single()

        if (fetchError || !current) {
          return NextResponse.json(
            { error: 'Template version not found' },
            { status: 404 }
          )
        }

        // Deactivate current version
        await supabase
          .from('prompt_improvement_templates')
          .update({ is_active: false })
          .eq('prompt_type', current.prompt_type)
          .eq('is_active', true)

        // Create new version
        const { data: newVersion, error: createError } = await supabase
          .from('prompt_improvement_templates')
          .insert({
            version: current.version + 1,
            prompt_type: current.prompt_type,
            template_content: content,
            is_active: true,
            improvement_notes: notes || `Manual update via System Flow UI`,
            previous_version_id: id
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json(
            { error: 'Failed to create new version' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          newVersion: newVersion.version,
          id: newVersion.id
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: prompt, checklist, or template' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}