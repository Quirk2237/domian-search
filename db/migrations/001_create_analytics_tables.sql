-- Create enum types
CREATE TYPE search_mode AS ENUM ('domain', 'suggestion');
CREATE TYPE prompt_type AS ENUM ('domain', 'suggestion');

-- Create prompt_versions table
CREATE TABLE prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER UNIQUE NOT NULL,
  prompt_type prompt_type NOT NULL,
  prompt_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE
);

-- Add unique constraint for active prompts per type
CREATE UNIQUE INDEX unique_active_prompt_per_type 
ON prompt_versions (prompt_type, is_active) 
WHERE is_active = TRUE;

-- Create domain_searches table
CREATE TABLE domain_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  query TEXT NOT NULL,
  search_mode search_mode NOT NULL,
  prompt_version_id UUID REFERENCES prompt_versions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create domain_suggestions table
CREATE TABLE domain_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id UUID REFERENCES domain_searches(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  extension TEXT NOT NULL,
  available BOOLEAN NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create domain_clicks table
CREATE TABLE domain_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID REFERENCES domain_suggestions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_domain_searches_session_id ON domain_searches(session_id);
CREATE INDEX idx_domain_searches_search_mode ON domain_searches(search_mode);
CREATE INDEX idx_domain_searches_created_at ON domain_searches(created_at);
CREATE INDEX idx_domain_suggestions_search_id ON domain_suggestions(search_id);
CREATE INDEX idx_domain_suggestions_available ON domain_suggestions(available);
CREATE INDEX idx_domain_clicks_suggestion_id ON domain_clicks(suggestion_id);
CREATE INDEX idx_domain_clicks_session_id ON domain_clicks(session_id);
CREATE INDEX idx_prompt_versions_active ON prompt_versions(prompt_type, is_active) WHERE is_active = TRUE;