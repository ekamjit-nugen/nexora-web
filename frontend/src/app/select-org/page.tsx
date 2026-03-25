"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SelectOrgPage() {
  const { user, loading, organizations, switchOrg } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  const handleSelect = async (orgId: string) => {
    setSwitching(orgId);
    try {
      await switchOrg(orgId);
      router.push("/dashboard");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold">
            N
          </div>
          <span className="text-xl font-bold text-[#0F172A]">Nexora</span>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#0F172A]">Select Organization</h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Choose which organization you want to work in
          </p>
        </div>

        {/* Org grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {organizations.map((org) => (
            <Card
              key={org._id}
              className={`border-0 shadow-sm rounded-xl cursor-pointer transition-all hover:shadow-md ${
                switching === org._id ? "ring-2 ring-[#2E86C1]" : "hover:ring-1 hover:ring-[#E2E8F0]"
              }`}
              onClick={() => handleSelect(org._id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {/* Org avatar */}
                  <div className="w-11 h-11 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white text-lg font-bold shrink-0">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[#0F172A] truncate">{org.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      {org.industry && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {org.industry}
                        </span>
                      )}
                      {org.size && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                          {org.size}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[#94A3B8] capitalize">{org.plan} plan</span>
                      {org.domain && (
                        <span className="text-[10px] text-[#94A3B8]">{org.domain}</span>
                      )}
                    </div>
                  </div>
                  {switching === org._id ? (
                    <svg className="w-5 h-5 text-[#2E86C1] animate-spin shrink-0 mt-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[#CBD5E1] shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create new org */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding")}
            className="h-10 text-[13px] border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] rounded-xl px-6"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create New Organization
          </Button>
        </div>
      </div>
    </div>
  );
}
