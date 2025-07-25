// MVP mode auth utilities
// These provide mock implementations when Clerk is disabled

export const mvpAuth = () => {
  return {
    userId: "demo-user",
    sessionId: "demo-session",
    orgId: null,
    orgRole: null,
    orgSlug: null,
    has: () => true,
    redirectToSignIn: () => {
      // In MVP mode, just redirect to home
      return { redirect: { destination: "/", permanent: false } }
    }
  }
}

export const mvpCurrentUser = async () => {
  return {
    id: "demo-user",
    emailAddresses: [{ emailAddress: "demo@example.com" }],
    firstName: "Demo",
    lastName: "User",
    username: "demo-user",
    profileImageUrl: null
  }
}