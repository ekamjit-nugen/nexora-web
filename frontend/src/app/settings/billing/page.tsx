"use client";

import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";

const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["Up to 5 users", "Basic project management", "5 GB storage", "Email support"],
  },
  {
    name: "Starter",
    price: "$9",
    features: [
      "Up to 20 users",
      "Advanced project management",
      "25 GB storage",
      "Priority email support",
      "Custom workflows",
    ],
  },
  {
    name: "Professional",
    price: "$29",
    features: [
      "Up to 100 users",
      "Full feature access",
      "100 GB storage",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
      "API access",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited users",
      "Full feature access",
      "Unlimited storage",
      "24/7 dedicated support",
      "Custom SLA",
      "On-premise option",
      "SSO / SAML",
      "Audit logs",
    ],
  },
];

export default function BillingSettingsPage() {
  const { user, currentOrg } = useAuth();

  const userRoles = user?.roles || [];
  const isAdminOrHr = userRoles.some((r) => ["admin", "super_admin", "hr"].includes(r));

  if (!user) return null;

  if (!isAdminOrHr) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const currentPlan = currentOrg?.plan || "free";

  return (
    <RouteGuard minOrgRole="admin">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Billing</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Manage your subscription and billing details.
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Current Plan</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your organization is on the <strong className="capitalize">{currentPlan}</strong> plan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-[#EBF5FF] text-[#2E86C1] capitalize">
              {currentPlan}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Plan Comparison</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentPlan;
            return (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-5 transition-colors ${
                  isCurrent
                    ? "border-[#2E86C1] bg-[#EBF5FF]/30"
                    : "border-[#E2E8F0] bg-white"
                }`}
              >
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#0F172A]">{plan.name}</h4>
                  <p className="text-2xl font-bold text-[#0F172A] mt-1">
                    {plan.price}
                    {plan.price !== "Custom" && (
                      <span className="text-sm font-normal text-[#64748B]">/user/mo</span>
                    )}
                  </p>
                </div>

                {isCurrent && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#2E86C1] text-white mb-3">
                    Current Plan
                  </span>
                )}

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-[#334155]">
                      <svg
                        className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <button
                    disabled
                    className="w-full mt-4 px-4 py-2 rounded-lg border border-[#E2E8F0] text-sm font-medium text-[#64748B] bg-[#F8FAFC] cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </RouteGuard>
  );
}
