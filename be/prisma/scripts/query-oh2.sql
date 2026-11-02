SELECT id, code, name FROM projects WHERE "deletedAt" IS NULL AND (code ILIKE '%OH2%' OR name ILIKE '%OH2%') LIMIT 10;
