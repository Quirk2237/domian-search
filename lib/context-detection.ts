import { getProjectUrl, getAnonKey } from './supabase-config'

export interface NLPAnalysisResult {
  entities: Array<{
    name: string
    type: string
    salience: number
  }>
  categories: Array<{
    name: string
    confidence: number
  }>
  sentiment: {
    magnitude: number
    score: number
  }
  context: {
    primary_category: string
    domain_type: 'religious' | 'educational' | 'business' | 'tech' | 'creative' | 'health' | 'general'
    key_entities: string[]
    suggested_extensions: string[]
  }
}

export interface DomainContext {
  type: 'religious' | 'educational' | 'business' | 'tech' | 'creative' | 'health' | 'general'
  primary_category: string
  key_entities: string[]
  suggested_extensions: string[]
  prompt_strategy: string
  entity_keywords: string[]
}

/**
 * Calls the NLP analysis edge function to analyze query context
 */
export async function analyzeQueryContext(query: string): Promise<NLPAnalysisResult | null> {
  try {
    const projectUrl = await getProjectUrl()
    const anonKey = getAnonKey()
    const response = await fetch(`${projectUrl}/functions/v1/analyze-query-nlp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      console.error('NLP analysis failed:', response.status, await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error calling NLP analysis:', error)
    return null
  }
}

/**
 * Maps NLP analysis result to domain context with prompt strategy
 */
export function mapToDomainContext(nlpResult: NLPAnalysisResult): DomainContext {
  const { context } = nlpResult
  
  // Define prompt strategies for each domain type
  const promptStrategies: Record<string, string> = {
    religious: 'focus_on_trust_community_learning',
    educational: 'focus_on_knowledge_authority_accessibility', 
    business: 'focus_on_professionalism_efficiency_growth',
    tech: 'focus_on_innovation_scalability_modern',
    creative: 'focus_on_inspiration_expression_artistic',
    health: 'focus_on_care_wellness_trust',
    general: 'balanced_approach_versatile'
  }

  // Extract entity keywords for domain generation
  const entityKeywords = nlpResult.entities
    .filter(entity => entity.salience > 0.2) // High salience entities
    .map(entity => entity.name.toLowerCase())
    .concat(context.key_entities)
    .filter((keyword, index, array) => array.indexOf(keyword) === index) // Remove duplicates

  return {
    type: context.domain_type,
    primary_category: context.primary_category,
    key_entities: context.key_entities,
    suggested_extensions: context.suggested_extensions,
    prompt_strategy: promptStrategies[context.domain_type] || 'balanced_approach_versatile',
    entity_keywords: entityKeywords
  }
}

/**
 * Fallback context detection for when NLP analysis fails
 */
export function detectContextFallback(query: string): DomainContext {
  const lowerQuery = query.toLowerCase()
  
  // Religious terms
  const religiousTerms = [
    'gemara', 'talmud', 'torah', 'daf', 'mishna', 'halacha', 'jewish', 'judaism',
    'bible', 'christian', 'islam', 'muslim', 'buddhist', 'hindu', 'prayer',
    'spiritual', 'faith', 'worship', 'church', 'mosque', 'temple', 'synagogue'
  ]
  
  // Educational terms
  const educationalTerms = [
    'learn', 'study', 'education', 'school', 'university', 'course', 'training',
    'academy', 'institute', 'tutorial', 'lesson', 'class', 'student', 'teacher'
  ]
  
  // Tech terms
  const techTerms = [
    'app', 'software', 'tech', 'digital', 'platform', 'api', 'code', 'dev',
    'startup', 'saas', 'cloud', 'ai', 'ml', 'data', 'analytics', 'mobile'
  ]
  
  // Business terms
  const businessTerms = [
    'business', 'company', 'corporate', 'enterprise', 'professional', 'service',
    'consulting', 'finance', 'marketing', 'sales', 'management', 'strategy'
  ]
  
  // Health terms
  const healthTerms = [
    'health', 'medical', 'wellness', 'fitness', 'doctor', 'clinic', 'therapy',
    'care', 'healing', 'nutrition', 'exercise', 'mental', 'physical'
  ]
  
  // Creative terms
  const creativeTerms = [
    'art', 'design', 'creative', 'studio', 'gallery', 'music', 'photo',
    'video', 'film', 'write', 'author', 'artist', 'craft', 'portfolio'
  ]

  // Check for matches
  const words = lowerQuery.split(/\s+/)
  
  if (religiousTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'religious',
      primary_category: '/People & Society/Religion & Belief',
      key_entities: words.filter(word => religiousTerms.includes(word)),
      suggested_extensions: ['.org', '.com', '.edu'],
      prompt_strategy: 'focus_on_trust_community_learning',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  if (educationalTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'educational',
      primary_category: '/Jobs & Education/Education',
      key_entities: words.filter(word => educationalTerms.includes(word)),
      suggested_extensions: ['.edu', '.org', '.com'],
      prompt_strategy: 'focus_on_knowledge_authority_accessibility',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  if (techTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'tech',
      primary_category: '/Computers & Electronics',
      key_entities: words.filter(word => techTerms.includes(word)),
      suggested_extensions: ['.com', '.io', '.app', '.dev'],
      prompt_strategy: 'focus_on_innovation_scalability_modern',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  if (businessTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'business',
      primary_category: '/Business & Industrial',
      key_entities: words.filter(word => businessTerms.includes(word)),
      suggested_extensions: ['.com', '.co', '.biz'],
      prompt_strategy: 'focus_on_professionalism_efficiency_growth',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  if (healthTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'health',
      primary_category: '/Health',
      key_entities: words.filter(word => healthTerms.includes(word)),
      suggested_extensions: ['.com', '.health', '.care'],
      prompt_strategy: 'focus_on_care_wellness_trust',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  if (creativeTerms.some(term => lowerQuery.includes(term))) {
    return {
      type: 'creative',
      primary_category: '/Arts & Entertainment',
      key_entities: words.filter(word => creativeTerms.includes(word)),
      suggested_extensions: ['.com', '.art', '.studio'],
      prompt_strategy: 'focus_on_inspiration_expression_artistic',
      entity_keywords: words.slice(0, 3)
    }
  }
  
  // Default to general context
  return {
    type: 'general',
    primary_category: '/General',
    key_entities: words.slice(0, 2),
    suggested_extensions: ['.com', '.net', '.org'],
    prompt_strategy: 'balanced_approach_versatile',
    entity_keywords: words.slice(0, 3)
  }
}

/**
 * Main function to get domain context with fallback
 */
export async function getDomainContext(query: string): Promise<DomainContext> {
  try {
    // Try NLP analysis first
    const nlpResult = await analyzeQueryContext(query)
    
    if (nlpResult) {
      return mapToDomainContext(nlpResult)
    }
    
    // Fallback to keyword-based detection
    console.log('Using fallback context detection')
    return detectContextFallback(query)
  } catch (error) {
    console.error('Error in context detection:', error)
    return detectContextFallback(query)
  }
}