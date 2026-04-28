import React from "react";
import { View, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, SHADOWS, SURFACES } from "../lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// <Hero> — the canonical screen header used across the app.
//
// Every full-screen surface (Home, Time, Leaves, Timesheets, Directory, etc.)
// renders the same indigo→violet gradient with a decorative blob and the
// screen title. Variants:
//
//   • `title` — required. Big white display on the gradient.
//   • `subtitle` — optional secondary line under the title (org name, date,
//     count, etc.). Renders muted on the gradient.
//   • `showBack` — render a back chevron in a translucent glass pill on the
//     left, before the title row. Pops the navigation stack.
//   • `right` — optional ReactNode rendered top-right (action button(s),
//     avatar, etc.). Use the exported <HeroIconButton> for a single icon.
//   • `bottom` — optional ReactNode rendered below the title row, INSIDE the
//     gradient (e.g. segmented control, search box). Lifts naturally on the
//     hero so it shares the surface treatment.
//   • `variant` — "regular" (indigo→violet, default) or "deep" (near-black
//     → indigo, used for profile-style screens that want more weight).
//   • `compact` — slimmer top/bottom padding for screens where the hero is
//     a strip rather than a hero card (e.g. lists with their own dense
//     content below).
//
// Decorative blobs are a soft white ellipse top-right and a smaller one
// bottom-left (deep variant only) — adds depth without an image asset.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
  variant?: "regular" | "deep";
  compact?: boolean;
  style?: ViewStyle;
}

export function Hero({
  title,
  subtitle,
  showBack,
  right,
  bottom,
  variant = "regular",
  compact = false,
  style,
}: HeroProps) {
  const router = useRouter();
  const colors = (variant === "deep"
    ? SURFACES.heroGradientDeep
    : SURFACES.heroGradient) as unknown as string[];

  return (
    <SafeAreaView edges={["top"]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.hero,
          compact ? styles.heroCompact : styles.heroRegular,
          style,
        ]}
      >
        {/* Decorative ambient blobs — purely visual depth, no text. */}
        <View style={styles.blobLg} />
        {variant === "deep" && <View style={styles.blobSm} />}

        <View style={styles.topRow}>
          <View style={styles.titleCol}>
            {showBack && (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
            <Text
              style={[styles.title, compact && styles.titleCompact]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          {right && <View style={styles.rightSlot}>{right}</View>}
        </View>

        {bottom && <View style={styles.bottomSlot}>{bottom}</View>}
      </LinearGradient>
    </SafeAreaView>
  );
}

// Translucent glass pill — drop into <Hero right={...} /> for action buttons.
export function HeroIconButton({
  icon,
  onPress,
  badge,
}: {
  icon: any;
  onPress?: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={iconStyles.btn}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" />
      {!!badge && badge > 0 && (
        <View style={iconStyles.badge}>
          <Text style={iconStyles.badgeText}>
            {badge > 9 ? "9+" : String(badge)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    paddingHorizontal: SPACING.lg,
  },
  heroRegular: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  heroCompact: {
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.md,
  },
  // Blobs — soft ambient shapes.
  blobLg: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  blobSm: {
    position: "absolute",
    bottom: -40,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleCol: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 22,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "500",
    marginTop: 4,
    letterSpacing: 0.1,
  },
  rightSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingTop: 4,
  },
  bottomSlot: {
    marginTop: SPACING.md,
  },
});

const iconStyles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
