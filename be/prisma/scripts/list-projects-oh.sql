SELECT code, name FROM projects WHERE "deletedAt" IS NULL AND (code ILIKE '%OH%' OR name ILIKE '%OH%') ORDER BY code;
