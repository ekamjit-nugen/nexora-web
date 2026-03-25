#!/bin/bash
echo "🔄 Seeding policy templates..."

docker exec nexora-mongodb mongosh -u root -p nexora_dev_password --quiet --eval '
db = db.getSiblingDB("nexora_policies");

const templates = [
  // ── Working Hours (3) ──
  {
    policyName: "Standard 9-to-6",
    description: "Traditional office hours with 8-hour workday, 40-hour week, and 15-minute grace period for late arrivals.",
    category: "working_hours",
    templateName: "Standard 9-to-6",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    workTiming: {
      startTime: "09:00",
      endTime: "18:00",
      timezone: "Asia/Kolkata",
      graceMinutes: 15,
      minWorkingHours: 8,
      breakMinutes: 60,
    },
    attendanceConfig: {
      maxWorkingHoursPerWeek: 40,
      alerts: { lateArrival: true, earlyDeparture: true, missedClockIn: true, overtimeAlert: true },
    },
  },
  {
    policyName: "Flexible Hours",
    description: "Flexible working arrangement with minimum 6-hour workday and 30-hour week. Generous 60-minute grace period.",
    category: "working_hours",
    templateName: "Flexible Hours",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    workTiming: {
      startTime: "07:00",
      endTime: "22:00",
      timezone: "Asia/Kolkata",
      graceMinutes: 60,
      minWorkingHours: 6,
      breakMinutes: 30,
    },
    attendanceConfig: {
      maxWorkingHoursPerWeek: 30,
      alerts: { lateArrival: false, earlyDeparture: false, missedClockIn: true, overtimeAlert: true },
    },
  },
  {
    policyName: "Night Shift",
    description: "Night shift working hours from 10 PM to 7 AM with 8-hour workday.",
    category: "working_hours",
    templateName: "Night Shift",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    workTiming: {
      startTime: "22:00",
      endTime: "07:00",
      timezone: "Asia/Kolkata",
      graceMinutes: 15,
      minWorkingHours: 8,
      breakMinutes: 60,
    },
    attendanceConfig: {
      maxWorkingHoursPerWeek: 40,
      alerts: { lateArrival: true, earlyDeparture: true, missedClockIn: true, overtimeAlert: true },
    },
  },

  // ── Leave (2) ──
  {
    policyName: "Standard Leave Policy (India)",
    description: "Comprehensive leave policy with 9 leave types including casual, sick, earned, WFH, maternity, paternity, bereavement, comp-off, and LOP.",
    category: "leave",
    templateName: "Standard Leave Policy (India)",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: true,
    leaveConfig: {
      leaveTypes: [
        { type: "casual", label: "Casual Leave", annualAllocation: 12, accrualFrequency: "monthly", maxCarryForward: 3, encashable: false, maxConsecutiveDays: 3 },
        { type: "sick", label: "Sick Leave", annualAllocation: 12, accrualFrequency: "monthly", maxCarryForward: 5, encashable: false, maxConsecutiveDays: 7, requiresDocument: true },
        { type: "earned", label: "Earned Leave", annualAllocation: 15, accrualFrequency: "monthly", maxCarryForward: 10, encashable: true, maxConsecutiveDays: 15 },
        { type: "wfh", label: "Work From Home", annualAllocation: 24, accrualFrequency: "monthly", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 5 },
        { type: "maternity", label: "Maternity Leave", annualAllocation: 182, accrualFrequency: "yearly", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 182 },
        { type: "paternity", label: "Paternity Leave", annualAllocation: 14, accrualFrequency: "yearly", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 14 },
        { type: "bereavement", label: "Bereavement Leave", annualAllocation: 5, accrualFrequency: "yearly", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 5 },
        { type: "comp_off", label: "Compensatory Off", annualAllocation: 0, accrualFrequency: "none", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 2 },
        { type: "lop", label: "Loss of Pay", annualAllocation: 0, accrualFrequency: "none", maxCarryForward: 0, encashable: false, maxConsecutiveDays: 365 },
      ],
      yearStart: "january",
      halfDayAllowed: true,
      backDatedLeaveMaxDays: 7,
    },
  },
  {
    policyName: "Minimal Leave Policy",
    description: "Basic leave policy with 3 essential leave types: casual, sick, and earned.",
    category: "leave",
    templateName: "Minimal Leave Policy",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    leaveConfig: {
      leaveTypes: [
        { type: "casual", label: "Casual Leave", annualAllocation: 10, accrualFrequency: "monthly", maxCarryForward: 2, encashable: false, maxConsecutiveDays: 3 },
        { type: "sick", label: "Sick Leave", annualAllocation: 8, accrualFrequency: "monthly", maxCarryForward: 3, encashable: false, maxConsecutiveDays: 5 },
        { type: "earned", label: "Earned Leave", annualAllocation: 12, accrualFrequency: "monthly", maxCarryForward: 5, encashable: true, maxConsecutiveDays: 10 },
      ],
      yearStart: "january",
      halfDayAllowed: true,
      backDatedLeaveMaxDays: 3,
    },
  },

  // ── WFH (2) ──
  {
    policyName: "Remote First",
    description: "Fully remote work policy with up to 20 WFH days per month. No approval needed.",
    category: "wfh",
    templateName: "Remote First",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    wfhConfig: {
      maxDaysPerMonth: 20,
      requiresApproval: false,
      allowedDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
  },
  {
    policyName: "Hybrid (3 Days Office)",
    description: "Hybrid work model requiring 3 days in office per week. WFH limited to 8 days/month with approval.",
    category: "wfh",
    templateName: "Hybrid (3 Days Office)",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    wfhConfig: {
      maxDaysPerMonth: 8,
      requiresApproval: true,
      allowedDays: ["monday", "friday"],
    },
  },

  // ── Overtime (1) ──
  {
    policyName: "Standard Overtime",
    description: "Overtime policy allowing up to 4 hours/day and 20 hours/week at 1.5x pay multiplier. Requires manager approval.",
    category: "overtime",
    templateName: "Standard Overtime",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    overtimeConfig: {
      maxOvertimeHoursPerDay: 4,
      maxOvertimeHoursPerWeek: 20,
      requiresApproval: true,
      multiplier: 1.5,
    },
  },

  // ── Shift (1) ──
  {
    policyName: "Three-Shift Rotation",
    description: "Three-shift rotation system: Morning (6 AM - 2 PM), Afternoon (2 PM - 10 PM), Night (10 PM - 6 AM).",
    category: "shift",
    templateName: "Three-Shift Rotation",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    shiftConfig: {
      shifts: [
        { name: "Morning Shift", startTime: "06:00", endTime: "14:00", isNightShift: false },
        { name: "Afternoon Shift", startTime: "14:00", endTime: "22:00", isNightShift: false },
        { name: "Night Shift", startTime: "22:00", endTime: "06:00", isNightShift: true },
      ],
    },
  },

  // ── Expenses (1) ──
  {
    policyName: "Standard Expense Policy",
    description: "Standard expense reimbursement with ₹50,000 max per transaction. Receipts required above ₹500.",
    category: "expenses",
    templateName: "Standard Expense Policy",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [
      { key: "max_single_expense", operator: "less_than", value: 50000, description: "Single expense must be under ₹50,000" },
      { key: "receipt_threshold", operator: "greater_than", value: 500, description: "Receipt required for expenses above ₹500" },
    ],
    acknowledgementRequired: true,
    expenseConfig: {
      maxAmountPerTransaction: 50000,
      requiresReceipt: true,
      approvalThreshold: 5000,
      allowedCategories: ["travel", "food", "office_supplies", "software", "hardware", "training", "miscellaneous"],
    },
  },

  // ── Travel (1) ──
  {
    policyName: "Domestic Travel Policy",
    description: "Domestic business travel with per diem allowance, hotel limits, and pre-approval for amounts above ₹25,000.",
    category: "travel",
    templateName: "Domestic Travel Policy",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [
      { key: "pre_approval_threshold", operator: "greater_than", value: 25000, description: "Pre-approval needed for travel costs above ₹25,000" },
    ],
    acknowledgementRequired: false,
    travelConfig: {
      perDiemAmount: 2000,
      maxHotelRate: 5000,
      requiresPreApproval: true,
      advanceAllowed: true,
    },
  },

  // ── Reimbursement (1) ──
  {
    policyName: "Standard Reimbursement",
    description: "Standard reimbursement policy with 30-day submission deadline and receipt requirements.",
    category: "reimbursement",
    templateName: "Standard Reimbursement",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    reimbursementConfig: {
      maxClaimAmount: 100000,
      submissionDeadlineDays: 30,
      requiresReceipts: true,
    },
  },

  // ── Attendance (1) ──
  {
    policyName: "Standard Attendance",
    description: "Standard attendance tracking with 40-hour work week and all compliance alerts enabled.",
    category: "attendance",
    templateName: "Standard Attendance",
    isTemplate: true,
    isActive: true,
    isDeleted: false,
    isLatestVersion: true,
    version: 1,
    applicableTo: "all",
    applicableIds: [],
    rules: [],
    acknowledgementRequired: false,
    attendanceConfig: {
      maxWorkingHoursPerWeek: 40,
      alerts: { lateArrival: true, earlyDeparture: true, missedClockIn: true, overtimeAlert: true },
    },
  },
];

// Insert only if not already seeded
const existing = db.policies.countDocuments({ isTemplate: true });
if (existing >= 13) {
  print("Templates already seeded (" + existing + " found). Skipping.");
} else {
  // Clear old templates and re-seed
  db.policies.deleteMany({ isTemplate: true });
  const now = new Date();
  templates.forEach(t => {
    t.createdAt = now;
    t.updatedAt = now;
  });
  db.policies.insertMany(templates);
  print("✅ Seeded " + templates.length + " policy templates");
}

print("Template count: " + db.policies.countDocuments({ isTemplate: true }));
'

echo "Done!"
