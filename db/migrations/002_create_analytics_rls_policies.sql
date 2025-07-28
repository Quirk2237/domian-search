-- Enable Row Level Security on analytics tables
ALTER TABLE domain_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access on analytics tables

-- Policy for domain_searches table
CREATE POLICY "Allow public read access for analytics" ON domain_searches
    FOR SELECT
    TO anon
    USING (true);

-- Policy for domain_suggestions table  
CREATE POLICY "Allow public read access for analytics" ON domain_suggestions
    FOR SELECT
    TO anon
    USING (true);

-- Policy for domain_clicks table
CREATE POLICY "Allow public read access for analytics" ON domain_clicks
    FOR SELECT
    TO anon
    USING (true);

-- Policy for prompt_versions table (needed for analytics joins)
CREATE POLICY "Allow public read access for analytics" ON prompt_versions
    FOR SELECT
    TO anon
    USING (true);

-- Grant SELECT permissions to anon role
GRANT SELECT ON domain_searches TO anon;
GRANT SELECT ON domain_suggestions TO anon;
GRANT SELECT ON domain_clicks TO anon;
GRANT SELECT ON prompt_versions TO anon;