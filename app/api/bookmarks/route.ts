import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch user's bookmarks
    const { data: bookmarks, error } = await supabase
      .from("domain_bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bookmarks:", error)
      return NextResponse.json(
        { error: "Failed to fetch bookmarks" },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookmarks })
  } catch (error) {
    console.error("Unexpected error in GET /api/bookmarks:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { domain, extension, search_id } = body

    if (!domain || !extension) {
      return NextResponse.json(
        { error: "Domain and extension are required" },
        { status: 400 }
      )
    }

    // Create bookmark
    const { data: bookmark, error } = await supabase
      .from("domain_bookmarks")
      .insert({
        user_id: user.id,
        domain,
        extension,
        search_id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json(
          { error: "Domain already bookmarked" },
          { status: 409 }
        )
      }
      
      console.error("Error creating bookmark:", error)
      return NextResponse.json(
        { error: "Failed to create bookmark" },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookmark }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error in POST /api/bookmarks:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get bookmark ID from URL search params
    const { searchParams } = new URL(request.url)
    const bookmarkId = searchParams.get("id")
    const domain = searchParams.get("domain")
    const extension = searchParams.get("extension")

    if (!bookmarkId && (!domain || !extension)) {
      return NextResponse.json(
        { error: "Bookmark ID or domain/extension pair required" },
        { status: 400 }
      )
    }

    let deleteQuery = supabase
      .from("domain_bookmarks")
      .delete()
      .eq("user_id", user.id)

    if (bookmarkId) {
      deleteQuery = deleteQuery.eq("id", bookmarkId)
    } else {
      deleteQuery = deleteQuery.eq("domain", domain).eq("extension", extension)
    }

    const { error } = await deleteQuery

    if (error) {
      console.error("Error deleting bookmark:", error)
      return NextResponse.json(
        { error: "Failed to delete bookmark" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error in DELETE /api/bookmarks:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}