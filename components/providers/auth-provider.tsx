"use client"

import { MockAuthProvider } from "@/lib/auth-hooks"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <MockAuthProvider>{children}</MockAuthProvider>
}