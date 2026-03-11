-- AlterEnum: add log-based badge condition types to BadgeConditionType
ALTER TYPE "BadgeConditionType" ADD VALUE 'LOG_COUNT_PER_MEDIA';
ALTER TYPE "BadgeConditionType" ADD VALUE 'LOG_COUNT_GLOBAL';
ALTER TYPE "BadgeConditionType" ADD VALUE 'LOG_MEDIA_TYPES_LOGGED';
