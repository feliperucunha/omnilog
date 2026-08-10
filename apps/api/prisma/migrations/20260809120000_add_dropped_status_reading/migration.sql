-- Add the "dropped" status to books, manga, and comics.
-- log.status is a plain TEXT column in postgres, so no schema change is required;
-- this migration documents the allowed statuses per category as a DB CHECK constraint
-- mirroring LOG_STATUS_OPTIONS in packages/shared/src/types.ts so the app and DB stay in sync.

-- books: read, plan to read, reading, dropped
ALTER TABLE "Log"
  DROP CONSTRAINT IF EXISTS "Log_status_valid_books";
ALTER TABLE "Log"
  ADD CONSTRAINT "Log_status_valid_books"
  CHECK (
    "mediaType" <> 'books'
    OR "status" IS NULL
    OR "status" IN ('read', 'plan to read', 'reading', 'dropped')
  );

-- manga: read, plan to read, reading, dropped
ALTER TABLE "Log"
  DROP CONSTRAINT IF EXISTS "Log_status_valid_manga";
ALTER TABLE "Log"
  ADD CONSTRAINT "Log_status_valid_manga"
  CHECK (
    "mediaType" <> 'manga'
    OR "status" IS NULL
    OR "status" IN ('read', 'plan to read', 'reading', 'dropped')
  );

-- comics: read, plan to read, reading, dropped
ALTER TABLE "Log"
  DROP CONSTRAINT IF EXISTS "Log_status_valid_comics";
ALTER TABLE "Log"
  ADD CONSTRAINT "Log_status_valid_comics"
  CHECK (
    "mediaType" <> 'comics'
    OR "status" IS NULL
    OR "status" IN ('read', 'plan to read', 'reading', 'dropped')
  );