import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { FORCE_ONBOARDING_UI } from "@/lib/onboardingDev";
import { BOARD_GAME_PROVIDERS, MEDIA_TYPES, type BoardGameProvider, type MediaType } from "@geeklogs/shared";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/productAnalytics";

export type OnboardingFormProps = {
  /** Full-page shell vs compact block inside a dialog. */
  layout?: "page" | "embed";
  /** When true, completing does not navigate away (e.g. dev modal); calls onPreviewDismiss instead. */
  previewMode?: boolean;
  onPreviewDismiss?: () => void;
};

export function OnboardingForm({ layout = "page", previewMode, onPreviewDismiss }: OnboardingFormProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const themeForDefaults = colorScheme === "light" ? "light" : "dark";
  const { refetch: refetchVisibleTypes } = useVisibleMediaTypes();
  const { refetch: refetchMe, me } = useMe();
  const [orderedTypes, setOrderedTypes] = useState<MediaType[]>(() => [...MEDIA_TYPES]);
  const [selectedTypes, setSelectedTypes] = useState<Set<MediaType>>(() => new Set(MEDIA_TYPES));
  const [theme, setTheme] = useState<"light" | "dark">(colorScheme);
  const [boardGameProvider, setBoardGameProvider] = useState<BoardGameProvider>("bgg");
  const [loading, setLoading] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const reorderDragFromRef = useRef<number | null>(null);
  const [reorderDragFrom, setReorderDragFrom] = useState<number | null>(null);
  const [reorderHoverIndex, setReorderHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!previewMode || !me?.visibleMediaTypes?.length) return;
    const raw = me.visibleMediaTypes as MediaType[];
    const valid = raw.filter((x): x is MediaType => (MEDIA_TYPES as readonly string[]).includes(x));
    if (valid.length === 0) return;
    const rest = MEDIA_TYPES.filter((t) => !valid.includes(t));
    setOrderedTypes([...valid, ...rest]);
    setSelectedTypes(new Set(valid));
  }, [previewMode, me?.visibleMediaTypes]);

  const clearReorderGesture = useCallback(() => {
    reorderDragFromRef.current = null;
    setReorderDragFrom(null);
    setReorderHoverIndex(null);
  }, []);

  const mediaTypeDropIndexAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    const root = listRef.current;
    if (!root) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (let i = 0; i < stack.length; i++) {
      const el = stack[i];
      if (!(el instanceof Element)) continue;
      const row = el.closest("[data-onboarding-media-index]");
      if (!row || !root.contains(row)) continue;
      const parsed = Number.parseInt(row.getAttribute("data-onboarding-media-index") ?? "", 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < orderedTypes.length) return parsed;
    }
    return null;
  }, [orderedTypes.length]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setOrderedTypes((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const handleToggleType = (type: MediaType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const typesPayload = orderedTypes.filter((t) => selectedTypes.has(t));

  const handleComplete = async () => {
    if (!user || typesPayload.length === 0) return;
    setLoading(true);
    try {
      const body: {
        theme: "light" | "dark";
        types: MediaType[];
        boardGameProvider?: BoardGameProvider;
      } = { theme, types: typesPayload };
      if (selectedTypes.has("boardgames")) {
        body.boardGameProvider = boardGameProvider;
      }
      await apiFetch("/settings/onboarding", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setColorScheme(theme);
      setUser({ ...user, onboarded: true });
      trackProductEvent("onboarding_completed", { path: "custom" });
      await refetchVisibleTypes();
      await refetchMe();
      invalidateApiCache("/search");
      if (previewMode) {
        onPreviewDismiss?.();
        if (!onPreviewDismiss) navigate("/", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch {
      /* finally */
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefaults = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const body: {
        theme: "light" | "dark";
        types: MediaType[];
        boardGameProvider?: BoardGameProvider;
      } = {
        theme: themeForDefaults,
        types: [...MEDIA_TYPES],
        boardGameProvider: "bgg",
      };
      await apiFetch("/settings/onboarding", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setColorScheme(themeForDefaults);
      setUser({ ...user, onboarded: true });
      trackProductEvent("onboarding_completed", { path: "defaults" });
      await refetchVisibleTypes();
      await refetchMe();
      invalidateApiCache("/search");
      if (previewMode) {
        onPreviewDismiss?.();
        if (!onPreviewDismiss) navigate("/", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch {
      /* finally */
    } finally {
      setLoading(false);
    }
  };

  const showBoardGameApi = selectedTypes.has("boardgames");

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border p-6",
        layout === "embed" && "max-h-[min(85dvh,720px)] overflow-y-auto"
      )}
    >
      <div className="text-center">
        <h1 className="min-w-0 text-2xl font-bold text-[var(--color-lightest)]">{t("onboarding.title")}</h1>
        <p className="mt-2 text-sm text-[var(--color-light)]">{t("onboarding.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium text-[var(--color-lightest)]">{t("onboarding.themeLabel")}</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setColorScheme("light");
            }}
            className={cn(
              "flex-1 rounded-lg border-2 px-4 py-3 max-md:min-h-[44px] text-sm font-medium transition-colors",
              theme === "light"
                ? "border-[var(--color-mid)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                : "border-[var(--color-mid)]/50 bg-transparent text-[var(--color-light)] hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
            )}
          >
            {t("theme.light")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setColorScheme("dark");
            }}
            className={cn(
              "flex-1 rounded-lg border-2 px-4 py-3 max-md:min-h-[44px] text-sm font-medium transition-colors",
              theme === "dark"
                ? "border-[var(--color-mid)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                : "border-[var(--color-mid)]/50 bg-transparent text-[var(--color-light)] hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
            )}
          >
            {t("theme.dark")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium text-[var(--color-lightest)]">{t("onboarding.mediaTypesLabel")}</Label>
        <p className="text-xs text-[var(--color-light)]">{t("onboarding.mediaOrderHint")}</p>
        <ul
          ref={listRef}
          className="flex flex-col gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1"
          aria-label={t("onboarding.mediaTypesLabel")}
        >
          {orderedTypes.map((type, index) => (
            <li
              key={type}
              data-onboarding-media-index={index}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-darkest)]/80",
                reorderDragFrom === index && "opacity-60",
                reorderHoverIndex === index &&
                  reorderDragFrom != null &&
                  reorderHoverIndex !== reorderDragFrom &&
                  "ring-2 ring-[var(--btn-gradient-start)]/45"
              )}
            >
              <button
                type="button"
                disabled={loading}
                className={cn(
                  "inline-flex min-h-10 min-w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md border-0 bg-transparent p-0",
                  "text-[var(--color-light)] hover:bg-[var(--color-mid)]/25 hover:text-[var(--color-lightest)] active:cursor-grabbing",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]",
                  loading && "pointer-events-none opacity-50"
                )}
                aria-label={t("settings.dragToReorder")}
                onPointerDown={(e) => {
                  if (e.button !== 0 || loading) return;
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  reorderDragFromRef.current = index;
                  setReorderDragFrom(index);
                  setReorderHoverIndex(index);
                }}
                onPointerMove={(e) => {
                  if (reorderDragFromRef.current == null) return;
                  setReorderHoverIndex(mediaTypeDropIndexAtPoint(e.clientX, e.clientY));
                }}
                onPointerUp={(e) => {
                  if (reorderDragFromRef.current == null) return;
                  const from = reorderDragFromRef.current;
                  const x = e.clientX;
                  const y = e.clientY;
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  } catch {
                    /* already released */
                  }
                  const to = mediaTypeDropIndexAtPoint(x, y);
                  clearReorderGesture();
                  if (to != null && to !== from) {
                    handleReorder(from, to);
                  }
                }}
                onPointerCancel={(e) => {
                  if (reorderDragFromRef.current == null) return;
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  } catch {
                    /* ignore */
                  }
                  clearReorderGesture();
                }}
                onLostPointerCapture={() => {
                  clearReorderGesture();
                }}
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </button>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => handleToggleType(type)}
                  disabled={loading}
                  className="h-4 w-4 shrink-0 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                />
                <span className="text-sm font-medium text-[var(--color-lightest)]">{t(`nav.${type}`)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {showBoardGameApi && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 p-4">
          <Label className="text-base font-medium text-[var(--color-lightest)]">
            {t("settings.boardGameProviderLabel")}
          </Label>
          <p className="text-xs text-[var(--color-light)]">{t("onboarding.boardGameApiHint")}</p>
          <ToggleGroup
            type="single"
            value={boardGameProvider}
            onValueChange={(v) => v && setBoardGameProvider(v as BoardGameProvider)}
            className="inline-flex w-full max-w-md flex-wrap rounded-md border border-[var(--color-mid)]/30 p-0.5"
            aria-label={t("settings.boardGameProviderLabel")}
          >
            {BOARD_GAME_PROVIDERS.map((provider) => (
              <ToggleGroupItem
                key={provider}
                value={provider}
                className="h-10 flex-1 px-3 text-sm data-[state=on]:bg-[var(--color-mid)]/50"
                aria-label={
                  provider === "bgg"
                    ? t("settings.boardGameProviderBgg")
                    : t("settings.boardGameProviderLudopedia")
                }
              >
                {provider === "bgg"
                  ? t("settings.boardGameProviderBgg")
                  : t("settings.boardGameProviderLudopedia")}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <Button className="w-full" onClick={() => void handleComplete()} disabled={loading || typesPayload.length === 0}>
        {loading ? t("onboarding.continuing") : t("onboarding.continue")}
      </Button>
      <div className="flex flex-col items-center gap-2 border-t border-[var(--color-surface-border)] pt-4">
        <p className="text-center text-xs text-[var(--color-light)]">{t("onboarding.useDefaultsHint")}</p>
        <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void handleUseDefaults()}>
          {t("onboarding.useDefaults")}
        </Button>
      </div>
    </motion.div>
  );

  if (layout === "page") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-darkest)] p-6">{card}</div>
    );
  }

  return card;
}

export function Onboarding() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const previewByUrl = searchParams.get("preview") === "1";

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowPreview = (FORCE_ONBOARDING_UI || previewByUrl) && user.onboarded === true;
  if (user.onboarded === true && !allowPreview) {
    return <Navigate to="/" replace />;
  }

  return <OnboardingForm layout="page" previewMode={allowPreview} />;
}
