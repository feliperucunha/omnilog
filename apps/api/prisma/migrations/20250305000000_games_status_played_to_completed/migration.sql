-- Rename games status "played" to "completed" (UI now uses "completed" for games)
UPDATE "Log"
SET status = 'completed'
WHERE "mediaType" = 'games' AND status = 'played';
