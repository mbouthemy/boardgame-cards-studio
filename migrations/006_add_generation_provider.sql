ALTER TABLE generation_jobs ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'gemini'));
