-- Monthly recap emails: default on; users can disable in settings.
ALTER TABLE "User" ADD COLUMN "recapEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
