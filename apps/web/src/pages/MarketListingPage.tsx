import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Share2 } from "lucide-react";
import type { MarketListing } from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketListingDetailContent } from "@/components/MarketListingDetailContent";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiFetch, ApiError } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { shareOrCopyPageUrl } from "@/lib/shareOrCopyPageUrl";
import { marketListingShareUrl } from "@/lib/marketListingRoutes";
import { paperShadow } from "@/lib/paperShadow";

export function MarketListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { me } = useMe();
  const { setPageTitle } = usePageTitle() ?? {};
  const [listing, setListing] = useState<MarketListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!listingId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void apiFetch<MarketListing>(`/market/listings/${encodeURIComponent(listingId)}`)
      .then((data) => {
        if (cancelled) return;
        setListing(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 404) {
          setNotFound(true);
          setListing(null);
        } else {
          showErrorToast(t, "E017", { originalError: err });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, t]);

  useEffect(() => {
    setPageTitle?.(listing?.title ?? t("market.title"));
    return () => setPageTitle?.(null);
  }, [listing?.title, t, setPageTitle]);

  const handleShare = useCallback(async () => {
    if (!listingId) return;
    const url = marketListingShareUrl(listingId);
    const title = listing?.title ?? t("market.title");
    await shareOrCopyPageUrl({ url, title }, t);
  }, [listingId, listing?.title, t]);

  const handleDeleted = useCallback(() => {
    if (me?.user.id === listing?.userId) {
      navigate("/my-listings", { replace: true });
      return;
    }
    navigate("/market", { replace: true });
  }, [listing?.userId, me?.user.id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" aria-hidden />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <Card
        className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6"
        style={paperShadow}
      >
        <p className="text-center text-[var(--color-light)]">{t("market.listingNotFound")}</p>
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="secondary" onClick={() => navigate("/market")}>
            {t("market.backToMarket")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
          <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-[var(--color-light)]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          {t("itemPage.back")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void handleShare()}
        >
          <Share2 className="mr-2 h-4 w-4" aria-hidden />
          {t("market.shareListing")}
        </Button>
      </div>

      <MarketListingDetailContent
        listing={listing}
        t={t}
        locale={locale}
        currentUserId={me?.user.id}
        onListingUpdated={setListing}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
