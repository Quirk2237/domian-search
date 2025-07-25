import { config } from "dotenv"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { customers } from "./schema/customers"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
const isMvpMode = process.env.NEXT_PUBLIC_MVP_MODE === "true"

// In MVP mode or during build without DATABASE_URL, create a mock db object
if (!databaseUrl && (isMvpMode || process.env.NODE_ENV === "production")) {
  console.warn("DATABASE_URL not set - running in MVP mode or build time")
}

const dbSchema = {
  // tables
  customers
  // relations
}

function initializeDb(url: string) {
  const client = postgres(url, { prepare: false })
  return drizzlePostgres(client, { schema: dbSchema })
}

// Only throw error if not in MVP mode and not during build
if (!databaseUrl && !isMvpMode && process.env.NODE_ENV !== "production") {
  throw new Error("DATABASE_URL is not set")
}

// Create db instance only if we have a database URL
export const db = databaseUrl ? initializeDb(databaseUrl) : null
