import { ImageOff } from "lucide-react";

interface ItemImageProps {
  /** Image URL; when null/undefined/empty, shows placeholder. */
  src: string | null | undefined;
  alt?: string;
  /** Root container class (size, shape, overflow). Image/placeholder fill the container. */
  className?: string;
  /** Optional class for the img element. Default: object-cover. */
  imgClassName?: string;
  /** When true, container shrinks to image size (img uses w-auto h-auto with object-contain). Use for modals. */
  fitContent?: boolean;
  /** Optional loading: "eager" for above-the-fold/modals so images load immediately. */
  loading?: "lazy" | "eager";
  /** Optional referrerPolicy; use "no-referrer" if external CDN blocks referrer. */
  referrerPolicy?: React.ComponentProps<"img">["referrerPolicy"];
}

/**
 * Renders an item image or a consistent placeholder (icon) when no image.
 * Use on search results, logs, dashboard, item page, log complete, and forms.
 */
export function ItemImage({
  src,
  alt = "",
  className = "",
  imgClassName = "object-cover",
  fitContent = false,
  loading,
  referrerPolicy,
}: ItemImageProps) {
  const hasImage = src != null && String(src).trim() !== "";
  const rootClass = [
    "flex-shrink-0 overflow-hidden bg-[var(--color-darkest)]",
    fitContent && "w-fit min-h-[2rem] min-w-[2rem]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const imgSizeClass = fitContent ? "block w-auto h-auto max-w-full max-h-full" : "h-full w-full block";

  return (
    <div className={rootClass}>
      {hasImage ? (
        <img
          src={src!}
          alt={alt}
          className={`${imgSizeClass} ${imgClassName}`.trim()}
          loading={loading}
          referrerPolicy={referrerPolicy}
        />
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
