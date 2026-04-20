import {
  decodeHtmlEntities,
  type ItemDetail,
  type ItemPageData,
  type ItemReview,
  type Log,
  type SearchResult,
} from "@geeklogs/shared";

const d = decodeHtmlEntities;

const decodeStrList = (arr: string[] | null | undefined): string[] | null | undefined =>
  arr?.length ? arr.map((x) => d(x)) : arr;

/** Ensures titles/reviews show apostrophes etc. even if the API or cache still has HTML entities. */
export function decodeLogForDisplay(log: Log): Log {
  return {
    ...log,
    title: d(log.title),
    review: log.review != null ? d(log.review) : null,
    genres: decodeStrList(log.genres) ?? log.genres,
    mechanics: decodeStrList(log.mechanics) ?? log.mechanics,
  };
}

export function decodeSearchResultForDisplay(r: SearchResult): SearchResult {
  return {
    ...r,
    title: d(r.title),
    subtitle: r.subtitle != null ? d(r.subtitle) : r.subtitle,
  };
}

export function decodeItemDetailForDisplay(item: ItemDetail): ItemDetail {
  return {
    ...item,
    title: d(item.title),
    subtitle: item.subtitle != null ? d(item.subtitle) : item.subtitle,
    description: item.description != null ? d(item.description) : item.description,
    tagline: item.tagline != null ? d(item.tagline) : item.tagline,
    contentRating: item.contentRating != null ? d(item.contentRating) : item.contentRating,
    genres: decodeStrList(item.genres) ?? item.genres,
    authors: decodeStrList(item.authors) ?? item.authors,
    publisher: item.publisher != null ? d(item.publisher) : item.publisher,
    productionCountries: decodeStrList(item.productionCountries) ?? item.productionCountries,
    spokenLanguages: decodeStrList(item.spokenLanguages) ?? item.spokenLanguages,
    networks: decodeStrList(item.networks) ?? item.networks,
    platforms: decodeStrList(item.platforms) ?? item.platforms,
    developers: decodeStrList(item.developers) ?? item.developers,
    publishers: decodeStrList(item.publishers) ?? item.publishers,
    esrbRating: item.esrbRating != null ? d(item.esrbRating) : item.esrbRating,
    tags: decodeStrList(item.tags) ?? item.tags,
    categories: decodeStrList(item.categories) ?? item.categories,
    mechanics: decodeStrList(item.mechanics) ?? item.mechanics,
    studios: decodeStrList(item.studios) ?? item.studios,
    themes: decodeStrList(item.themes) ?? item.themes,
    demographics: decodeStrList(item.demographics) ?? item.demographics,
    duration: item.duration != null ? d(item.duration) : item.duration,
    serialization: item.serialization != null ? d(item.serialization) : item.serialization,
    subjects: decodeStrList(item.subjects) ?? item.subjects,
    releaseDate: item.releaseDate != null ? d(item.releaseDate) : item.releaseDate,
    status: item.status != null ? d(item.status) : item.status,
  };
}

export function decodeItemReviewForDisplay(r: ItemReview): ItemReview {
  return {
    ...r,
    review: r.review != null ? d(r.review) : r.review,
    reviewerLevelLabel: r.reviewerLevelLabel != null ? d(r.reviewerLevelLabel) : r.reviewerLevelLabel,
    reviewerBadges: r.reviewerBadges?.map((b) => ({ ...b, label: d(b.label) })),
  };
}

export function decodeItemPageDataForDisplay(data: ItemPageData): ItemPageData {
  return {
    ...data,
    item: decodeItemDetailForDisplay(data.item),
    reviews: data.reviews.map(decodeItemReviewForDisplay),
  };
}
