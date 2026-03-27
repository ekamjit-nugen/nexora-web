import { MD3LightTheme } from "react-native-paper";
import { Platform } from "react-native";

export const COLORS = {
  // Primary palette
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  primaryDark: "#1E40AF",
  primaryMuted: "#93C5FD",

  // Secondary
  secondary: "#7C3AED",
  secondaryLight: "#F5F3FF",

  // Accents
  accent: "#0EA5E9",
  accentLight: "#E0F2FE",

  // Status colors
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  info: "#06B6D4",
  infoLight: "#CFFAFE",

  // Neutrals
  background: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  divider: "#F1F5F9",
  overlay: "rgba(15, 23, 42, 0.4)",

  // Gradient stops
  gradientStart: "#2563EB",
  gradientEnd: "#7C3AED",
  gradientSoft: "#3B82F6",

  // Tab bar
  tabActive: "#2563EB",
  tabInactive: "#94A3B8",
  tabBar: "#FFFFFF",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

export const FONTS = {
  heading: {
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  subheading: {
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  body: {
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  caption: {
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
};

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.primaryLight,
    secondary: COLORS.secondary,
    secondaryContainer: COLORS.secondaryLight,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceVariant: COLORS.borderLight,
    error: COLORS.danger,
    onPrimary: "#FFFFFF",
    onBackground: COLORS.text,
    onSurface: COLORS.text,
    outline: COLORS.border,
  },
};
