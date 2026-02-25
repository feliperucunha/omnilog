import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { MediaType, Log } from "@logeverything/shared";
import { LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { toast } from "sonner";
import { modalContentVariants, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics"];

interface LogFormCreateProps {
  mode: "create";
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

interface LogFormEditProps {
  mode: "edit";
  log: Log;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

type LogFormProps = LogFormCreateProps | LogFormEditProps;

const toNum = (v: number | ""): number | null => (v === "" ? null : v);

export function LogForm(props: LogFormProps) {
  const { t } = useLocale();
  const isEdit = props.mode === "edit";
  const log = isEdit ? props.log : null;
  const mediaType = isEdit ? (log!.mediaType as MediaType) : (props as LogFormCreateProps).mediaType;

  const [stars, setStars] = useState(isEdit ? gradeToStars(log!.grade ?? undefined) : 2.5);
  const [review, setReview] = useState(isEdit ? (log!.review ?? "") : "");
  const [status, setStatus] = useState<string | null>(isEdit ? (log!.status ?? log!.listType ?? null) : null);
  const [season, setSeason] = useState<number | "">(isEdit ? (log!.season ?? "") : "");
  const [episode, setEpisode] = useState<number | "">(isEdit ? (log!.episode ?? "") : "");
  const [chapter, setChapter] = useState<number | "">(isEdit ? (log!.chapter ?? "") : "");
  const [volume, setVolume] = useState<number | "">(isEdit ? (log!.volume ?? "") : "");
  const [loading, setLoading] = useState(false);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);

  useEffect(() => {
    if (isEdit && log) {
      setStars(gradeToStars(log.grade ?? undefined));
      setReview(log.review ?? "");
      setStatus(log.status ?? log.listType ?? null);
      setSeason(log.season ?? "");
      setEpisode(log.episode ?? "");
      setChapter(log.chapter ?? "");
      setVolume(log.volume ?? "");
    }
  }, [isEdit, log?.id]);

  const title = isEdit ? log!.title : props.title;
  const image = isEdit ? null : (props as LogFormCreateProps).image;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const grade = starsToGrade(stars);
    setLoading(true);
    try {
      if (isEdit) {
        const payload = {
          grade,
          review: review.trim() || null,
          status: status || null,
          season: toNum(season),
          episode: toNum(episode),
          chapter: toNum(chapter),
          volume: toNum(volume),
        };
        await apiFetch(`/logs/${props.log.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(t("toast.logUpdated"));
      } else {
        await apiFetch("/logs", {
          method: "POST",
          body: JSON.stringify({
            mediaType: props.mediaType,
            externalId: props.externalId,
            title: props.title,
            image: image ?? null,
            grade,
            review,
          }),
        });
        toast.success(t("toast.logSaved"));
      }
      invalidateLogsAndItemsCache();
      const completion: LogCompleteState = {
        image,
        title,
        grade,
        mediaType: isEdit ? (props.log.mediaType as MediaType) : props.mediaType,
        id: isEdit ? props.log.externalId : props.externalId,
      };
      props.onSaved(completion);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent onClose={props.onCancel}>
        <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
          <div className="mb-4 flex gap-4">
            <ItemImage src={image} className="h-20 w-14 rounded" />
            <h3 className="line-clamp-2 text-lg font-semibold text-[var(--color-lightest)]">
              {title}
            </h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              {isEdit && (
                <>
                  <div>
                    <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                      {t("itemReviewForm.status")}
                    </Label>
                    <select
                      value={status ?? ""}
                      onChange={(e) => setStatus(e.target.value || null)}
                      className="flex h-10 w-full max-w-xs rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
                    >
                      <option value="">—</option>
                      {statusOptions.map((value) => (
                        <option key={value} value={value}>
                          {t(`status.${STATUS_I18N_KEYS[value] ?? value}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {showSeasonEpisode && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.season")}</Label>
                        <Input
                          type="number"
                          min={0}
                          className="bg-[var(--color-darkest)]"
                          value={season === "" ? "" : season}
                          onChange={(e) => setSeason(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="—"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.episode")}</Label>
                        <Input
                          type="number"
                          min={0}
                          className="bg-[var(--color-darkest)]"
                          value={episode === "" ? "" : episode}
                          onChange={(e) => setEpisode(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="—"
                        />
                      </div>
                    </div>
                  )}
                  {showChapterVolume && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.chapter")}</Label>
                        <Input
                          type="number"
                          min={0}
                          className="bg-[var(--color-darkest)]"
                          value={chapter === "" ? "" : chapter}
                          onChange={(e) => setChapter(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="—"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.volume")}</Label>
                        <Input
                          type="number"
                          min={0}
                          className="bg-[var(--color-darkest)]"
                          value={volume === "" ? "" : volume}
                          onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="—"
                        />
                      </div>
                    </div>
                  )}
                </>
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
                  value={review ?? ""}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-4">
                <motion.div
                  whileTap={tapScale}
                  transition={tapTransition}
                  className="flex-1"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={props.onCancel}
                  >
                    {t("common.cancel")}
                  </Button>
                </motion.div>
                <motion.div
                  whileTap={tapScale}
                  transition={tapTransition}
                  className="flex-1"
                >
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
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
