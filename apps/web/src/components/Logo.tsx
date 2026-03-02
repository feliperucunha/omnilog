import { useTheme } from "@/contexts/ThemeContext";

const LOGO_LIGHT = "/logo.png";
const LOGO_DARK = "/logo-dark.png";

export function getLogoSrc(theme: "light" | "dark"): string {
  return theme === "dark" ? LOGO_DARK : LOGO_LIGHT;
}

interface LogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Optional: override theme-based source (e.g. for favicon) */
  src?: string;
}

export function Logo({ className, alt = "", src: srcOverride, ...props }: LogoProps) {
  const { colorScheme } = useTheme();
  const src = srcOverride ?? getLogoSrc(colorScheme);
  return <img src={src} alt={alt} className={className} {...props} />;
}
