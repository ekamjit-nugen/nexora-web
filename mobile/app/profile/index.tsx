import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
} from "react-native";
import { Text, TextInput, ActivityIndicator, Portal, Modal } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth-context";
import { authApi, mediaApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS, SURFACES } from "../../lib/theme";

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || "";
  const l = lastName?.charAt(0)?.toUpperCase() || "";
  return f + l || "?";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRoleLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconWrap}>
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, currentOrg, refreshUser } = useAuth();

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "User";

  // ─── Edit modal state ────────────────────────────────────────────
  const [editVisible, setEditVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formError, setFormError] = useState("");

  // Reset the form whenever the modal opens so the user always sees
  // their current values pre-filled (and never stale state from a
  // previous open).
  useEffect(() => {
    if (editVisible) {
      setFirstName(user?.firstName || "");
      setLastName(user?.lastName || "");
      setPhoneNumber((user as any)?.phoneNumber || (user as any)?.phone || "");
      setFormError("");
    }
  }, [editVisible, user]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
    }) => authApi.updateProfile(data),
    onSuccess: async () => {
      // Pull the fresh user record into the auth context so every screen
      // (Home greeting, More header, etc.) updates immediately.
      await refreshUser();
      setEditVisible(false);
      Alert.alert("Profile updated", "Your changes are saved.");
    },
    onError: (err: any) => {
      setFormError(err?.message || "Failed to update profile.");
    },
  });

  // ─── Avatar upload ───────────────────────────────────────────────
  // Two-step: pick locally → upload to media-service → patch user.avatar
  // with the returned storageUrl. We track avatar progress separately from
  // the text-form save so a slow upload doesn't block the modal.
  const [avatarUploading, setAvatarUploading] = useState(false);

  const uploadAndSetAvatar = async (localUri: string) => {
    setAvatarUploading(true);
    try {
      const { storageUrl } = await mediaApi.uploadImage(localUri, {
        accessLevel: "public",
        fileName: `avatar-${Date.now()}.jpg`,
      });
      await authApi.updateProfile({ avatar: storageUrl });
      await refreshUser();
    } catch (err: any) {
      Alert.alert(
        "Couldn't update photo",
        err?.message || "Please try a smaller image or check your connection.",
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Enable photo access in Settings to pick a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],     // square crop — matches the round avatar circle
      quality: 0.7,        // 0.7 keeps file size reasonable; avatar doesn't need 4K
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadAndSetAvatar(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "Enable camera access in Settings to take a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadAndSetAvatar(result.assets[0].uri);
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    try {
      await authApi.updateProfile({ avatar: "" });
      await refreshUser();
    } catch (err: any) {
      Alert.alert("Couldn't remove photo", err?.message || "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  // Avatar tap → action sheet (iOS) / Alert (Android) so the user can
  // choose between camera, photo library, or removing the existing photo.
  const handleAvatarPress = () => {
    const hasAvatar = !!(user as any)?.avatar;
    const options = hasAvatar
      ? ["Take Photo", "Choose from Library", "Remove Photo", "Cancel"]
      : ["Take Photo", "Choose from Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: hasAvatar ? 2 : undefined,
        },
        (idx) => {
          if (idx === 0) takePhoto();
          else if (idx === 1) pickFromLibrary();
          else if (hasAvatar && idx === 2) removeAvatar();
        },
      );
    } else {
      const buttons: any[] = [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickFromLibrary },
      ];
      if (hasAvatar) {
        buttons.push({
          text: "Remove Photo",
          style: "destructive",
          onPress: removeAvatar,
        });
      }
      buttons.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Profile picture", undefined, buttons);
    }
  };

  const handleSave = () => {
    setFormError("");
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (fn.length < 2) {
      setFormError("First name must be at least 2 characters.");
      return;
    }
    if (ln.length < 2) {
      setFormError("Last name must be at least 2 characters.");
      return;
    }
    // Only send fields that actually changed — keeps the audit log clean
    // and avoids sending blank phone numbers if the user never had one.
    const payload: Record<string, string> = {};
    if (fn !== (user?.firstName || "")) payload.firstName = fn;
    if (ln !== (user?.lastName || "")) payload.lastName = ln;
    const currentPhone = (user as any)?.phoneNumber || (user as any)?.phone || "";
    if (phoneNumber.trim() !== currentPhone) payload.phoneNumber = phoneNumber.trim();
    if (Object.keys(payload).length === 0) {
      setEditVisible(false);
      return;
    }
    updateMutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      {/* Deep gradient profile hero — back button on the left, edit
          pencil on the right so the action is always within thumb reach. */}
      <SafeAreaView edges={["top"]}>
        <LinearGradient
          colors={SURFACES.heroGradientDeep as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.heroBlobLg} />
          <View style={styles.heroBlobSm} />
          <View style={styles.headerContent}>
            <View style={styles.topRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.iconBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditVisible(true)}
                style={styles.editBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Tappable avatar — opens the action sheet for camera / library
                / remove. Shows the uploaded image if present, falls back to
                initials. The small camera badge in the corner signals it's
                an action surface (some users miss that the circle itself is
                tappable). */}
            <TouchableOpacity
              style={styles.avatarContainer}
              activeOpacity={0.85}
              onPress={handleAvatarPress}
              disabled={avatarUploading}
            >
              <View style={styles.avatar}>
                {(user as any)?.avatar ? (
                  <Image
                    source={{ uri: (user as any).avatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(user?.firstName, user?.lastName)}
                  </Text>
                )}
                {avatarUploading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <MaterialCommunityIcons
                  name="camera"
                  size={14}
                  color="#FFFFFF"
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.headerName}>{fullName}</Text>
            <Text style={styles.headerEmail}>{user?.email || ""}</Text>

            {user?.roles && user.roles.length > 0 && (
              <View style={styles.rolesRow}>
                {user.roles.map((role) => (
                  <View key={role} style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {formatRoleLabel(role)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Body */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Info Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="account-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Personal Info</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="account"
            label="First Name"
            value={user?.firstName || "—"}
          />
          <InfoRow
            icon="account"
            label="Last Name"
            value={user?.lastName || "—"}
          />
          <InfoRow
            icon="email-outline"
            label="Email"
            value={user?.email || "—"}
          />
          <InfoRow
            icon="phone-outline"
            label="Phone"
            value={(user as any)?.phoneNumber || (user as any)?.phone || "—"}
          />
        </View>

        {/* Organization Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="office-building-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Organization</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="domain"
            label="Organization"
            value={currentOrg?.name || "—"}
          />
          <InfoRow
            icon="briefcase-outline"
            label="Department"
            value={(user as any)?.department || "—"}
          />
          <InfoRow
            icon="badge-account-horizontal-outline"
            label="Designation"
            value={(user as any)?.designation || "—"}
          />
        </View>

        {/* Account Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="shield-account-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="calendar-clock"
            label="Member Since"
            value={formatDate((user as any)?.createdAt)}
          />
          {(user as any)?.lastLogin ? (
            <InfoRow
              icon="login"
              label="Last Login"
              value={formatDate((user as any).lastLogin)}
            />
          ) : null}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={styles.infoIconWrap}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.infoLabel}>Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── Edit modal ──────────────────────────────────────────── */}
      <Portal>
        <Modal
          visible={editVisible}
          onDismiss={() => !updateMutation.isPending && setEditVisible(false)}
          contentContainerStyle={styles.modalCard}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => !updateMutation.isPending && setEditVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCaption}>
              Update your display name and phone. Email isn't editable here —
              ping your admin if it needs changing.
            </Text>

            <TextInput
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              mode="outlined"
              style={styles.input}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              left={<TextInput.Icon icon="account-outline" />}
              theme={{ roundness: RADIUS.md }}
              autoCapitalize="words"
              maxLength={50}
            />
            <TextInput
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              mode="outlined"
              style={styles.input}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              left={<TextInput.Icon icon="account-outline" />}
              theme={{ roundness: RADIUS.md }}
              autoCapitalize="words"
              maxLength={50}
            />
            <TextInput
              label="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              mode="outlined"
              style={styles.input}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              left={<TextInput.Icon icon="phone-outline" />}
              keyboardType="phone-pad"
              theme={{ roundness: RADIUS.md }}
              placeholder="+91 98765 43210"
              maxLength={20}
            />

            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !updateMutation.isPending && setEditVisible(false)}
                disabled={updateMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  updateMutation.isPending && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={updateMutation.isPending}
                activeOpacity={0.85}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingBottom: SPACING.xl + 8,
    overflow: "hidden",
  },
  heroBlobLg: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroBlobSm: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    alignItems: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING.md,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  // Edit pill — visually distinct from a plain icon button so the user
  // sees there's an action they can take, not just navigation chrome.
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
    position: "relative",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.30)",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  // Dim overlay shown during upload — keeps the avatar visible while
  // signalling that work is in progress.
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
  },
  // Small floating camera pill in the bottom-right of the avatar — the
  // affordance that tells the user the avatar is interactive.
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  headerName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: SPACING.md,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 0.2,
    textTransform: "capitalize",
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm + 2,
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
    maxWidth: "50%",
    textAlign: "right",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
  // ─── Modal ───────────────────────────────────────────────────────
  modalCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  modalCaption: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  input: {
    marginBottom: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  saveBtn: {
    paddingHorizontal: SPACING.lg + 4,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.colored(COLORS.primary),
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
});
