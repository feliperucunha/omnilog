import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useMe } from "@/contexts/MeContext";

/** When /me loads or updates, apply saved theme from the server (cross-device sync). */
export function ThemeSync() {
  const { me } = useMe();
  const { setColorScheme } = useTheme();

  useEffect(() => {
    if (!me?.user?.id || !me.theme) return;
    if (me.theme === "light" || me.theme === "dark") {
      setColorScheme(me.theme);
    }
  }, [me?.user?.id, me?.theme, setColorScheme]);

  return null;
}
