import {
  siAndroid,
  siApple,
  siNintendo,
  siNintendo3ds,
  siNintendogamecube,
  siNintendoswitch,
  siPlaystation,
  siPlaystation2,
  siPlaystation3,
  siPlaystation4,
  siPlaystation5,
  siPlaystationvita,
  siQuest,
  siSega,
  siSteam,
  siSteamdeck,
  siWii,
  siWiiu,
  siWindows11,
  siXbox,
  type SimpleIcon,
} from "simple-icons";
import { Gamepad2 } from "lucide-react";
import {
  getGamePlatformBadgeClass,
  getGamePlatformFamily,
  type GamePlatformFamily,
} from "@/lib/gamePlatforms";
import { cn } from "@/lib/utils";

const ICON_BY_PLATFORM: Record<string, SimpleIcon> = {
  pc: siWindows11,
  "playstation 5": siPlaystation5,
  "playstation 4": siPlaystation4,
  "playstation 3": siPlaystation3,
  "playstation 2": siPlaystation2,
  playstation: siPlaystation,
  psp: siPlaystation,
  "xbox series x|s": siXbox,
  "xbox one": siXbox,
  "xbox 360": siXbox,
  xbox: siXbox,
  "nintendo switch": siNintendoswitch,
  "nintendo switch 2": siNintendoswitch,
  "wii u": siWiiu,
  wii: siWii,
  gamecube: siNintendogamecube,
  "nintendo 3ds": siNintendo3ds,
  "nintendo ds": siNintendo,
  "game boy advance": siNintendo,
  snes: siNintendo,
  nes: siNintendo,
  "nintendo 64": siNintendo,
  "playstation vita": siPlaystationvita,
  ios: siApple,
  android: siAndroid,
  mac: siApple,
  steam: siSteam,
  "steam deck": siSteamdeck,
  "meta quest": siQuest,
  "sega genesis": siSega,
  "sega dreamcast": siSega,
  "sega saturn": siSega,
};

const FALLBACK_ICON_BY_FAMILY: Record<GamePlatformFamily, SimpleIcon | null> = {
  nintendo: siNintendo,
  sony: siPlaystation,
  xbox: siXbox,
  pc: siWindows11,
  other: null,
};

function getPlatformIcon(platform: string): SimpleIcon | null {
  const normalized = platform.trim().toLowerCase();
  return ICON_BY_PLATFORM[normalized] ?? FALLBACK_ICON_BY_FAMILY[getGamePlatformFamily(platform)];
}

export function GamePlatformIcon({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const icon = getPlatformIcon(platform);
  const family = getGamePlatformFamily(platform);

  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border",
        getGamePlatformBadgeClass(family),
        className
      )}
      aria-hidden
    >
      {icon ? (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d={icon.path} />
        </svg>
      ) : (
        <Gamepad2 className="h-3 w-3" />
      )}
    </span>
  );
}
