import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";
import type { Log, MarketListing, MediaType } from "@geeklogs/shared";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { DEFAULT_PURCHASE_CURRENCY, normalizeCurrencyCode } from "@/lib/currencies";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useMyMarketListings } from "@/contexts/MyMarketListingsContext";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { buildDefaultLogsListPath } from "@/lib/logsPageCache";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MarketDeleteListingConfirmDialog } from "@/components/MarketDeleteListingConfirmDialog";

type MarketListingSectionProps = {
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  myLog: Log | null;
  onEnsureLog: () => Promise<Log | null>;
  onListed?: () => void;
};

function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--color-mid)]/35",
        className
      )}
      aria-hidden
    />
  );
}

export function MarketListingSection({
  mediaType,
  myLog,
  onEnsureLog,
  onListed,
}: MarketListingSectionProps) {
  const { t } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const { ready: listedIdsReady, listedLogIds, markListed, markUnlisted } = useMyMarketListings();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<MarketListing | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [priceCurrency, setPriceCurrency] = useState(DEFAULT_PURCHASE_CURRENCY);
  const [priceMinor, setPriceMinor] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [acceptTrade, setAcceptTrade] = useState(false);
  const [localDelivery, setLocalDelivery] = useState(false);
  const [shipsByMail, setShipsByMail] = useState(false);
  const [contactEmail, setContactEmail] = useState(true);
  const [contactWhatsapp, setContactWhatsapp] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const resetListingForm = () => {
    setExisting(null);
    setPriceMinor(null);
    setDescription("");
    setAcceptTrade(false);
    setLocalDelivery(false);
    setShipsByMail(false);
    setContactEmail(true);
    setContactWhatsapp(false);
    const d = normalizeCurrencyCode(me?.defaultPurchaseCurrency);
    setPriceCurrency(d ?? DEFAULT_PURCHASE_CURRENCY);
  };

  const applyListingToForm = (row: MarketListing) => {
    setExisting(row);
    setPriceMinor(row.priceMinor);
    setPriceCurrency(row.priceCurrency);
    setDescription(row.description);
    setAcceptTrade(row.acceptTrade);
    setLocalDelivery(row.localDelivery);
    setShipsByMail(row.shipsByMail);
    setContactEmail(row.contactEmail);
    setContactWhatsapp(row.contactWhatsapp);
  };

  useEffect(() => {
    if (loadingExisting) return;
    const d = normalizeCurrencyCode(me?.defaultPurchaseCurrency);
    if (d && priceMinor == null && !existing) {
      setPriceCurrency(d);
    }
  }, [me?.defaultPurchaseCurrency, loadingExisting, priceMinor, existing]);

  useEffect(() => {
    if (me?.phone) setPhone(me.phone);
  }, [me?.phone]);

  useEffect(() => {
    if (!myLog?.id) {
      setExisting(null);
      setLoadingExisting(false);
      return;
    }
    if (!listedIdsReady) {
      setExisting(null);
      setLoadingExisting(false);
      return;
    }
    if (!listedLogIds.includes(myLog.id)) {
      resetListingForm();
      return;
    }
    if (existing?.logId === myLog.id) {
      setLoadingExisting(false);
      return;
    }

    let cancelled = false;
    setLoadingExisting(true);
    void apiFetch<{ data: MarketListing | null }>(`/market/my/${myLog.id}`)
      .then((res) => {
        if (cancelled) return;
        const row = res.data;
        if (row) {
          applyListingToForm(row);
        } else {
          resetListingForm();
          markUnlisted(myLog.id);
        }
      })
      .catch(() => {
        if (!cancelled) resetListingForm();
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [myLog?.id, listedIdsReady, listedLogIds, existing?.logId, markUnlisted]);

  const needsPhone = contactWhatsapp && !me?.phone && !phone.trim();
  const needsCity = !me?.city || !me?.cityLabel;
  const showFieldLoading = loadingExisting && myLog?.id != null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (showFieldLoading) return;
    if (priceMinor == null || priceMinor < 1) {
      showErrorToast(t, "E001");
      return;
    }
    if (!description.trim()) {
      showErrorToast(t, "E001");
      return;
    }
    if (!contactEmail && !contactWhatsapp) {
      showErrorToast(t, "E001");
      return;
    }
    if (needsPhone) {
      showErrorToast(t, "E001");
      return;
    }
    if (needsCity) {
      toast.error(t("market.setCityFirst"));
      return;
    }

    setSaving(true);
    try {
      let log = myLog;
      if (!log) {
        log = await onEnsureLog();
      }
      if (!log) {
        showErrorToast(t, "E008");
        return;
      }

      const res = await apiFetch<{ data: MarketListing }>("/market/listings", {
        method: "POST",
        body: JSON.stringify({
          logId: log.id,
          priceMinor,
          priceCurrency,
          description: description.trim(),
          acceptTrade,
          localDelivery,
          shipsByMail,
          contactEmail,
          contactWhatsapp,
          ...(contactWhatsapp && phone.trim() && { phone: phone.trim() }),
        }),
      });
      applyListingToForm(res.data);
      markListed(log.id);
      invalidateApiCache("/me");
      await refetchMe();
      toast.success(t("market.listingSaved"));
      if (onListed) {
        onListed();
      } else {
        navigate(buildDefaultLogsListPath(mediaType));
      }
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      {needsCity && !showFieldLoading && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-[var(--color-lightest)]">
          {t("market.setCityHint")}{" "}
          <Link to="/settings?tab=user" className="underline hover:no-underline">
            {t("market.userSettingsLink")}
          </Link>
        </p>
      )}
      {existing?.active && !showFieldLoading && (
        <p className="text-sm text-[var(--color-light)]">{t("market.updateListingHint")}</p>
      )}

      {showFieldLoading ? (
        <div className="space-y-2">
          <Label className="text-sm text-[var(--color-lightest)]">{t("market.price")}</Label>
          <FieldSkeleton className="h-11 w-full" />
        </div>
      ) : (
        <MoneyAmountInput
          label={t("market.price")}
          currency={priceCurrency}
          onCurrencyChange={setPriceCurrency}
          amountMinor={priceMinor}
          onAmountMinorChange={setPriceMinor}
          t={t}
          showOptionalHint={false}
        />
      )}

      <div className="space-y-2">
        <Label>{t("market.description")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-24 w-full" />
        ) : (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("market.descriptionPlaceholder")}
            rows={4}
            maxLength={4000}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="market-accept-trade">{t("market.acceptTrade")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-6 w-11 rounded-full" />
        ) : (
          <Switch id="market-accept-trade" checked={acceptTrade} onCheckedChange={setAcceptTrade} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="market-local-delivery">{t("market.localDeliveryToggle")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-6 w-11 rounded-full" />
        ) : (
          <Switch
            id="market-local-delivery"
            checked={localDelivery}
            onCheckedChange={setLocalDelivery}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="market-ships-by-mail">{t("market.shipsByMailToggle")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-6 w-11 rounded-full" />
        ) : (
          <Switch id="market-ships-by-mail" checked={shipsByMail} onCheckedChange={setShipsByMail} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="market-contact-email">{t("market.contactEmailToggle")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-6 w-11 rounded-full" />
        ) : (
          <Switch id="market-contact-email" checked={contactEmail} onCheckedChange={setContactEmail} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="market-contact-whatsapp">{t("market.contactWhatsappToggle")}</Label>
        {showFieldLoading ? (
          <FieldSkeleton className="h-6 w-11 rounded-full" />
        ) : (
          <Switch
            id="market-contact-whatsapp"
            checked={contactWhatsapp}
            onCheckedChange={setContactWhatsapp}
          />
        )}
      </div>
      {contactWhatsapp && !me?.phone && !showFieldLoading && (
        <div className="space-y-2">
          <Label>{t("market.phone")}</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("market.phonePlaceholder")}
            autoComplete="tel"
          />
          <p className="text-xs text-[var(--color-light)]">{t("market.phoneHint")}</p>
        </div>
      )}
      <Button type="submit" disabled={saving || needsCity || showFieldLoading} className="w-full">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {t("common.saving")}
          </>
        ) : (
          t("market.confirmListing")
        )}
      </Button>
      {existing?.active && !showFieldLoading && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-red-400 hover:bg-red-500/20 hover:text-red-400"
          disabled={saving}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {t("market.deleteListing")}
        </Button>
      )}
      {existing?.active && (
        <MarketDeleteListingConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          listingId={existing.id}
          onDeleted={() => {
            if (myLog?.id) markUnlisted(myLog.id);
            resetListingForm();
          }}
        />
      )}
    </form>
  );
}
