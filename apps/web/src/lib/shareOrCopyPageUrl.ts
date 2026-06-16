import { toast } from "sonner";
import type { TFunction } from "@/contexts/LocaleContext";
import { showErrorToast } from "@/lib/errorToast";

export async function shareOrCopyPageUrl(
  args: { url: string; title: string },
  t: TFunction
): Promise<void> {
  const { url, title } = args;
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success(t("dashboard.linkCopied"));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.linkCopied"));
    } catch (clipErr) {
      showErrorToast(t, "E017", { originalError: clipErr });
    }
  }
}
