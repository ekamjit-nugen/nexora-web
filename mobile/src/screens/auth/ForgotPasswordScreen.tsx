import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AuthStackNavigationProp } from '../../types/navigation';

interface ForgotPasswordScreenProps {
  navigation: AuthStackNavigationProp;
}

type Step = 'email' | 'otp' | 'password' | 'success';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState(0);

  // Simulated OTP (in production, would come from backend)
  const [sentOtp] = useState('123456');

  const validateEmail = (emailStr: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleSendOtp = async () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call to send OTP
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In production, this would be sent via backend
      Alert.alert(
        'OTP Sent',
        `A password reset code has been sent to ${email}\n\nDemo OTP: ${sentOtp}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setStep('otp');
              setCountdown(60);
            },
          },
        ]
      );
    } catch (err: any) {
      setErrors({
        general: err.message || 'Failed to send OTP',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const newErrors: Record<string, string> = {};

    if (!otp.trim()) {
      newErrors.otp = 'OTP is required';
    } else if (otp.length !== 6) {
      newErrors.otp = 'OTP must be 6 digits';
    } else if (otp !== sentOtp) {
      newErrors.otp = 'Invalid OTP. Try again.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call to verify OTP
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep('password');
      setErrors({});
    } catch (err: any) {
      setErrors({
        general: err.message || 'Failed to verify OTP',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call to reset password
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setStep('success');
    } catch (err: any) {
      setErrors({
        general: err.message || 'Failed to reset password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setCountdown(60);
      Alert.alert('Success', `OTP resent to ${email}`);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressDots}>
              <View
                style={[
                  styles.progressDot,
                  (step === 'email' ||
                    step === 'otp' ||
                    step === 'password' ||
                    step === 'success') &&
                    styles.progressDotActive,
                ]}
              />
              <View
                style={[
                  styles.progressDot,
                  (step === 'otp' || step === 'password' || step === 'success') &&
                    styles.progressDotActive,
                ]}
              />
              <View
                style={[
                  styles.progressDot,
                  (step === 'password' || step === 'success') &&
                    styles.progressDotActive,
                ]}
              />
              <View
                style={[styles.progressDot, step === 'success' && styles.progressDotActive]}
              />
            </View>
          </View>

          {/* Step Content */}
          {step === 'email' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter Your Email</Text>
              <Text style={styles.stepDescription}>
                We'll send you a code to reset your password
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {errors.general && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorMessage}>{errors.general}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>Send Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'otp' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter Verification Code</Text>
              <Text style={styles.stepDescription}>
                We sent a 6-digit code to {email}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.otpInput, errors.otp && styles.inputError]}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  value={otp}
                  onChangeText={(text) => {
                    if (/^\d*$/.test(text) && text.length <= 6) {
                      setOtp(text);
                      if (errors.otp) setErrors({ ...errors, otp: undefined });
                    }
                  }}
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}
              </View>

              {countdown > 0 ? (
                <Text style={styles.countdownText}>
                  Resend code in {countdown}s
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={isLoading}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendButtonText}>Didn't receive code? Resend</Text>
                </TouchableOpacity>
              )}

              {errors.general && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorMessage}>{errors.general}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'password' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Create New Password</Text>
              <Text style={styles.stepDescription}>
                Enter a strong password that you haven't used before
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={[styles.passwordInput, errors.newPassword && styles.inputError]}>
                  <TextInput
                    style={styles.passwordTextInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (errors.newPassword)
                        setErrors({ ...errors, newPassword: undefined });
                    }}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.newPassword && (
                  <Text style={styles.errorText}>{errors.newPassword}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}>
                  <TextInput
                    style={styles.passwordTextInput}
                    placeholder="Confirm your password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword)
                        setErrors({ ...errors, confirmPassword: undefined });
                    }}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword && (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                )}
              </View>

              {/* Password Requirements */}
              <View style={styles.requirements}>
                <Text
                  style={[
                    styles.requirementText,
                    newPassword.length >= 8 && styles.requirementMet,
                  ]}
                >
                  {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    newPassword === confirmPassword &&
                      newPassword.length > 0 &&
                      styles.requirementMet,
                  ]}
                >
                  {newPassword === confirmPassword && newPassword.length > 0
                    ? '✓'
                    : '○'}{' '}
                  Passwords match
                </Text>
              </View>

              {errors.general && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorMessage}>{errors.general}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.stepContent}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>

              <Text style={styles.stepTitle}>Password Reset Successful</Text>
              <Text style={styles.stepDescription}>
                Your password has been reset successfully. You can now sign in with your new
                password.
              </Text>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.continueButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {step !== 'success' && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={isLoading}
              style={styles.backToLogin}
            >
              <Text style={styles.backToLoginText}>Back to Login</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  progressDotActive: {
    backgroundColor: '#fff',
  },
  stepContent: {
    marginBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  otpInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    color: '#333',
    borderWidth: 1,
    borderColor: 'transparent',
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'Menlo',
  },
  passwordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  passwordTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  eyeIcon: {
    fontSize: 20,
    marginLeft: 10,
  },
  inputError: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  errorMessage: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '600',
  },
  requirements: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  requirementText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginVertical: 6,
    fontWeight: '500',
  },
  requirementMet: {
    color: '#6bcf7f',
  },
  countdownText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  resendButton: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  continueButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '700',
  },
  backToLogin: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  backToLoginText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#6bcf7f',
    fontWeight: '700',
  },
});
