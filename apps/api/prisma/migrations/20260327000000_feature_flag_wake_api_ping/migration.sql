INSERT INTO "FeatureFlag" ("id", "key", "enabled", "updatedAt")
SELECT 'clff_wake_api_ping', 'wake_api_ping', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'wake_api_ping');
