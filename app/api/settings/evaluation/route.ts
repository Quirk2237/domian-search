import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// GET /api/settings/evaluation - Get evaluation enabled status
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'evaluation_enabled')
      .single()

    if (error) {
      // If setting doesn't exist, return default true
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: true })
      }
      throw error
    }

    return NextResponse.json({ 
      enabled: data?.value === true || data?.value === 'true' 
    })
  } catch (error) {
    console.error('Error fetching evaluation setting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation setting' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/evaluation - Update evaluation enabled status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean value' },
        { status: 400 }
      )
    }

    // Update or insert the setting
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'evaluation_enabled',
        value: enabled,
        description: 'Controls whether domain suggestions are automatically evaluated and prompts improved',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      enabled 
    })
  } catch (error) {
    console.error('Error updating evaluation setting:', error)
    return NextResponse.json(
      { error: 'Failed to update evaluation setting' },
      { status: 500 }
    )
  }
}