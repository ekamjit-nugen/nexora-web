// Color presets with their HSL values for --primary and derived colors
export interface ColorPreset {
  name: string;
  label: string;
  hex: string; // for display
  hsl: string; // for CSS var, e.g. "203 65% 47%"
  hslForeground: string; // text on primary bg
  hslRing: string; // focus ring color
  hslLight: string; // light variant for hover/selected backgrounds like sidebar active
}

export const colorPresets: ColorPreset[] = [
  { name: "blue", label: "Blue", hex: "#2E86C1", hsl: "203 65% 47%", hslForeground: "210 40% 98%", hslRing: "203 65% 47%", hslLight: "207 90% 96%" },
  { name: "indigo", label: "Indigo", hex: "#4F46E5", hsl: "243 75% 59%", hslForeground: "210 40% 98%", hslRing: "243 75% 59%", hslLight: "243 80% 96%" },
  { name: "violet", label: "Violet", hex: "#7C3AED", hsl: "263 70% 58%", hslForeground: "210 40% 98%", hslRing: "263 70% 58%", hslLight: "263 80% 96%" },
  { name: "purple", label: "Purple", hex: "#9333EA", hsl: "272 72% 56%", hslForeground: "210 40% 98%", hslRing: "272 72% 56%", hslLight: "272 80% 96%" },
  { name: "rose", label: "Rose", hex: "#E11D48", hsl: "347 77% 50%", hslForeground: "210 40% 98%", hslRing: "347 77% 50%", hslLight: "347 80% 96%" },
  { name: "orange", label: "Orange", hex: "#EA580C", hsl: "21 90% 48%", hslForeground: "210 40% 98%", hslRing: "21 90% 48%", hslLight: "21 90% 96%" },
  { name: "amber", label: "Amber", hex: "#D97706", hsl: "38 92% 44%", hslForeground: "210 40% 98%", hslRing: "38 92% 44%", hslLight: "38 90% 96%" },
  { name: "emerald", label: "Emerald", hex: "#059669", hsl: "160 84% 31%", hslForeground: "210 40% 98%", hslRing: "160 84% 31%", hslLight: "160 80% 96%" },
  { name: "teal", label: "Teal", hex: "#0D9488", hsl: "174 72% 31%", hslForeground: "210 40% 98%", hslRing: "174 72% 31%", hslLight: "174 80% 96%" },
  { name: "cyan", label: "Cyan", hex: "#0891B2", hsl: "192 91% 37%", hslForeground: "210 40% 98%", hslRing: "192 91% 37%", hslLight: "192 80% 96%" },
  { name: "slate", label: "Slate", hex: "#475569", hsl: "215 19% 35%", hslForeground: "210 40% 98%", hslRing: "215 19% 35%", hslLight: "215 20% 96%" },
];

export interface FontOption {
  name: string;
  label: string;
  value: string; // CSS font-family value
  googleFont?: string; // Google Fonts name for loading
  category: "sans" | "serif" | "mono";
}

