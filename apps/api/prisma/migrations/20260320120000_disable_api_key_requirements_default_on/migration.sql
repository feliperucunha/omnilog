-- Default relaxed API-key UX for new signups and environments that expect optional keys.
UPDATE "FeatureFlag"
SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'disable_api_key_requirements';
