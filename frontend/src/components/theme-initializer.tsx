"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { defaultTheme, applyTheme, loadThemeFromBackend } from "@/lib/theme";

export function ThemeInitializer() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Not logged in — always use default theme
      applyTheme(defaultTheme);
      return;
    }

    // Logged in — load this user's theme from backend
    loadThemeFromBackend().then((theme) => {
      applyTheme(theme);
    });
  }, [user, loading]);

  return null;
}
