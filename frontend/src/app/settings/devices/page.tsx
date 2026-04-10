"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TrustedDevice {
  _id: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string; // desktop | mobile | tablet
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  ipAddress?: string;
  location?: {
    city?: string;
    country?: string;
    region?: string;
  };
  isCurrent?: boolean;
  isTrusted?: boolean;
  isRevoked?: boolean;
  lastActiveAt?: string;
  createdAt?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "\u2014";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} months ago`;
  return `${Math.floor(diffDay / 365)} years ago`;
};

const maskIp = (ip?: string) => {
  if (!ip) return "\u2014";
  if (ip.includes(":")) {
    // IPv6 - keep first 4 segments
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::x";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.x.x`;
};

const getDeviceIcon = (device: TrustedDevice): string => {
  const os = (device.os || "").toLowerCase();
  const type = (device.deviceType || "").toLowerCase();
  if (os.includes("ios") || os.includes("iphone")) return "\u{1F4F1}";
  if (os.includes("android")) return "\u{1F4F1}";
  if (type === "mobile") return "\u{1F4F1}";
  if (type === "tablet") return "\u{1F4F2}";
  if (os.includes("mac") || os.includes("darwin")) return "\u{1F4BB}";
  if (os.includes("win")) return "\u{1F5A5}\uFE0F";
  if (os.includes("linux")) return "\u{1F427}";
  return "\u{1F4BB}";
};

const buildDeviceTitle = (device: TrustedDevice): string => {
  if (device.deviceName) return device.deviceName;
  const browser = device.browser || "Browser";
  const os = device.os || "Unknown OS";
  return `${browser} on ${os}`;
};

const buildLocation = (device: TrustedDevice): string => {
  const loc = device.location;
  if (!loc) return "Unknown location";
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  if (parts.length === 0) return "Unknown location";
  return parts.join(", ");
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TrustedDevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [showSingleRevokeModal, setShowSingleRevokeModal] = useState<TrustedDevice | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------
  const fetchDevices = useCallback(async () => {
    try {
      const res = await authApi.getMyDevices();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.devices ?? (res as any)?.data?.devices ?? [];
      // Sort: current first, then by lastActiveAt desc
      const sorted = [...data].sort((a: TrustedDevice, b: TrustedDevice) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        const aT = new Date(a.lastActiveAt || a.createdAt || 0).getTime();
        const bT = new Date(b.lastActiveAt || b.createdAt || 0).getTime();
        return bT - aT;
      });
      setDevices(sorted);
    } catch (err: any) {
      toast.error(err.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchDevices();
  }, [user, fetchDevices]);

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const active = devices.filter((d) => !d.isRevoked);
    return {
      total: devices.length,
      active: active.length,
      trusted: devices.filter((d) => d.isTrusted && !d.isRevoked).length,
      revoked: devices.filter((d) => d.isRevoked).length,
    };
  }, [devices]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleRevokeDevice = async (device: TrustedDevice) => {
    if (device.isCurrent) {
      toast.error("Cannot revoke current device");
      return;
    }
    setActionId(device._id);
    try {
      await authApi.revokeDevice(device._id, revokeReason || "user_requested");
      toast.success(`${buildDeviceTitle(device)} revoked`);
      setShowSingleRevokeModal(null);
      setRevokeReason("");
      await fetchDevices();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke device");
    } finally {
      setActionId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await authApi.revokeAllDevices();
      toast.success("All other devices revoked");
      setShowRevokeAllModal(false);
      await fetchDevices();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke devices");
    } finally {
      setRevokingAll(false);
    }
  };

  if (!user) return null;

  const hasOtherDevices = devices.some((d) => !d.isCurrent && !d.isRevoked);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A]">Trusted Devices</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            Review the devices that have recently accessed your account.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!hasOtherDevices}
          onClick={() => setShowRevokeAllModal(true)}
          className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Revoke All Other Sessions
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <svg className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[13px] text-blue-900 leading-relaxed">
          These are devices and browsers currently signed in to your account. Revoke any you don&apos;t recognize.
          We track location, IP, and browser fingerprint to help you spot unusual activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Devices", value: stats.total, color: "border-l-[#2E86C1]" },
          { label: "Active Sessions", value: stats.active, color: "border-l-green-500" },
          { label: "Trusted", value: stats.trusted, color: "border-l-purple-500" },
          { label: "Revoked", value: stats.revoked, color: "border-l-gray-400" },
        ].map((s) => (
          <Card key={s.label} className={`rounded-xl border shadow-sm border-l-4 ${s.color}`}>
            <CardContent className="p-4">
              <p className="text-[12px] text-[#64748B]">{s.label}</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Device list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-[#64748B] mt-3 text-[14px]">No devices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const isRevoked = !!device.isRevoked;
            return (
              <Card
                key={device._id}
                className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${
                  device.isCurrent ? "border-[#2E86C1] bg-[#F0F9FF]" : isRevoked ? "border-gray-200 bg-gray-50/60" : "border-[#E2E8F0] bg-white"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      device.isCurrent ? "bg-[#DBEAFE]" : isRevoked ? "bg-gray-100" : "bg-[#F1F5F9]"
                    }`}>
                      <span aria-hidden="true">{getDeviceIcon(device)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-[#0F172A]">
                          {buildDeviceTitle(device)}
                        </h3>
                        {device.isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2E86C1] text-white">
                            Current Device
                          </span>
                        )}
                        {device.isTrusted && !isRevoked && !device.isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            Trusted
                          </span>
                        )}
                        {isRevoked && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Revoked
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-[12px] text-[#64748B]">
                        {(device.browser || device.browserVersion) && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
                            </svg>
                            <span className="truncate">
                              {device.browser} {device.browserVersion && `\u00B7 ${device.browserVersion}`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{buildLocation(device)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.07a10 10 0 0114.142 0M1.394 9.393a15 15 0 0121.213 0" />
                          </svg>
                          <span className="truncate font-mono">{maskIp(device.ipAddress)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate">
                            Last active {formatRelativeTime(device.lastActiveAt || device.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!device.isCurrent && !isRevoked && (
                      <div className="shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionId === device._id}
                          onClick={() => setShowSingleRevokeModal(device)}
                          className="h-8 text-[12px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {actionId === device._id ? "Revoking..." : "Revoke"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Revoke All Modal */}
      {showRevokeAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#0F172A]">Revoke all other sessions?</h3>
                <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
                  This will sign out all other devices. You&apos;ll need to log in again on them. Your current device
                  will remain signed in.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRevokeAllModal(false)} disabled={revokingAll}>
                Cancel
              </Button>
              <Button
                onClick={handleRevokeAll}
                disabled={revokingAll}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {revokingAll ? "Revoking..." : "Revoke All"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single Revoke Modal */}
      {showSingleRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[#0F172A]">Revoke device?</h3>
            <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
              <span className="font-semibold text-[#0F172A]">{buildDeviceTitle(showSingleRevokeModal)}</span> will be
              signed out immediately and will need to log in again.
            </p>
            <div className="mt-4">
              <label className="text-[12px] font-medium text-[#64748B]">Reason (optional)</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Lost device, unrecognized activity..."
                rows={3}
                className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/30 focus:border-[#2E86C1] resize-none"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSingleRevokeModal(null);
                  setRevokeReason("");
                }}
                disabled={actionId !== null}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleRevokeDevice(showSingleRevokeModal)}
                disabled={actionId !== null}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {actionId ? "Revoking..." : "Revoke Device"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
