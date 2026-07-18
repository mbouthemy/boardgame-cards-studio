-- Existing installations may have applied 001 before anonymous browser IDs were added.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
