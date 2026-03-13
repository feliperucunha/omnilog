# Gamification tables: what’s still necessary

## Summary

| System | Tables | Still necessary? | Notes |
|--------|--------|------------------|--------|
| **Milestone** | `Milestone` | **Yes** | Drives dashboard/MediaLogs progress (next milestone, earned labels, %). Seeded on startup; read by `getMilestoneProgress`. |
| **Badge (earned)** | `Badge`, `UserBadge` | **Partially** | Badge definitions are seeded. **No code creates `UserBadge`** (handleReviewCreated/handleLogCreated return `[]`). So “earned badges” are always empty. `Badge` is still used to resolve `User.selectedBadgeIds` for **profile display** (public profile + Settings). |
| **XP / level** | ~~UserXp~~, ~~User.xpTotal~~, ~~User.level~~ | **Removed** | Migration `20260227140000_remove_unused_xp_level` and `supabase-remove-xp-level.sql` drop these. Reviewer level comes from UserReviewStats via `reviewerLevel.service.ts`. |

## Details

### Milestone (keep)
- **Used by:** `GET /me/milestones/progress`, Dashboard, MediaLogs.
- **Written by:** `runSeedMilestones()` on API startup.
- **Read by:** `milestone.service.getMilestoneProgress()` (plus UserReviewStats and Log counts).

### Badge + UserBadge
- **Badge:** Seeded by `runSeedBadges()`. Used when loading public profile: we resolve `User.selectedBadgeIds` to badge rows to show name/icon/medium. So the **Badge** table is still used for profile display.
- **UserBadge:** Only **read** (GET /me/badges, Settings “earned badges”). Nothing in the codebase **creates** UserBadge rows anymore. So the “earned badges” list is always empty unless you re-enable granting.

### UserXp + User.xpTotal / User.level (removed)
- **Removed** by migration `20260227140000_remove_unused_xp_level` and `supabase-remove-xp-level.sql`.
- Reviewer level (e.g. “Critic”, “Expert”) comes from **UserReviewStats.totalReviews** via `reviewerLevel.service.ts`.

## Options

1. **Keep as-is**  
   Milestone stays. Badge/UserBadge stay for profile display and possible future “earned badges”. UserXp and User level/xpTotal remain unused (no behavioral change).

2. **Remove XP/level**  
   Done: `UserXp` dropped, `xpTotal`/`level` removed from User, `grantXp()` removed from gamification.service.

3. **Simplify profile badges**  
   If you don’t plan to use “earned badges” again, you could stop using Badge/UserBadge for profile and instead let users pick from **milestone labels** (or a fixed list of icons). Then you could remove or shrink the Badge/UserBadge usage.

4. **Re-enable earned badges**  
   Keep Badge + UserBadge and have handleReviewCreated / handleLogCreated (or a separate job) create UserBadge rows when conditions are met, so “earned badges” and profile selection work again.
