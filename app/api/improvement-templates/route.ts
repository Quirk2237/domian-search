import { NextRequest, NextResponse } from 'next/server'
import { 
  getAllImprovementTemplates, 
  getActiveImprovementTemplate,
  createNewImprovementTemplate,
  getImprovementTemplateById,
  setActiveImprovementTemplate
} from '@/lib/improvement-templates'

// GET /api/improvement-templates - List all templates or get active template
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'domain' | 'suggestion' | null
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const templateId = searchParams.get('id')

    // Get specific template by ID
    if (templateId) {
      const result = await getImprovementTemplateById(templateId)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 404 }
        )
      }
      return NextResponse.json({ template: result.template })
    }

    // Get active template only
    if (activeOnly && type) {
      try {
        const templateContent = await getActiveImprovementTemplate(type)
        return NextResponse.json({ 
          template_content: templateContent,
          type: type,
          active: true
        })
      } catch (error) {
        return NextResponse.json(
          { error: `No active template found for type: ${type}` },
          { status: 404 }
        )
      }
    }

    // Get all templates
    const result = await getAllImprovementTemplates(type || undefined)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: result.templates })
  } catch (error) {
    console.error('Error in GET /api/improvement-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/improvement-templates - Create new template version
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, template_content, improvement_notes } = body

    // Validate required fields
    if (!type || !template_content) {
      return NextResponse.json(
        { error: 'type and template_content are required' },
        { status: 400 }
      )
    }

    if (!['domain', 'suggestion'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be either "domain" or "suggestion"' },
        { status: 400 }
      )
    }

    if (template_content.length < 100) {
      return NextResponse.json(
        { error: 'template_content must be at least 100 characters long' },
        { status: 400 }
      )
    }

    // Create new template version
    const result = await createNewImprovementTemplate(
      type,
      template_content,
      improvement_notes || `Updated template via API at ${new Date().toISOString()}`
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Created new template version ${result.newVersion}`,
      version: result.newVersion,
      type: type
    })
  } catch (error) {
    console.error('Error in POST /api/improvement-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/improvement-templates - Set active template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_id, type } = body

    if (!template_id || !type) {
      return NextResponse.json(
        { error: 'template_id and type are required' },
        { status: 400 }
      )
    }

    if (!['domain', 'suggestion'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be either "domain" or "suggestion"' },
        { status: 400 }
      )
    }

    const result = await setActiveImprovementTemplate(template_id, type)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Set template ${template_id} as active for type ${type}`
    })
  } catch (error) {
    console.error('Error in PUT /api/improvement-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 