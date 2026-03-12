import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const LOGO_LIGHT = "/logo.png";
const LOGO_DARK = "/logo-dark.png";

export function getLogoSrc(theme: "light" | "dark"): string {
  return theme === "dark" ? LOGO_DARK : LOGO_LIGHT;
}

interface LogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Optional: override theme-based source (e.g. for favicon) */
  src?: string;
}

/** Dark logo uses mix-blend-lighten so dark edges/anti-aliasing blend into dark backgrounds. */
export function Logo({ className, alt = "", src: srcOverride, ...props }: LogoProps) {
  const { colorScheme } = useTheme();
  const src = srcOverride ?? getLogoSrc(colorScheme);
  const isDarkLogo = src === LOGO_DARK;
  return (
    <img
      src={src}
      alt={alt}
      className={cn(isDarkLogo && "mix-blend-lighten", className)}
      {...props}
    />
  );
}
