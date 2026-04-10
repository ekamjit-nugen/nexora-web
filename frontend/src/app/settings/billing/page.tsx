"use client";

import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { toast } from "sonner";

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
  const currentPlanDetails = plans.find(
    (p) => p.name.toLowerCase() === currentPlan.toLowerCase(),
  );
  const planPrice = currentPlanDetails?.price ?? "$0";
  const billingCycle = currentPlan === "free" ? "—" : "Monthly";

  const enabledFeatureCount = currentOrg?.features
    ? Object.values(currentOrg.features).filter(
        (f): f is { enabled: boolean } =>
          Boolean(f && typeof f === "object" && (f as { enabled?: boolean }).enabled),
      ).length
    : 0;

  const handleAddPaymentMethod = () => {
    toast.info("Payment integration coming in Q2 2026");
  };

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Current Plan</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your organization is on the <strong className="capitalize">{currentPlan}</strong> plan.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-[#EBF5FF] text-[#2E86C1] capitalize">
            {currentPlan}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#E2E8F0]">
          <div>
            <p className="text-xs text-[#64748B]">Plan</p>
            <p className="text-base font-semibold text-[#0F172A] capitalize mt-0.5">{currentPlan}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B]">Price</p>
            <p className="text-base font-semibold text-[#0F172A] mt-0.5">
              {planPrice}
              {planPrice !== "Custom" && planPrice !== "$0" && (
                <span className="text-xs font-normal text-[#64748B]">/user/mo</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B]">Billing Cycle</p>
            <p className="text-base font-semibold text-[#0F172A] mt-0.5">{billingCycle}</p>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Usage This Month</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Employees",
              value: "Calculating...",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              ),
            },
            {
              label: "Storage Used",
              value: "Calculating...",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              ),
            },
            {
              label: "API Calls",
              value: "Calculating...",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
              ),
            },
            {
              label: "Features Enabled",
              value: String(enabledFeatureCount),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ),
            },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {metric.icon}
                  </svg>
                </div>
                <p className="text-xs text-[#64748B]">{metric.label}</p>
              </div>
              <p className="text-lg font-semibold text-[#0F172A]">{metric.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#94A3B8] mt-4">
          Usage metrics are refreshed daily. Detailed reports will be available once billing integration is live.
        </p>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Payment Method</h3>
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">No payment method added</p>
              <p className="text-xs text-[#64748B] mt-0.5">Add a card to enable paid plan upgrades.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddPaymentMethod}
            className="px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2471A3] transition-colors"
          >
            Add Payment Method
          </button>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#0F172A]">Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-[#64748B] border-b border-[#E2E8F0]">
                <th className="pb-3 pr-4">Invoice #</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#0F172A]">No invoices yet</p>
                    <p className="text-xs text-[#64748B] mt-1">Invoices will appear here once you upgrade to a paid plan.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="w-full mt-4 px-4 py-2 rounded-lg border border-[#E2E8F0] text-sm font-medium text-[#334155] bg-white hover:bg-[#F8FAFC] hover:border-[#2E86C1]/40 transition-colors"
                  >
                    {plan.price === "Custom" ? "Contact Sales" : "Upgrade"}
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
