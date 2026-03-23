import type { LogCompleteState } from "@/components/ItemReviewForm";

/** Query param: `?previewNativeLogComplete=1` (dev only). Opens the completed-log modal with mock data using the native WebView layout. */
export const PREVIEW_NATIVE_LOG_COMPLETE_PARAM = "previewNativeLogComplete";

export function parsePreviewNativeLogComplete(search: string): boolean {
  if (!import.meta.env.DEV) return false;
  const v = new URLSearchParams(search).get(PREVIEW_NATIVE_LOG_COMPLETE_PARAM);
  return v === "1" || v === "true" || v === "";
}

/** Sample poster + copy to exercise status, stars, review, and footer in the modal. */
export const MOCK_LOG_COMPLETE_STATE: LogCompleteState = {
  image:
    "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80",
  title: "Preview — Native completed log modal (web dev)",
  grade: 8,
  status: "watched",
  mediaType: "movies",
  id: "dev-preview-native-log-complete",
  review:
    "Mock review: this screen uses the same layout as Android/iOS (no motion, scrollable overlay, native-style chrome). Remove the query param or close to dismiss.",
};
