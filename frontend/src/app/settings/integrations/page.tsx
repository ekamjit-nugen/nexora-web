"use client";

const INTEGRATIONS = [
  { name: "Slack", category: "Communication", description: "Send notifications and manage leave requests via Slack.", icon: "https://cdn.simpleicons.org/slack/4A154B", priority: "P1", status: "planned" },
  { name: "Google Workspace", category: "SSO & Calendar", description: "Google SSO login and calendar sync for leave management.", icon: "https://cdn.simpleicons.org/google/4285F4", priority: "P1", status: "planned" },
  { name: "Microsoft 365", category: "SSO & Calendar", description: "Microsoft SSO and Outlook calendar integration.", icon: "https://cdn.simpleicons.org/microsoft/00A4EF", priority: "P1", status: "planned" },
  { name: "Zoho Books", category: "Accounting", description: "Sync payroll journal entries with Zoho Books.", icon: "https://cdn.simpleicons.org/zoho/C8202B", priority: "P2", status: "planned" },
  { name: "Tally", category: "Accounting", description: "Export payroll data for Tally integration.", icon: null, priority: "P2", status: "planned" },
  { name: "QuickBooks", category: "Accounting", description: "Accounting integration for international clients.", icon: "https://cdn.simpleicons.org/quickbooks/2CA01C", priority: "P3", status: "planned" },
  { name: "Razorpay", category: "Payments", description: "Salary disbursement via Razorpay payment gateway.", icon: "https://cdn.simpleicons.org/razorpay/0C2451", priority: "P2", status: "planned" },
  { name: "GitHub", category: "Development", description: "Link commits and PRs to project tasks.", icon: "https://cdn.simpleicons.org/github/181717", priority: "P2", status: "planned" },
  { name: "GitLab", category: "Development", description: "Link commits and merge requests to tasks.", icon: "https://cdn.simpleicons.org/gitlab/FC6D26", priority: "P2", status: "planned" },
  { name: "Jira", category: "Migration", description: "Import projects and tasks from Jira.", icon: "https://cdn.simpleicons.org/jira/0052CC", priority: "P2", status: "planned" },
  { name: "WhatsApp Business", category: "Notifications", description: "Send attendance alerts and payslips via WhatsApp.", icon: "https://cdn.simpleicons.org/whatsapp/25D366", priority: "P3", status: "planned" },
  { name: "Biometric Devices", category: "Attendance", description: "ZKTeco, eSSL biometric device integration.", icon: null, priority: "P2", status: "planned" },
];

export default function IntegrationsPage() {
  const categories = Array.from(new Set(INTEGRATIONS.map(i => i.category)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Integrations</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Connect third-party tools and services to enhance your workflow.</p>
      </div>

      <div className="bg-[#2E86C1]/5 border border-[#2E86C1]/20 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-[#2E86C1] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-[#2E86C1]">Integrations are coming soon</p>
          <p className="text-xs text-[#64748B] mt-0.5">We&apos;re actively building integrations. These will be available in upcoming releases.</p>
        </div>
      </div>

      {categories.map(category => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INTEGRATIONS.filter(i => i.category === category).map(integration => (
              <div key={integration.name} className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {integration.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={integration.icon} alt={integration.name} className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="text-sm font-bold text-[#94A3B8]">{integration.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#0F172A]">{integration.name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      integration.priority === "P1" ? "bg-blue-50 text-blue-600" :
                      integration.priority === "P2" ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"
                    }`}>{integration.priority}</span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">{integration.description}</p>
                </div>
                <button disabled className="px-3 py-1.5 border border-[#E2E8F0] text-[#94A3B8] rounded-lg text-xs font-medium cursor-not-allowed">
                  Soon
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
