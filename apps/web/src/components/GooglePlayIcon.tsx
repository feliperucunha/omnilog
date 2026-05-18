import { cn } from "@/lib/utils";

type GooglePlayIconProps = {
  className?: string;
  title?: string;
};

export function GooglePlayIcon({ className, title }: GooglePlayIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.61 3 21.09 3 20.5Z"
        fill="#00F076"
      />
      <path
        d="M16.81 15.12 6.05 21.34 14.54 12.85l2.27 2.27Z"
        fill="#FF3A44"
      />
      <path
        d="M20.16 10.81c.34.27.59.69.59 1.19s-.25.92-.59 1.19l-2.29 1.32-2.5-2.5 2.5-2.5 2.29 1.32Z"
        fill="#FFBA00"
      />
      <path d="M6.05 2.66 16.81 8.88 14.54 11.15 6.05 2.66Z" fill="#00D6FF" />
    </svg>
  );
}
