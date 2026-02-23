import { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useMe } from "@/contexts/MeContext";

/** When user is logged in, apply their saved theme from /me. */
export function ThemeSync() {
  const { me } = useMe();
  const { setColorScheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (!me?.theme) {
      applied.current = false;
      return;
    }
    if (applied.current) return;
    applied.current = true;
    if (me.theme === "light" || me.theme === "dark") {
      setColorScheme(me.theme);
    }
  }, [me?.theme, setColorScheme]);

  return null;
}