export const fontOptions: FontOption[] = [
  { name: "inter", label: "Inter", value: "'Inter', sans-serif", category: "sans" },
  { name: "plus-jakarta", label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', sans-serif", googleFont: "Plus+Jakarta+Sans", category: "sans" },
  { name: "dm-sans", label: "DM Sans", value: "'DM Sans', sans-serif", googleFont: "DM+Sans", category: "sans" },
  { name: "nunito", label: "Nunito", value: "'Nunito', sans-serif", googleFont: "Nunito", category: "sans" },
  { name: "poppins", label: "Poppins", value: "'Poppins', sans-serif", googleFont: "Poppins", category: "sans" },
  { name: "manrope", label: "Manrope", value: "'Manrope', sans-serif", googleFont: "Manrope", category: "sans" },
  { name: "outfit", label: "Outfit", value: "'Outfit', sans-serif", googleFont: "Outfit", category: "sans" },
  { name: "space-grotesk", label: "Space Grotesk", value: "'Space Grotesk', sans-serif", googleFont: "Space+Grotesk", category: "sans" },
  { name: "source-serif", label: "Source Serif 4", value: "'Source Serif 4', serif", googleFont: "Source+Serif+4", category: "serif" },
  { name: "jetbrains-mono", label: "JetBrains Mono", value: "'JetBrains Mono', monospace", googleFont: "JetBrains+Mono", category: "mono" },
];

export type RadiusOption = "none" | "sm" | "md" | "lg" | "xl" | "full";
export const radiusOptions: { name: RadiusOption; label: string; value: string; preview: string }[] = [
  { name: "none", label: "Sharp", value: "0", preview: "rounded-none" },
  { name: "sm", label: "Small", value: "0.25rem", preview: "rounded-sm" },
  { name: "md", label: "Medium", value: "0.5rem", preview: "rounded-md" },
  { name: "lg", label: "Large", value: "0.75rem", preview: "rounded-lg" },
  { name: "xl", label: "Extra Large", value: "1rem", preview: "rounded-xl" },
  { name: "full", label: "Full", value: "1.5rem", preview: "rounded-2xl" },
];

export type FontSizeOption = "xs" | "sm" | "default" | "lg" | "xl";
export const fontSizeOptions: { name: FontSizeOption; label: string; scale: number }[] = [
  { name: "xs", label: "Extra Small", scale: 0.85 },
  { name: "sm", label: "Small", scale: 0.925 },
  { name: "default", label: "Default", scale: 1 },
  { name: "lg", label: "Large", scale: 1.075 },
  { name: "xl", label: "Extra Large", scale: 1.15 },
];

export type SidebarStyle = "light" | "dark" | "colored";

export interface NexoraTheme {
  mode: "light" | "dark" | "system";
  color: string; // preset name or "custom"
  customColor?: string; // hex color when color="custom"
  font: string; // font option name
  fontSize: FontSizeOption;
  radius: RadiusOption;
  sidebarStyle: SidebarStyle;
  compactSidebar: boolean;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
}

export const defaultTheme: NexoraTheme = {
  mode: "light",
  color: "blue",
  font: "inter",
  fontSize: "default",
  radius: "md",
  sidebarStyle: "light",
  compactSidebar: false,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
};

// Always return defaults when no backend data — no localStorage leakage between users
export function loadTheme(): NexoraTheme {
  return defaultTheme;
}

export async function loadThemeFromBackend(): Promise<NexoraTheme> {
  try {
    // Only attempt if user has a token
    if (typeof window !== "undefined" && !localStorage.getItem("accessToken")) {
      return defaultTheme;
    }
    const { authApi } = await import("@/lib/api");
    const res = await authApi.getPreferences();
    const prefs = res.data as Record<string, unknown> | undefined;
    if (prefs?.theme) {
      return { ...defaultTheme, ...(prefs.theme as Partial<NexoraTheme>) };
    }
  } catch {
    // Not logged in or API error — use defaults
  }
  return defaultTheme;
}

export async function saveThemeToBackend(theme: NexoraTheme): Promise<void> {
  // Apply immediately, persist to backend only
  try {
    const { authApi } = await import("@/lib/api");
    await authApi.updatePreferences({ theme });
  } catch {
    // Silent fail
  }
}

// Reset theme to defaults (call on logout)
export function resetTheme(): void {
  applyTheme(defaultTheme);
}

// Convert hex to HSL string (e.g. "203 65% 47%")
export function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Generate a light variant of a color for backgrounds
function lightenHSL(hsl: string): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  return `${parts[1]} ${Math.min(parseInt(parts[2]) + 20, 90)}% 96%`;
}

// Load a Google Font dynamically
function loadGoogleFont(fontName: string) {
  if (typeof document === "undefined") return;
  const id = `gfont-${fontName.replace(/\+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

// Apply the full theme to the document
export function applyTheme(theme: NexoraTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Mode (light/dark)
  if (theme.mode === "dark") {
    root.classList.add("dark");
  } else if (theme.mode === "light") {
    root.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  // 2. Color
  let colorPreset = colorPresets.find(c => c.name === theme.color);
  if (theme.color === "custom" && theme.customColor) {
    const hsl = hexToHSL(theme.customColor);
    colorPreset = {
      name: "custom",
      label: "Custom",
      hex: theme.customColor,
      hsl,
      hslForeground: "210 40% 98%",
      hslRing: hsl,
      hslLight: lightenHSL(hsl),
    };
  }
  if (colorPreset) {
    root.style.setProperty("--primary", colorPreset.hsl);
    root.style.setProperty("--primary-foreground", colorPreset.hslForeground);
    root.style.setProperty("--ring", colorPreset.hslRing);
    root.style.setProperty("--primary-light", colorPreset.hslLight);
    // Also set the raw hex for components using hardcoded colors
    root.style.setProperty("--primary-hex", colorPreset.hex);
  }

  // 3. Font
  const font = fontOptions.find(f => f.name === theme.font);
  if (font) {
    if (font.googleFont) loadGoogleFont(font.googleFont);
    root.style.setProperty("--font-sans", font.value);
    root.style.fontFamily = font.value;
    document.body.style.fontFamily = font.value;
  }

  // 4. Font size
  const fontSize = fontSizeOptions.find(f => f.name === theme.fontSize);
  if (fontSize) {
    root.style.fontSize = `${fontSize.scale * 16}px`;
  }

  // 5. Radius
  const radius = radiusOptions.find(r => r.name === theme.radius);
  if (radius) {
    root.style.setProperty("--radius", radius.value);
  }

  // 6. Sidebar style
  root.setAttribute("data-sidebar", theme.sidebarStyle);
}
