"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ConfirmModal } from "@/components/confirm-modal";
import { toast } from "sonner";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (score <= 4) return { score: 3, label: "Good", color: "bg-blue-500" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [mfaLoading, setMfaLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; variant?: "danger" | "warning" | "info"; confirmLabel?: string; action: () => void}>({open: false, title: "", message: "", action: () => {}});

  if (!user) return null;

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to change password");
      }
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetupMfa = async () => {
    setMfaLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/mfa/setup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to setup MFA");
      setQrCode(data.data?.qrCode || data.data?.qr || null);
      setMfaSecret(data.data?.secret || null);
      toast.success("Scan the QR code with your authenticator app");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to setup MFA";
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    setMfaLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/mfa/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: verifyCode }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid code");
      }
      toast.success("MFA enabled successfully");
      setQrCode(null);
      setMfaSecret(null);
      setVerifyCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to verify MFA";
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = () => {
    setConfirmState({
      open: true,
      title: "Disable Two-Factor Authentication",
      message: "Are you sure you want to disable two-factor authentication?",
      variant: "warning",
      confirmLabel: "Disable",
      action: async () => {
        setConfirmState(s => ({...s, open: false}));
        setMfaLoading(true);
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/mfa`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Failed to disable MFA");
          }
          toast.success("MFA disabled");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to disable MFA";
          toast.error(message);
        } finally {
          setMfaLoading(false);
        }
      },
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oauthProviders = (user as any).oauthProviders;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Security</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Manage your password, two-factor authentication, and connected accounts.
        </p>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Change Password</h3>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="Enter new password"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} rounded-full transition-all`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    strength.score <= 1 ? "text-red-600" :
                    strength.score <= 2 ? "text-amber-600" :
                    strength.score <= 3 ? "text-blue-600" : "text-emerald-600"
                  }`}>
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="Confirm new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="bg-[#2E86C1] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#2874A6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changingPassword ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Two-Factor Authentication</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Add an extra layer of security to your account.
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              user.mfaEnabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {user.mfaEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {qrCode && (
          <div className="mb-5 p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <p className="text-sm font-medium text-[#0F172A] mb-3">
              Scan this QR code with your authenticator app:
            </p>
            <div className="flex items-start gap-5">
              <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
              </div>
              <div className="flex-1">
                {mfaSecret && (
                  <div className="mb-3">
                    <p className="text-xs text-[#64748B] mb-1">Manual entry key:</p>
                    <code className="text-xs bg-white border border-[#E2E8F0] rounded px-2 py-1 font-mono text-[#334155] break-all">
                      {mfaSecret}
                    </code>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-36 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                    />
                    <button
                      onClick={handleVerifyMfa}
                      disabled={mfaLoading || verifyCode.length !== 6}
                      className="bg-[#2E86C1] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#2874A6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.mfaEnabled ? (
          <button
            onClick={handleDisableMfa}
            disabled={mfaLoading}
            className="bg-red-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mfaLoading ? "Processing..." : "Disable MFA"}
          </button>
        ) : (
          !qrCode && (
            <button
              onClick={handleSetupMfa}
              disabled={mfaLoading}
              className="bg-[#2E86C1] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#2874A6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mfaLoading ? "Setting up..." : "Setup MFA"}
            </button>
          )
        )}
      </div>

      {/* Connected Accounts */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Connected Accounts</h3>

        <div className="space-y-3">
          {/* Google */}
          <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Google</p>
                <p className="text-xs text-[#64748B]">
                  {oauthProviders?.includes("google") ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                oauthProviders?.includes("google")
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200"
              }`}
            >
              {oauthProviders?.includes("google") ? "Connected" : "Not connected"}
            </span>
          </div>

          {/* Microsoft */}
          <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Microsoft</p>
                <p className="text-xs text-[#64748B]">
                  {oauthProviders?.includes("microsoft") ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                oauthProviders?.includes("microsoft")
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200"
              }`}
            >
              {oauthProviders?.includes("microsoft") ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({...s, open: false}))}
      />
    </div>
  );
}
