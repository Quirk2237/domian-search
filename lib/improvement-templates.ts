import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple in-memory cache for improvement templates
interface TemplateCacheEntry {
  content: string
  timestamp: number
}

const templateCache = new Map<string, TemplateCacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getActiveImprovementTemplate(type: 'domain' | 'suggestion'): Promise<string> {
  // Check cache first
  const cacheKey = `improvement_template:${type}`
  const cached = templateCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content
  }

  try {
    // Query database for active improvement template
    const { data, error } = await supabase
      .from('prompt_improvement_templates')
      .select('template_content')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new Error(`No active improvement template found for type: ${type}`)
    }

    // Cache the result
    templateCache.set(cacheKey, {
      content: data.template_content,
      timestamp: Date.now()
    })

    return data.template_content
  } catch (error) {
    console.error(`Error fetching improvement template for ${type}:`, error)
    throw error
  }
}

export async function createNewImprovementTemplate(
  type: 'domain' | 'suggestion',
  templateContent: string,
  improvementNotes: string
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  try {
    // Get current active template to determine next version
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('prompt_improvement_templates')
      .select('id, version')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    const newVersion = currentTemplate ? currentTemplate.version + 1 : 1

    // Start transaction: deactivate current template
    if (currentTemplate) {
      const { error: updateError } = await supabase
        .from('prompt_improvement_templates')
        .update({ is_active: false })
        .eq('id', currentTemplate.id)

      if (updateError) {
        throw new Error(`Failed to deactivate current template: ${updateError.message}`)
      }
    }

    // Create new template version
    const { data: newTemplate, error: insertError } = await supabase
      .from('prompt_improvement_templates')
      .insert({
        version: newVersion,
        prompt_type: type,
        template_content: templateContent,
        is_active: true,
        improvement_notes: improvementNotes,
        previous_version_id: currentTemplate?.id || null
      })
      .select()
      .single()

    if (insertError) {
      // Rollback: reactivate the old template if there was one
      if (currentTemplate) {
        await supabase
          .from('prompt_improvement_templates')
          .update({ is_active: true })
          .eq('id', currentTemplate.id)
      }
      throw new Error(`Failed to create new template: ${insertError.message}`)
    }

    // Clear cache
    clearImprovementTemplateCache()

    return {
      success: true,
      newVersion: newVersion
    }
  } catch (error) {
    console.error('Error creating new improvement template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function getAllImprovementTemplates(type?: 'domain' | 'suggestion') {
  try {
    let query = supabase
      .from('prompt_improvement_templates')
      .select('*')
      .order('version', { ascending: false })

    if (type) {
      query = query.eq('prompt_type', type)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return { success: true, templates: data }
  } catch (error) {
    console.error('Error fetching improvement templates:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function getImprovementTemplateById(id: string) {
  try {
    const { data, error } = await supabase
      .from('prompt_improvement_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error('Template not found')
    }

    return { success: true, template: data }
  } catch (error) {
    console.error('Error fetching improvement template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function setActiveImprovementTemplate(id: string, type: 'domain' | 'suggestion') {
  try {
    // Deactivate all templates of this type
    const { error: deactivateError } = await supabase
      .from('prompt_improvement_templates')
      .update({ is_active: false })
      .eq('prompt_type', type)

    if (deactivateError) {
      throw deactivateError
    }

    // Activate the specified template
    const { error: activateError } = await supabase
      .from('prompt_improvement_templates')
      .update({ is_active: true })
      .eq('id', id)
      .eq('prompt_type', type)

    if (activateError) {
      throw activateError
    }

    // Clear cache
    clearImprovementTemplateCache()

    return { success: true }
  } catch (error) {
    console.error('Error setting active improvement template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Clear cache (useful for testing or when templates are updated)
export function clearImprovementTemplateCache() {
  templateCache.clear()
}

// Get improvement template ID for tracking
export async function getActiveImprovementTemplateId(type: 'domain' | 'suggestion'): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('prompt_improvement_templates')
      .select('id')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new Error(`No active improvement template found for type: ${type}`)
    }

    return data.id
  } catch (error) {
    console.error(`Error fetching improvement template ID for ${type}:`, error)
    throw error
  }
} 