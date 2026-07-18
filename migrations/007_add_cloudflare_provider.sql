ALTER TABLE generation_jobs DROP CONSTRAINT generation_jobs_provider_check;
ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_provider_check CHECK (provider IN ('openai', 'gemini', 'cloudflare'));
