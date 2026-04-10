"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { payrollApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VerifiedCertificate {
  valid: boolean;
  revoked?: boolean;
  revokedReason?: string;
  certificateNumber?: string;
  courseTitle?: string;
  courseName?: string;
  category?: string;
  employeeName?: string;
  userName?: string;
  issuedAt?: string;
  issuedDate?: string;
  organizationName?: string;
  orgName?: string;
  score?: number;
  verificationCode?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function VerifyCertificatePage() {
  const params = useParams();
  const code = (params?.code as string) || "";

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCert = async () => {
      if (!code) {
        setError("No verification code provided");
        setLoading(false);
        return;
      }
      try {
        const res = await payrollApi.verifyCertificate(code);
        const data = res.data as VerifiedCertificate;
        setCert(data);
      } catch (err: any) {
        setError(err.message || "Certificate not found");
      } finally {
        setLoading(false);
      }
    };
    fetchCert();
  }, [code]);

  const isValid = cert && cert.valid !== false && !cert.revoked && !error;
  const isRevoked = cert && cert.revoked === true;
  const isNotFound = error !== null;

  const courseTitle = cert?.courseTitle || cert?.courseName || "\u2014";
  const employeeName = cert?.employeeName || cert?.userName || "\u2014";
  const orgName = cert?.organizationName || cert?.orgName || "\u2014";
  const issuedDate = cert?.issuedAt || cert?.issuedDate;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo / Brand */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">Nexora</span>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          {/* Status banner */}
          <div
            className={`px-8 py-6 flex items-center gap-4 ${
              isValid
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : isRevoked
                ? "bg-gradient-to-r from-amber-500 to-orange-600"
                : "bg-gradient-to-r from-red-500 to-rose-600"
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              {loading ? (
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              ) : isValid ? (
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">
                {loading
                  ? "Verifying..."
                  : isValid
                  ? "Certificate Verified"
                  : isRevoked
                  ? "Certificate Revoked"
                  : "Not Valid"}
              </h1>
              <p className="text-sm text-white/90 mt-1">
                {loading
                  ? "Please wait while we check this certificate."
                  : isValid
                  ? "This certificate is authentic and issued by Nexora."
                  : isRevoked
                  ? "This certificate has been revoked by the issuer."
                  : "We couldn't verify this certificate."}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            {loading ? (
              <div className="space-y-4">
                <div className="h-4 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            ) : isNotFound ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-600 mb-2">
                  No certificate was found with this verification code.
                </p>
                <p className="text-xs text-slate-400">
                  Please check the code and try again, or contact the issuing organization.
                </p>
                <div className="mt-4 inline-block bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">
                    Verification Code
                  </span>
                  <div className="font-mono text-sm text-slate-900">{code}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Course */}
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                    Course
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{courseTitle}</div>
                  {cert?.category && (
                    <div className="mt-1 text-xs text-slate-500 capitalize">
                      {cert.category.replace(/_/g, " ")}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200" />

                {/* Recipient + Org */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      Awarded To
                    </div>
                    <div className="text-base font-semibold text-slate-900 mt-1">
                      {employeeName}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      Issued By
                    </div>
                    <div className="text-base font-semibold text-slate-900 mt-1">{orgName}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      Issued On
                    </div>
                    <div className="text-sm text-slate-900 mt-1">{formatDate(issuedDate)}</div>
                  </div>
                  {typeof cert?.score === "number" && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                        Score Achieved
                      </div>
                      <div className="text-sm text-slate-900 mt-1">{cert.score}%</div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200" />

                {/* Codes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cert?.certificateNumber && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                        Certificate Number
                      </div>
                      <div className="text-sm font-mono text-slate-900 mt-1">
                        {cert.certificateNumber}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      Verification Code
                    </div>
                    <div className="text-sm font-mono text-slate-900 mt-1">
                      {cert?.verificationCode || code}
                    </div>
                  </div>
                </div>

                {/* Revoked notice */}
                {isRevoked && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div className="text-sm font-semibold text-amber-900">Revocation Notice</div>
                    <p className="text-xs text-amber-800 mt-1">
                      {cert?.revokedReason ||
                        "This certificate has been revoked by the issuing organization and is no longer valid."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-500">
              This is an official verification page. Certificate data is provided directly by the
              issuing organization via Nexora&apos;s secure verification service.
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Tamper-proof</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
