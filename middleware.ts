import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])

// Wrap the middleware to check MVP mode at runtime
export default function middleware(req: NextRequest) {
  // Check MVP mode at runtime, not build time
  const isMvpMode = process.env.NEXT_PUBLIC_MVP_MODE === "true"
  
  if (isMvpMode) {
    // Simple pass-through for MVP mode
    return NextResponse.next()
  }
  
  // Use Clerk middleware when not in MVP mode
  return clerkMiddleware(async (auth, req) => {
    const { userId, redirectToSignIn } = await auth()

    if (!userId && isProtectedRoute(req)) {
      return redirectToSignIn()
    }

    return NextResponse.next()
  })(req, {} as any)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
}