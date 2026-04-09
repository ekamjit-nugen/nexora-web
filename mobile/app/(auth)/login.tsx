import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput as RNTextInput,
  Animated,
  Dimensions,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  HelperText,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const { width } = Dimensions.get("window");

type Step = "email" | "otp";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRef = useRef<RNTextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 150);
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authApi.sendOtp(email.trim().toLowerCase());
      setOtpSent(true);
      setResendCooldown(60);
      animateTransition(() => setStep("otp"));
      setTimeout(() => otpInputRef.current?.focus(), 400);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }
    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authApi.verifyOtp(email.trim().toLowerCase(), otp);
      const accessToken = res.data?.accessToken || res.data?.tokens?.accessToken;
      const refreshToken = res.data?.refreshToken || res.data?.tokens?.refreshToken;
      if (accessToken && refreshToken) {
        await login({ accessToken, refreshToken });
        router.replace("/(tabs)");
      } else {
        setError("Invalid response from server");
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp("");
    setError("");
    setLoading(true);

    try {
      await authApi.sendOtp(email.trim().toLowerCase());
      setResendCooldown(60);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    animateTransition(() => {
      setStep("email");
      setOtp("");
      setError("");
      setOtpSent(false);
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>N</Text>
                </View>
                <View style={styles.logoDot} />
              </View>
              <Text style={styles.title}>Nexora</Text>
              <Text style={styles.subtitle}>Your unified workspace</Text>
            </View>

            {/* Form Card */}
            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
              {step === "email" ? (
                <>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={24}
                      color={COLORS.primary}
                    />
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Welcome back</Text>
                      <Text style={styles.cardSubtitle}>
                        Enter your email to receive a one-time code
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    label="Email address"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError("");
                    }}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    outlineColor={COLORS.border}
                    activeOutlineColor={COLORS.primary}
                    left={
                      <TextInput.Icon
                        icon="at"
                        color={COLORS.textMuted}
                      />
                    }
                    onSubmitEditing={handleSendOtp}
                    returnKeyType="send"
                    disabled={loading}
                    theme={{ roundness: RADIUS.md }}
                  />

                  {error ? (
                    <HelperText type="error" visible={!!error} style={styles.errorText}>
                      {error}
                    </HelperText>
                  ) : null}

                  <Button
                    mode="contained"
                    onPress={handleSendOtp}
                    loading={loading}
                    disabled={loading || !email.trim()}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                    theme={{ roundness: RADIUS.md }}
                  >
                    Continue
                  </Button>
                </>
              ) : (
                <>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={24}
                      color={COLORS.primary}
                    />
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>
                        Verification code
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        We sent a 6-digit code to{"\n"}
                        <Text style={styles.emailHighlight}>{email}</Text>
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    ref={otpInputRef}
                    label="Enter code"
                    value={otp}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
                      setOtp(cleaned);
                      setError("");
                    }}
                    mode="outlined"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, styles.otpInput]}
                    outlineStyle={styles.inputOutline}
                    outlineColor={COLORS.border}
                    activeOutlineColor={COLORS.primary}
                    left={
                      <TextInput.Icon
                        icon="lock-outline"
                        color={COLORS.textMuted}
                      />
                    }
                    onSubmitEditing={handleVerifyOtp}
                    returnKeyType="done"
                    disabled={loading}
                    theme={{ roundness: RADIUS.md }}
                  />

                  {error ? (
                    <HelperText type="error" visible={!!error} style={styles.errorText}>
                      {error}
                    </HelperText>
                  ) : null}

                  <Button
                    mode="contained"
                    onPress={handleVerifyOtp}
                    loading={loading}
                    disabled={loading || otp.length !== 6}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                    theme={{ roundness: RADIUS.md }}
                  >
                    Verify & Sign In
                  </Button>

                  <View style={styles.otpActions}>
                    <Button
                      mode="text"
                      onPress={handleResendOtp}
                      disabled={loading || resendCooldown > 0}
                      compact
                      labelStyle={styles.linkText}
                      icon="refresh"
                    >
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend"}
                    </Button>
                    <Button
                      mode="text"
                      onPress={handleBack}
                      disabled={loading}
                      compact
                      labelStyle={styles.linkText}
                      icon="arrow-left"
                    >
                      Change Email
                    </Button>
                  </View>
                </>
              )}
            </Animated.View>

            {/* Dev credentials hint */}
            {__DEV__ && (
              <View style={styles.devBanner}>
                <MaterialCommunityIcons
                  name="bug-outline"
                  size={16}
                  color="rgba(255,255,255,0.7)"
                />
                <Text style={styles.devBannerTitle}>
                  DEV MODE — OTP: 000000
                </Text>
                <Text style={styles.devBannerText}>
                  admin@nexora.io · hr@nexora.io · dev@nexora.io
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING.xl + 8,
  },
  logoContainer: {
    marginBottom: SPACING.md,
    position: "relative",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#34D399",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  logoText: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "500",
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg + 4,
    backgroundColor: COLORS.surface,
    ...SHADOWS.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emailHighlight: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.xs,
  },
  inputOutline: {
    borderRadius: RADIUS.md,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
  },
  errorText: {
    marginBottom: 0,
  },
  button: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  otpActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.md,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  devBanner: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: "center",
    gap: SPACING.xs,
  },
  devBannerTitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "600",
  },
  devBannerText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.55)",
  },
});
