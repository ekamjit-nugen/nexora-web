"use client";

import { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top bar with logo */}
      <div className="h-16 flex items-center justify-center border-b border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">
            N
          </div>
          <span className="text-xl font-bold text-[#0F172A] tracking-tight">Nexora</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
