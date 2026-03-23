import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { BoardGameProvider, MediaType } from "@geeklogs/shared";
import { coerceImageUrlString } from "@/lib/getHeroImageUrl";
import {
  BGG_BLUR_BACKDROP_IMG_CLASS,
  BGG_CONTAIN_FOREGROUND_IMG_CLASS,
  isBggBoardGameImageContext,
} from "@/lib/boardGameImageFit";

interface ItemImageProps {
  /** Image URL; when null/undefined/empty, shows placeholder. */
  src: string | null | undefined;
  alt?: string;
  /** Root container class (size, shape, overflow). Image/placeholder fill the container. */
  className?: string;
  /** Optional class for the img element. When set, disables the default BGG blur+contain stack. */
  imgClassName?: string;
  /** When set with boardgames + BGG (or geekdo URL), default is full image + blurred duplicate backdrop. */
  mediaType?: MediaType;
  boardGameSource?: BoardGameProvider | null;
  /** Search/create: user’s board game provider when `boardGameSource` is unknown. */
  activeBoardGameProvider?: BoardGameProvider | null;
  /** When true, container shrinks to image size (img uses w-auto h-auto with object-contain). Use for modals. */
  fitContent?: boolean;
  /** Optional loading: "eager" for above-the-fold/modals so images load immediately. */
  loading?: "lazy" | "eager";
  /** Optional referrerPolicy; use "no-referrer" if external CDN blocks referrer. */
  referrerPolicy?: React.ComponentProps<"img">["referrerPolicy"];
}

/**
 * Renders an item image or a consistent placeholder (icon) when no image or on load error.
 * Use on search results, logs, dashboard, item page, log complete, and forms.
 * On Android WebView, failed image loads show the placeholder instead of a black area.
 */
export function ItemImage({
  src,
  alt = "",
  className = "",
  imgClassName,
  mediaType,
  boardGameSource,
  activeBoardGameProvider,
  fitContent = false,
  loading,
  referrerPolicy,
}: ItemImageProps) {
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
  }, [src]);
  const resolvedSrc = coerceImageUrlString(src);
  const hasImage = !error && resolvedSrc != null;
  const bggBoardFraming = isBggBoardGameImageContext(
    mediaType,
    resolvedSrc,
    boardGameSource ?? null,
    activeBoardGameProvider ?? null
  );
  const useBggBlurStack = bggBoardFraming && imgClassName === undefined;
  const effectiveImgClassName = imgClassName === undefined ? "object-cover" : imgClassName;

  const rootClass = [
    "flex-shrink-0 overflow-hidden bg-[var(--color-darkest)]",
    useBggBlurStack && "relative",
    fitContent && !useBggBlurStack && "w-fit min-h-[2rem] min-w-[2rem]",
    fitContent && useBggBlurStack && "relative flex w-fit min-h-[2rem] min-w-[2rem] items-center justify-center",
    !fitContent && useBggBlurStack && "relative",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const imgSizeClass = fitContent ? "block w-auto h-auto max-w-full max-h-full" : "h-full w-full block";

  const imgProps = {
    loading,
    referrerPolicy,
  } as const;

  return (
    <div className={rootClass}>
      {hasImage ? (
        useBggBlurStack ? (
          <>
            <img
              src={resolvedSrc!}
              alt=""
              aria-hidden
              className={BGG_BLUR_BACKDROP_IMG_CLASS}
              {...imgProps}
            />
            <img
              src={resolvedSrc!}
              alt={alt}
              className={
                fitContent
                  ? "relative z-[1] max-h-full max-w-full object-contain object-center"
                  : `${imgSizeClass} ${BGG_CONTAIN_FOREGROUND_IMG_CLASS}`
              }
              {...imgProps}
              onError={() => setError(true)}
            />
          </>
        ) : (
          <img
            src={resolvedSrc!}
            alt={alt}
            className={`${imgSizeClass} ${effectiveImgClassName}`.trim()}
            {...imgProps}
            onError={() => setError(true)}
          />
        )
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-[var(--color-mid)]"
          aria-hidden
        >
          <ImageOff className="h-[40%] w-[40%] min-h-6 min-w-6 opacity-60" />
        </div>
      )}
    </div>
  );
}
