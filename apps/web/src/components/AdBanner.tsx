import { useEffect, useRef, useState } from "react";
import { useMe } from "@/contexts/MeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Link } from "react-router-dom";

const ADSENSE_SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdBanner() {
  const { me } = useMe();
  const { t } = useLocale();
  const insRef = useRef<HTMLModElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const clientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID as string)?.trim();
  const slotId = (import.meta.env.VITE_ADSENSE_SLOT_ID as string)?.trim() || undefined;

  const isFreeUser = me && me.tier !== "pro";
  const showAd = Boolean(clientId && isFreeUser);

  useEffect(() => {
    if (!showAd || !clientId) return;

    const loadScript = () => {
      if (document.querySelector(`script[src="${ADSENSE_SCRIPT_URL}"]`)) {
        setScriptLoaded(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `${ADSENSE_SCRIPT_URL}?client=${encodeURIComponent(clientId)}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => setScriptLoaded(true);
      document.head.appendChild(script);
    };

    loadScript();
  }, [showAd, clientId]);

  useEffect(() => {
    if (!showAd || !scriptLoaded || !insRef.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
  }, [showAd, scriptLoaded]);

  if (!showAd) return null;

  return (
    <aside
      className="mt-8 flex flex-col gap-1 border-t border-[var(--color-mid)]/30 pt-6"
      aria-label={t("ad.bannerLabel")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-light)]">{t("ad.adLabel")}</span>
        <Link
          to="/tiers"
          className="text-xs text-[var(--color-light)] underline hover:text-[var(--color-lightest)] hover:no-underline"
        >
          {t("ad.removeAds")}
        </Link>
      </div>
      <div className="min-h-[90px] w-full overflow-hidden rounded-md bg-[var(--color-darkest)]/50 [&_.adsbygoogle]:min-h-[90px]">
        <ins
          ref={insRef}
          className="adsbygoogle block"
          data-ad-client={clientId}
          {...(slotId ? { "data-ad-slot": slotId } : {})}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
          style={{ display: "block" }}
        />
      </div>
    </aside>
  );
}
