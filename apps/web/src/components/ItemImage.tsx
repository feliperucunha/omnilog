import { ImageOff } from "lucide-react";

interface ItemImageProps {
  /** Image URL; when null/undefined/empty, shows placeholder. */
  src: string | null | undefined;
  alt?: string;
  /** Root container class (size, shape, overflow). Image/placeholder fill the container. */
  className?: string;
  /** Optional class for the img element. Default: object-cover. */
  imgClassName?: string;
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
}: ItemImageProps) {
  const hasImage = src != null && String(src).trim() !== "";
  const rootClass = [
    "flex-shrink-0 overflow-hidden bg-[var(--color-darkest)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {hasImage ? (
        <img
          src={src!}
          alt={alt}
          className={`h-full w-full block ${imgClassName}`.trim()}
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
