#!/bin/bash

# Script to apply RLS policies for analytics tables
# This script can be run to apply the RLS policies to your Supabase database

echo "Applying RLS policies for analytics tables..."

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed. Please install it first."
    echo "Run: npm install -g supabase"
    exit 1
fi

# Apply the migration using Supabase CLI
echo "Running migration: 002_create_analytics_rls_policies.sql"

# For local development
if [ "$1" = "local" ]; then
    echo "Applying to local Supabase instance..."
    supabase db reset --local
    echo "Local database reset and migrations applied."
else
    # For production/remote database
    echo "Applying to remote Supabase instance..."
    supabase db push
    echo "Remote database migrations applied."
fi

echo "✅ RLS policies have been successfully applied!"
echo ""
echo "The following tables now have public read access for analytics:"
echo "- domain_searches"
echo "- domain_suggestions" 
echo "- domain_clicks"
echo "- prompt_versions"
echo ""
echo "Your analytics endpoint should now work correctly with the anon key."