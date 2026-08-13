import type { ReactNode } from "react";
import { DashboardA, DashboardB, DashboardC } from "./dashboardVersions";
import { LogsPosters, LogsTable, LogsKanban } from "./logs";
import { StatsModules, StatsMomentum, StatsPace } from "./statistics";
import { ItemHero, ItemSplit, ItemProgress } from "./item";
import { SearchQuick, SearchBrowse, SearchGrouped } from "./search";
import { SettingsSearchable, SettingsSheets, SettingsAccount } from "./settings";
import { TiersCompare, TiersBenefit, TiersUsage } from "./plans";
import { AuthSplit, AuthOnboard, AuthBrand } from "./auth";
import { MarketCards, MarketRows, MarketMap } from "./market";
import { PublicProfileA, PublicProfileB, PublicProfileC } from "./profile";
import { LandingTour, LandingDemo, LandingStory } from "./landing";
import { QuickAddNav, QuickAddContext } from "./quickadd";
import { EditInline, EditWizard } from "./edit";
import { ReviewTemplate, ReviewDrafts } from "./review";
import { OnboardRamp, OnboardSpotlight, OnboardTaste } from "./onboarding";
import { ListingGallery, ListingSeller, ListingManager } from "./marketdetail";
import { InfoFaq, InfoContext, InfoTrust } from "./info";
import { FilterSheet, FilterBar, FilterRail } from "./filters";
import { DrawerSnapped, DrawerSteps, DrawerFloat } from "./drawers";

/** Full interactive desktop+mobile implementations, keyed by option id. */
export const PREVIEWS: Record<string, ReactNode> = {
  "dashboard-a": <DashboardA />,
  "dashboard-b": <DashboardB />,
  "dashboard-c": <DashboardC />,
  "logs-a": <LogsPosters />,
  "logs-b": <LogsTable />,
  "logs-c": <LogsKanban />,
  "stats-a": <StatsMomentum />,
  "stats-b": <StatsModules />,
  "stats-c": <StatsPace />,
  "item-a": <ItemHero />,
  "item-b": <ItemSplit />,
  "item-c": <ItemProgress />,
  "search-a": <SearchQuick />,
  "search-b": <SearchBrowse />,
  "search-c": <SearchGrouped />,
  "settings-a": <SettingsSearchable />,
  "settings-b": <SettingsSheets />,
  "settings-c": <SettingsAccount />,
  "tiers-a": <TiersCompare />,
  "tiers-b": <TiersBenefit />,
  "tiers-c": <TiersUsage />,
  "auth-a": <AuthSplit />,
  "auth-b": <AuthOnboard />,
  "auth-c": <AuthBrand />,
  "market-a": <MarketCards />,
  "market-b": <MarketRows />,
  "market-c": <MarketMap />,
  "profile-a": <PublicProfileA />,
  "profile-b": <PublicProfileB />,
  "profile-c": <PublicProfileC />,
  "landing-a": <LandingTour />,
  "landing-b": <LandingDemo />,
  "landing-c": <LandingStory />,
  "workflow-add-b": <QuickAddNav />,
  "workflow-add-c": <QuickAddContext />,
  "workflow-edit-b": <EditInline />,
  "workflow-edit-c": <EditWizard />,
  "workflow-review-b": <ReviewTemplate />,
  "workflow-review-c": <ReviewDrafts />,
  "onboarding-a": <OnboardRamp />,
  "onboarding-b": <OnboardSpotlight />,
  "onboarding-c": <OnboardTaste />,
  "market-detail-a": <ListingGallery />,
  "market-detail-b": <ListingSeller />,
  "market-detail-c": <ListingManager />,
  "info-a": <InfoFaq />,
  "info-b": <InfoContext />,
  "info-c": <InfoTrust />,
  "filters-a": <FilterSheet />,
  "filters-b": <FilterBar />,
  "filters-c": <FilterRail />,
  "drawers-a": <DrawerSnapped />,
  "drawers-b": <DrawerSteps />,
  "drawers-c": <DrawerFloat />,
};
