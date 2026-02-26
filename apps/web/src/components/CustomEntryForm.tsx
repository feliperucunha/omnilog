import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { MediaType } from "@logeverything/shared";
import { MEDIA_TYPES, LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { toast } from "sonner";
import { modalContentVariants, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { StarRating } from "@/components/StarRating";
import { starsToGrade } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics"];

function isValidUrl(s: string): boolean {
  if (!s.trim()) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface CustomEntryFormProps {
  /** When not provided (e.g. Dashboard), user selects media type in the form. */
  mediaType?: MediaType;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

export function CustomEntryForm({
  mediaType: initialMediaType,
  onSaved,
  onCancel,
}: CustomEntryFormProps) {
  const { t } = useLocale();
  const [mediaType, setMediaType] = useState<MediaType>(initialMediaType ?? "movies");
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [stars, setStars] = useState(2.5);
  const [review, setReview] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [season, setSeason] = useState<number | "">("");
  const [episode, setEpisode] = useState<number | "">("");
  const [chapter, setChapter] = useState<number | "">("");
  const [volume, setVolume] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);
  const showMediaTypeSelector = initialMediaType == null;

  const toNum = (v: number | ""): number | null => (v === "" ? null : v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t("customEntry.entryTitleRequired"));
      return;
    }
    if (imageUrl.trim() && !isValidUrl(imageUrl.trim())) {
      toast.error(t("customEntry.invalidImageUrl"));
      return;
    }
    const image = imageUrl.trim() ? imageUrl.trim() : null;
    const grade = starsToGrade(stars);
    setLoading(true);
    try {
      const externalId = `custom-${crypto.randomUUID()}`;
      await apiFetch("/logs", {
        method: "POST",
        body: JSON.stringify({
          mediaType,
          externalId,
          title: trimmedTitle,
          image,
          grade,
          review: review.trim() || null,
          status: status || null,
          season: showSeasonEpisode ? toNum(season) : null,
          episode: showSeasonEpisode ? toNum(episode) : null,
          chapter: showChapterVolume ? toNum(chapter) : null,
          volume: showChapterVolume ? toNum(volume) : null,
        }),
      });
      invalidateLogsAndItemsCache();
      toast.success(t("toast.logSaved"));
      const completion: LogCompleteState = {
        image,
        title: trimmedTitle,
        grade,
        mediaType,
        id: externalId,
      };
      onSaved(completion);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.failedToSave");
      toast.error(message === LOG_LIMIT_REACHED_CODE ? t("tiers.logLimitReached") : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent onClose={onCancel}>
        <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
          <h3 className="mb-4 text-lg font-semibold text-[var(--color-lightest)]">
            {t("customEntry.dialogTitle")}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              {showMediaTypeSelector && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[var(--color-lightest)]">
                    {t("customEntry.mediaType")}
                  </Label>
                  <Select
                    value={mediaType}
                    onValueChange={(v) => setMediaType(v as MediaType)}
                    options={MEDIA_TYPES.map((type) => ({
                      value: type,
                      label: t(`nav.${type}`),
                    }))}
                    triggerClassName="w-full max-w-xs h-10"
                    aria-label={t("customEntry.mediaType")}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("customEntry.entryTitle")} *
                </Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("customEntry.entryTitlePlaceholder")}
                  className="bg-[var(--color-darkest)]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--color-light)]">
                  {t("customEntry.imageUrl")}
                </Label>
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-[var(--color-darkest)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("itemReviewForm.status")}
                </Label>
                <Select
                  value={status ?? ""}
                  onValueChange={(v) => setStatus(v || null)}
                  options={[
                    { value: "", label: "—" },
                    ...statusOptions.map((value) => ({
                      value,
                      label: t(`status.${STATUS_I18N_KEYS[value] ?? value}`),
                    })),
                  ]}
                  placeholder="—"
                  triggerClassName="w-full max-w-xs h-10"
                  aria-label={t("itemReviewForm.status")}
                />
              </div>
              {showSeasonEpisode && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[var(--color-lightest)]">
                      {t("itemReviewForm.season")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="bg-[var(--color-darkest)]"
                      value={season === "" ? "" : season}
                      onChange={(e) =>
                        setSeason(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[var(--color-lightest)]">
                      {t("itemReviewForm.episode")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="bg-[var(--color-darkest)]"
                      value={episode === "" ? "" : episode}
                      onChange={(e) =>
                        setEpisode(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="—"
                    />
                  </div>
                </div>
              )}
              {showChapterVolume && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[var(--color-lightest)]">
                      {t("itemReviewForm.chapter")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="bg-[var(--color-darkest)]"
                      value={chapter === "" ? "" : chapter}
                      onChange={(e) =>
                        setChapter(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[var(--color-lightest)]">
                      {t("itemReviewForm.volume")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="bg-[var(--color-darkest)]"
                      value={volume === "" ? "" : volume}
                      onChange={(e) =>
                        setVolume(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="—"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label className="mb-1 block text-sm font-medium text-[var(--color-lightest)]">
                  {t("itemReviewForm.rating")}
                </Label>
                <StarRating value={stars} onChange={setStars} size="lg" />
              </div>
              <div className="space-y-2">
                <Label>{t("logForm.review")}</Label>
                <Textarea
                  placeholder={t("logForm.reviewPlaceholder")}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="min-h-[80px] bg-[var(--color-darkest)]"
                />
              </div>
              <div className="flex gap-4">
                <motion.div whileTap={tapScale} transition={tapTransition} className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={onCancel}
                  >
                    {t("common.cancel")}
                  </Button>
                </motion.div>
                <motion.div whileTap={tapScale} transition={tapTransition} className="flex-1">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("common.saving") : t("common.save")}
                  </Button>
                </motion.div>
              </div>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
