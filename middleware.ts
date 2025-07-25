import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])

// Simple middleware for MVP mode
function mvpMiddleware(req: NextRequest) {
  return NextResponse.next()
}

// Check if we're in MVP mode
const isMvpMode = process.env.NEXT_PUBLIC_MVP_MODE === "true"

// Use MVP middleware if in MVP mode, otherwise use Clerk
export default isMvpMode 
  ? mvpMiddleware
  : clerkMiddleware(async (auth, req) => {
      const { userId, redirectToSignIn } = await auth()

      if (!userId && isProtectedRoute(req)) {
        return redirectToSignIn()
      }

      return NextResponse.next()
    })

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
}