-- Add cost tracking columns to domain_searches table
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS llm_model text;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS llm_temperature numeric(3,2);
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS total_tokens integer DEFAULT 0;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS groq_cost numeric(10,6) DEFAULT 0;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS domainr_requests integer DEFAULT 0;
ALTER TABLE domain_searches ADD COLUMN IF NOT EXISTS total_cost numeric(10,6) DEFAULT 0;

-- Create api_usage_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid REFERENCES domain_searches(id) ON DELETE CASCADE,
  provider text NOT NULL,
  endpoint text NOT NULL,
  model text,
  temperature numeric(3,2),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cost numeric(10,6),
  response_time_ms integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_search_id ON api_usage_logs(search_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON api_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_domain_searches_total_cost ON domain_searches(total_cost);