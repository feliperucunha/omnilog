-- Beta tier: Pro-equivalent features with the same 500-log cap as free.
ALTER TYPE "Tier" ADD VALUE IF NOT EXISTS 'beta';

-- When enabled, new signups get tier `beta`; when disabled, `free`. Toggle in admin Settings → Feature flags.
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "updatedAt")
VALUES ('clff_register_new_users_as_beta', 'register_new_users_as_beta', false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
