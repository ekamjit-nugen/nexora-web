"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { orgApi } from "@/lib/api";
import type { Organization } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { switchOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    orgApi
      .getMyOrgs()
      .then((res) => {
        setOrganizations(res.data || []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load organizations");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (orgId: string) => {
    setSwitching(orgId);
    try {
      await switchOrg(orgId);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to switch organization");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nexora</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1 text-center">Select an Organization</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">Choose which organization to enter</p>

          {loading && (
            <div className="flex flex-col items-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Loading organizations...</p>
            </div>
          )}

          {!loading && organizations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No organizations found.</p>
              <button
                onClick={() => router.push("/auth/setup-organization")}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Create Organization
              </button>
            </div>
          )}

          {!loading && organizations.length > 0 && (
            <div className="space-y-3">
              {organizations.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSelect(org._id)}
                  disabled={switching !== null}
                  className={`w-full text-left p-4 border rounded-lg transition-all hover:border-blue-300 hover:bg-blue-50/50 ${
                    switching === org._id
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 bg-white"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {org.industry && <span>{org.industry}</span>}
                          {org.industry && org.size && <span> &middot; </span>}
                          {org.size && <span>{org.size} members</span>}
                        </p>
                      </div>
                    </div>
                    {switching === org._id ? (
                      <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
