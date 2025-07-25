import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// MVP-only middleware without Clerk imports
export default function middleware(req: NextRequest) {
  // In MVP mode, just pass through all requests
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
}