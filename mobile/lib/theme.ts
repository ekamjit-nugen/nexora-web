import { MD3LightTheme } from "react-native-paper";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Design system v2 — refined fintech-style.
//
// Goal: a modern HR/payroll surface with visual personality and depth,
// without the busy "enterprise dashboard" feel.
//
// Pattern bank:
//   • Hero cards: dark indigo→violet gradient, white text. Use ONE per
//     screen for the primary moment (today's status, balance, headline
//     stat). They anchor the page visually.
//   • Standard cards: white surface, 1px border + subtle shadow. Used
//     everywhere else — supporting info should not compete with the hero.
//   • Quick actions / categories: each gets its own soft-tinted icon
//     background drawn from the curated TONES below. Colours feel
//     differentiated but stay in the same warm-cool family — no clashing.
//   • Status pills: success / warn / danger reserved for actual status,
//     never decorative.
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // ─── Brand ────────────────────────────────────────────────────────────────
  // Deep, refined indigo — richer than the generic SaaS blue, sophisticated
  // enough to anchor hero gradients.
  primary: "#4338CA",
  primaryLight: "#EEF2FF",
  primaryDark: "#312E81",
  primaryMuted: "#A5B4FC",

  // Secondary = same indigo family so legacy refs read as one brand.
  secondary: "#4338CA",
  secondaryLight: "#EEF2FF",

  // Accent — vivid violet for the hero gradient end-stop and the rare
  // second-tier highlight (e.g. "premium" badges).
  accent: "#7C3AED",
  accentLight: "#F5F3FF",

  // ─── Status (badges / pills only) ─────────────────────────────────────────
  success: "#16A34A",
  successLight: "#DCFCE7",
  warning: "#D97706",
  warningLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  info: "#0891B2",
  infoLight: "#CFFAFE",

  // ─── Neutrals ────────────────────────────────────────────────────────────
  background: "#F7F7F8",        // page bg — warm, with the faintest violet undertone
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F4F4F5",      // input bg, subtle wash

  text: "#0F172A",              // primary text — slate-900 for crisp contrast on white
  textSecondary: "#475569",     // body / subtitle
  textMuted: "#94A3B8",         // captions, placeholders

  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  divider: "#F1F5F9",
  overlay: "rgba(15, 23, 42, 0.55)",

  // ─── Tab bar ─────────────────────────────────────────────────────────────
  // Active = brand indigo so the bar reads as part of the brand surface,
  // not a generic chrome element.
  tabActive: "#4338CA",
  tabInactive: "#94A3B8",
  tabBar: "#FFFFFF",

  // ─── Hero gradient stops ─────────────────────────────────────────────────
  // The signature visual element — used on hero cards (NOT page-wide
  // headers). Indigo → violet, with a slate-deep variant for richer
  // dark surfaces (e.g. profile hero, hero on otherwise busy screens).
  gradientStart: "#4338CA",     // deep indigo
  gradientEnd: "#7C3AED",       // vivid violet
  gradientSoft: "#6366F1",      // mid-stop / fallback
  gradientDeep: "#1E1B4B",      // near-black indigo for darker hero cards

  // ─── Curated icon tones ──────────────────────────────────────────────────
  // Soft tints used as backgrounds for category icons. Pick from this
  // bank rather than inventing one-off colours so the app reads as a
  // single palette across screens.
  toneIndigo:  { bg: "#EEF2FF", fg: "#4338CA" },
  toneViolet:  { bg: "#F5F3FF", fg: "#7C3AED" },
  toneTeal:    { bg: "#ECFEFF", fg: "#0E7490" },
  toneAmber:   { bg: "#FEF3C7", fg: "#B45309" },
  toneRose:    { bg: "#FFE4E6", fg: "#BE185D" },
  toneEmerald: { bg: "#DCFCE7", fg: "#15803D" },
  toneSky:     { bg: "#E0F2FE", fg: "#0369A1" },
  toneSlate:   { bg: "#F1F5F9", fg: "#334155" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — 4pt grid.
// ─────────────────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ─────────────────────────────────────────────────────────────────────────────
// Radii — generous on hero / large surfaces, tighter on chips & inputs.
// ─────────────────────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shadows — soft, layered. Cards get .sm; hero / floating elements get .md.
// `colored()` returns a brand-tinted glow used SPARINGLY on the primary CTA
// of a screen so it visually ties to the hero gradient.
// ─────────────────────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  // Brand-tinted glow under the hero gradient card and the primary CTA.
  // Keeps the indigo presence felt even after the gradient ends.
  colored: (color: string = "#4338CA") => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  }),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography scale — use these as `style={[FONTS.title, ...]}`.
// ─────────────────────────────────────────────────────────────────────────────
export const FONTS = {
  display: {
    fontSize: 30,
    fontWeight: "800" as const,
    letterSpacing: -0.7,
    color: COLORS.text,
  },
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    color: COLORS.text,
  },
  heading: {
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  subheading: {
    fontSize: 15,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
    color: COLORS.text,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: COLORS.text,
  },
  bodySecondary: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: COLORS.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: COLORS.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Reusable surface tokens.
// ─────────────────────────────────────────────────────────────────────────────
export const SURFACES = {
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...{
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
  },
  cardSubtle: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  // Hero gradient stops as a tuple — pass directly to <LinearGradient colors>.
  heroGradient: ["#4338CA", "#7C3AED"] as const,
  heroGradientDeep: ["#1E1B4B", "#4338CA"] as const,
} as const;

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
    surfaceVariant: COLORS.surfaceMuted,
    error: COLORS.danger,
    onPrimary: "#FFFFFF",
    onBackground: COLORS.text,
    onSurface: COLORS.text,
    outline: COLORS.border,
  },
};
