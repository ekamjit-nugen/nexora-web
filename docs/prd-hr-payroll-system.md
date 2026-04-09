# PRD: HR System Enhancement & Payroll Module

**Module:** Payroll Service + HR Enhancements
**Version:** 1.0
**Date:** 2026-04-09
**Status:** Proposed
**New Service:** `services/payroll-service` (Port 3014)
**Dependent Services:** `auth-service` (3001), `hr-service` (3010), `attendance-service` (3011), `leave-service` (3012), `notification-service` (3006), `media-service` (3007), `ai-service` (3009)
**Owner:** Nexora Platform Team

---

## 1. Executive Summary

Nexora currently provides employee management, attendance tracking, leave management, policy governance, and client invoicing. However, it lacks a payroll engine — the single most critical module for monetization in the HR SaaS space. Without payroll processing, organizations cannot run end-to-end HR operations on Nexora, forcing them to use competing platforms (greytHR, Keka, Zoho Payroll, Darwinbox) or manual processes.

This PRD defines three phases of work:

- **Phase 1 — Payroll Engine** (8 weeks): Salary structures, payroll runs, statutory compliance (PF/ESI/TDS/PT/LWF), payslip generation, and arrears processing. This is the revenue-critical path.
- **Phase 2 — HR Gaps** (10 weeks): Reimbursements, onboarding, offboarding, and performance management — expected by any enterprise customer with 50+ employees.
- **Phase 3 — Differentiators** (8 weeks): AI-powered HR analytics, self-service enhancements (tax simulator, loans), and a recruitment module for competitive edge.

**Target customers:** Indian IT companies with 50-5,000 employees.

---

## 2. Problem Statement

### 2.1 Revenue Gap

Organizations using Nexora for HR, attendance, and leave management must export data to external payroll tools every month. This creates:

- Manual effort of 4-8 hours per payroll cycle for mid-size companies
- Data inconsistency between attendance/leave records and salary calculations
- Loss of platform stickiness — customers who process payroll elsewhere are 3x more likely to churn
- No path to premium pricing without payroll (competitors charge 40-60% more for payroll-included plans)

### 2.2 Feature Parity Gap

Enterprise customers expect:
- Structured onboarding/offboarding workflows (not just employee status changes)
- Expense reimbursement (currently handled via spreadsheets)
- Performance reviews tied to compensation cycles
- Recruitment pipeline feeding into onboarding

### 2.3 Competitive Positioning Gap

Without AI-driven analytics and self-service tools, Nexora cannot differentiate from established players who already offer these as standard features.

---

## 3. Current State Assessment

The following capabilities **already exist** and will be consumed (not rebuilt) by the new modules:

| Capability | Service | Key Collections |
|---|---|---|
| Employee CRUD, org chart, department/designation/team management | `hr-service` (3010) | `employees`, `departments`, `designations`, `teams` |
| Attendance: check-in/out, manual entries, approvals, shifts, alerts | `attendance-service` (3011) | `attendances`, `shifts`, `policies`, `alerts` |
| Leave: apply, approve, cancel, balance tracking, accrual, policies | `leave-service` (3012) | `leaves`, `leavebalances`, `leavepolicies` |
| Policies: multi-category, templates, versions, acknowledgements | `policy-service` (3013) | `policies` |
| Payroll config: PF, ESI, TDS, PT, LWF settings; salary components; pay schedule | `auth-service` (3001) | `organizations.payroll` |
| Business details: PAN, TAN, GSTIN, bank details, authorized signatory | `auth-service` (3001) | `organizations.business` |
| Branding: payslip header/footer, logo, colors | `auth-service` (3001) | `organizations.branding` |
| Client management, invoicing, billing rates, timesheet-to-invoice | `hr-service` (3010) | `clients`, `invoices`, `billingrates` |
| File upload and storage | `media-service` (3007) | — |
| Push/email/in-app notifications | `notification-service` (3006) | — |
| AI text generation and analysis | `ai-service` (3009) | — |

### 3.1 Key Existing Data Structures Referenced

**Employee schema** (`hr-service`): Contains `bankDetails` (bankName, accountNumber, IFSC, accountHolder), `employmentType` (full_time, part_time, contract, intern), `joiningDate`, `probationEndDate`, `confirmationDate`, `exitDate`, `status` (active, invited, pending, on_notice, exited, on_leave, probation), and `documents[]`.

**Organization payroll config** (`auth-service`): Contains `pfConfig` (rates, wage ceiling, VPF), `esiConfig` (rates, wage ceiling), `tdsConfig` (regime, auto-calculate, investment declaration window), `ptConfig` (state, frequency), `lwfConfig` (state, frequency), `salaryStructure.components[]` (name, code, type, calculationMethod, defaultValue, taxability, PF/ESI eligibility), and `schedule` (payCycle, payDay, processingStartDay, attendanceCutoff, arrearsProcessing).

**Attendance schema** (`attendance-service`): Contains `totalWorkingHours`, `effectiveWorkingHours`, `overtimeHours`, `status` (present, late, half_day, absent, holiday, leave, wfh, comp_off), `isLateArrival`, `lateByMinutes`.

**Leave balance schema** (`leave-service`): Contains per-employee per-year balances with `opening`, `accrued`, `used`, `adjusted`, `carriedForward`, `available` per leave type including `lop`.

---

## 4. Target Architecture

```
                                   ┌──────────────┐
                                   │  API Gateway  │
                                   │    (3000)     │
                                   └──────┬───────┘
                    ┌──────────┬──────────┼──────────┬──────────┐
                    │          │          │          │          │
              ┌─────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──▼───┐ ┌───▼──────┐
              │  Auth   │ │   HR   │ │Attend- │ │Leave │ │ Payroll  │
              │ Service │ │Service │ │ance    │ │Svc   │ │ Service  │
              │ (3001)  │ │(3010)  │ │(3011)  │ │(3012)│ │ (3014)   │
              └────┬────┘ └───┬────┘ └───┬────┘ └──┬───┘ └────┬─────┘
                   │          │          │         │           │
                   │  ┌───────┴──────────┴─────────┴───────────┘
                   │  │  HTTP calls (internal service-to-service)
                   │  │
              ┌────▼──▼────┐
              │  MongoDB   │    Databases:
              │            │    - nexora_auth (org config, payroll config)
              │            │    - nexora_hr (employees, departments)
              │            │    - nexora_attendance (attendance records)
              │            │    - nexora_leave (leave records, balances)
              │            │    - nexora_payroll (NEW — salary structures,
              │            │      payroll runs, payslips, declarations,
              │            │      reimbursements, F&F settlements,
              └────────────┘      performance reviews, recruitment)
```

### 4.1 Service Communication

The `payroll-service` communicates with other services via **internal HTTP calls** (same pattern used by `hr-service` calling `auth-service`):

| Source | Target | Purpose |
|---|---|---|
| `payroll-service` | `auth-service` | Read org payroll config (PF/ESI/TDS/PT/LWF rates, salary components, schedule, branding) |
| `payroll-service` | `hr-service` | Read employee details (bank, department, designation, employment type, joining date) |
| `payroll-service` | `attendance-service` | Read monthly attendance summary (present days, absent days, overtime hours, LOP days) |
| `payroll-service` | `leave-service` | Read leave records for pay period (LOP count, leave encashment eligibility) |
| `payroll-service` | `media-service` | Upload payslip PDFs, reimbursement receipts, offer letters, experience letters |
| `payroll-service` | `notification-service` | Trigger payslip available, approval requests, deadline reminders |
| `payroll-service` | `ai-service` | Receipt OCR, attrition prediction, resume parsing |

### 4.2 New Service Configuration

| Property | Value |
|---|---|
| Port | 3014 (env: `PAYROLL_SERVICE_PORT`) |
| API Prefix | `/api/v1` |
| Database | MongoDB (`nexora_payroll`) |
| Security | Helmet, CORS, JWT auth guard (same pattern as `hr-service`) |
| Body Limit | 10MB (JSON/URL-encoded — accommodates document uploads via base64) |
| Health Check | `GET /api/v1/health` |

---

## 5. Phase 1: Payroll Engine

**Timeline:** 8 weeks
**Priority:** CRITICAL — no revenue without this

### 5.1 Salary Structure Management

#### 5.1.1 Data Model — `SalaryStructure`

```typescript
interface ISalaryStructure extends Document {
  organizationId: string;
  employeeId: string;              // ref: hr-service employees
  structureName: string;           // e.g., "Senior Engineer - Band 4"
  effectiveFrom: Date;
  effectiveTo?: Date;              // null = current
  ctc: number;                     // annual CTC in paise (integer math, no float)
  grossSalary: number;             // annual gross
  netSalary: number;               // annual net (computed)

  components: Array<{
    code: string;                  // e.g., 'BASIC', 'HRA', 'DA'
    name: string;
    type: 'earning' | 'deduction' | 'employer_contribution' | 'reimbursement';
    calculationMethod: 'fixed' | 'percentage_basic' | 'percentage_ctc' | 'percentage_gross';
    annualAmount: number;          // in paise
    monthlyAmount: number;         // in paise (annualAmount / 12)
    percentage?: number;           // if calculation is percentage-based
    isTaxable: boolean;
    taxExemptionLimit?: number;    // annual limit in paise
    isPFApplicable: boolean;
    isESIApplicable: boolean;
    showInPayslip: boolean;
    order: number;
  }>;

  statutoryDeductions: {
    pfEmployee: number;            // monthly in paise
    pfEmployer: number;
    pfAdminCharges: number;
    edli: number;
    esiEmployee: number;
    esiEmployer: number;
    professionalTax: number;       // monthly PT
    lwf: number;
  };

  metadata: {
    revision: number;              // auto-increment per employee
    previousStructureId?: string;
    revisionReason?: string;
    approvedBy?: string;
    approvedAt?: Date;
  };

  status: 'draft' | 'pending_approval' | 'active' | 'superseded';
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, employeeId: 1, status: 1 }`
- `{ organizationId: 1, effectiveFrom: -1 }`
- `{ employeeId: 1, effectiveFrom: -1 }`

#### 5.1.2 Business Rules — CTC Breakdown

1. **CTC = Gross Salary + Employer PF + Employer ESI + Any employer-only contributions**
2. **Gross Salary = Sum of all earnings (Basic + HRA + DA + Conveyance + Medical + Special Allowance + ...)**
3. **Net Salary = Gross Salary - Employee PF - Employee ESI - Professional Tax - TDS - Other deductions**
4. **Basic salary must be >= 50% of gross** (recommended for PF compliance, configurable)
5. **HRA defaults**: 50% of basic (metro) or 40% of basic (non-metro), configurable per employee
6. All monetary values stored as **integers in paise** (1 INR = 100 paise) to avoid floating-point errors
7. When org creates a new employee, the system auto-generates a salary structure from org-level component templates (from `auth-service` org `payroll.salaryStructure.components[]`)
8. Salary revision creates a new `SalaryStructure` document with incremented `metadata.revision` and sets the previous one to `status: 'superseded'`

#### 5.1.3 API Endpoints — Salary Structure

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/salary-structures` | Create salary structure for employee | Admin, HR |
| `GET` | `/salary-structures/:employeeId` | Get current active structure | Admin, HR, Self |
| `GET` | `/salary-structures/:employeeId/history` | Get all revisions | Admin, HR, Self |
| `PUT` | `/salary-structures/:id` | Update draft structure | Admin, HR |
| `POST` | `/salary-structures/:id/submit` | Submit for approval | HR |
| `POST` | `/salary-structures/:id/approve` | Approve structure | Admin |
| `POST` | `/salary-structures/:id/reject` | Reject with reason | Admin |
| `POST` | `/salary-structures/bulk-create` | Create structures from template for multiple employees | Admin |
| `POST` | `/salary-structures/simulate` | CTC breakdown simulation (what-if) | Admin, HR, Self |

#### 5.1.4 User Stories

- **US-SAL-01**: As an HR admin, I can create a salary structure for a new employee by entering the CTC, and the system auto-breaks it down into components based on org templates.
- **US-SAL-02**: As an HR admin, I can override individual component amounts/percentages after auto-generation.
- **US-SAL-03**: As an HR admin, I can propose a salary revision with an effective date, and it routes for admin approval.
- **US-SAL-04**: As an employee, I can view my current salary structure and all past revisions.
- **US-SAL-05**: As an HR admin, I can simulate a CTC breakdown without saving, to explore different structures.
- **US-SAL-06**: As an admin, I can bulk-create salary structures for multiple employees from a standard template.

---

### 5.2 Payroll Run Management

#### 5.2.1 Data Model — `PayrollRun`

```typescript
interface IPayrollRun extends Document {
  organizationId: string;
  payPeriod: {
    month: number;                 // 1-12
    year: number;
    startDate: Date;
    endDate: Date;
  };
  runNumber: string;               // auto: "PR-2026-04-001"

  status: 'draft' | 'processing' | 'review' | 'approved' | 'finalized' | 'paid' | 'cancelled';

  summary: {
    totalEmployees: number;
    processedEmployees: number;
    skippedEmployees: number;      // exited, on_notice without pay, etc.
    totalGross: number;            // in paise
    totalDeductions: number;
    totalNet: number;
    totalEmployerContributions: number;
    totalTDS: number;
    totalPFEmployee: number;
    totalPFEmployer: number;
    totalESIEmployee: number;
    totalESIEmployer: number;
    totalPT: number;
    totalLWF: number;
    totalReimbursements: number;
    totalArrears: number;
    totalOvertime: number;
    totalLOPDeductions: number;
    totalBonuses: number;
  };

  employeePayrolls: string[];      // refs to PayrollEntry._id

  auditTrail: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    notes?: string;
    previousStatus?: string;
    newStatus?: string;
  }>;

  approvedBy?: string;
  approvedAt?: Date;
  finalizedBy?: string;
  finalizedAt?: Date;
  paidAt?: Date;
  paymentReference?: string;

  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 }` (unique)
- `{ organizationId: 1, status: 1 }`
- `{ runNumber: 1 }` (unique)

#### 5.2.2 Data Model — `PayrollEntry`

One document per employee per payroll run:

```typescript
interface IPayrollEntry extends Document {
  organizationId: string;
  payrollRunId: string;            // ref: PayrollRun
  employeeId: string;              // ref: hr-service employees
  salaryStructureId: string;       // ref: SalaryStructure (snapshot of active at run time)

  payPeriod: {
    month: number;
    year: number;
  };

  attendance: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    lopDays: number;
    paidLeaveDays: number;
    holidays: number;
    weekoffs: number;
    overtimeHours: number;
  };

  earnings: Array<{
    code: string;
    name: string;
    fullAmount: number;            // monthly amount from structure (paise)
    actualAmount: number;          // prorated if LOP/mid-month join (paise)
    arrearAmount: number;          // arrears for this component (paise)
    isTaxable: boolean;
  }>;

  deductions: Array<{
    code: string;
    name: string;
    amount: number;                // paise
    category: 'statutory' | 'voluntary' | 'recovery';
  }>;

  statutory: {
    pfEmployee: number;
    pfEmployer: number;
    pfAdminCharges: number;
    edli: number;
    esiEmployee: number;
    esiEmployer: number;
    professionalTax: number;
    lwf: number;
    tds: number;
  };

  reimbursements: Array<{
    expenseClaimId?: string;
    category: string;
    amount: number;
  }>;

  bonuses: Array<{
    type: string;                  // performance, festival, retention, joining
    description: string;
    amount: number;
    isTaxable: boolean;
  }>;

  loanDeductions: Array<{
    loanId: string;
    emiAmount: number;
    remainingBalance: number;
  }>;

  totals: {
    grossEarnings: number;
    totalDeductions: number;
    totalStatutory: number;
    totalReimbursements: number;
    totalBonuses: number;
    totalArrears: number;
    overtimePay: number;
    lopDeduction: number;
    netPayable: number;
  };

  paymentDetails: {
    mode: 'bank_transfer' | 'cheque' | 'cash';
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    transactionRef?: string;
    paidAt?: Date;
  };

  payslipUrl?: string;             // PDF URL from media-service
  status: 'draft' | 'computed' | 'reviewed' | 'approved' | 'paid' | 'on_hold';
  holdReason?: string;
  notes?: string;

  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, payrollRunId: 1, employeeId: 1 }` (unique)
- `{ employeeId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 }`
- `{ payrollRunId: 1, status: 1 }`

#### 5.2.3 Payroll Run Workflow

```
  ┌─────────┐     ┌────────────┐     ┌────────┐     ┌──────────┐     ┌───────────┐     ┌──────┐
  │  DRAFT  │────▶│ PROCESSING │────▶│ REVIEW │────▶│ APPROVED │────▶│ FINALIZED │────▶│ PAID │
  └─────────┘     └────────────┘     └────────┘     └──────────┘     └───────────┘     └──────┘
       │                                  │               │
       │                                  │               │
       ▼                                  ▼               ▼
  ┌───────────┐                     ┌───────────┐   ┌───────────┐
  │ CANCELLED │                     │   DRAFT   │   │   DRAFT   │
  └───────────┘                     │ (re-open) │   │ (re-open) │
                                    └───────────┘   └───────────┘
```

**Step-by-step:**

1. **DRAFT**: Admin initiates payroll for a month. System validates no existing run for that period.
2. **PROCESSING**: System fetches data from dependent services (attendance, leave, salary structures) and computes each employee's payroll entry. This is an async job — may take 30-120 seconds for 5,000 employees.
3. **REVIEW**: All entries computed. Admin/HR reviews individual entries, can override amounts with justification, put entries on hold, or add ad-hoc bonuses/deductions.
4. **APPROVED**: Admin approves the payroll run. No further changes except re-opening to DRAFT.
5. **FINALIZED**: Payslip PDFs generated for all employees. Statutory reports prepared. This is the point of no return for modifications.
6. **PAID**: Payment processed (manual bank upload or integration). Transaction references recorded.

#### 5.2.4 Payroll Calculation Engine — Business Rules

**Gross Salary Computation:**
```
For each earning component in employee's active SalaryStructure:
  monthlyFull = component.monthlyAmount

  if employee joined mid-month:
    proratedDays = workingDaysFromJoining / totalWorkingDays
    monthlyProrated = monthlyFull * proratedDays
  else if employee has LOP days:
    effectiveDays = totalWorkingDays - lopDays
    monthlyProrated = monthlyFull * (effectiveDays / totalWorkingDays)
  else:
    monthlyProrated = monthlyFull

  grossEarning += monthlyProrated
```

**LOP Deduction:**
```
LOPDays = absentDaysWithNoLeaveBalance (from attendance-service cross-referenced with leave-service)
LOPDeduction = (grossMonthlySalary / totalWorkingDays) * LOPDays
```

**Overtime Calculation:**
```
if org.workPreferences.overtime.applicable:
  overtimeRate = org.workPreferences.overtime.rate (multiplier, e.g., 1.5 or 2)
  hourlyRate = (basicMonthly + DAMonthly) / (workingDays * workingHoursPerDay)
  overtimePay = overtimeHours * hourlyRate * overtimeRate
```

**Arrears Calculation:**
```
if employee has salary revision with effectiveFrom in a past month:
  for each past month between effectiveFrom and current month:
    arrear += (newComponentAmount - oldComponentAmount)
  add arrear to current month's payroll entry
```

#### 5.2.5 API Endpoints — Payroll Run

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/payroll-runs` | Initiate payroll run for a month/year | Admin |
| `GET` | `/payroll-runs` | List all payroll runs (paginated, filterable by status/year) | Admin, HR |
| `GET` | `/payroll-runs/:id` | Get payroll run with summary | Admin, HR |
| `POST` | `/payroll-runs/:id/process` | Trigger payroll computation (async) | Admin |
| `POST` | `/payroll-runs/:id/reprocess` | Re-compute after corrections (re-opens to draft first) | Admin |
| `PUT` | `/payroll-runs/:id/status` | Transition status (review, approve, finalize, mark paid, cancel) | Admin |
| `GET` | `/payroll-runs/:id/entries` | List all employee entries for a run (paginated) | Admin, HR |
| `GET` | `/payroll-runs/:id/entries/:employeeId` | Get single employee payroll entry | Admin, HR, Self |
| `PUT` | `/payroll-runs/:id/entries/:employeeId` | Override entry amounts (only in review status) | Admin |
| `POST` | `/payroll-runs/:id/entries/:employeeId/hold` | Put an entry on hold | Admin |
| `POST` | `/payroll-runs/:id/entries/:employeeId/release` | Release held entry | Admin |
| `POST` | `/payroll-runs/:id/entries/:employeeId/add-adhoc` | Add ad-hoc bonus/deduction | Admin |
| `GET` | `/payroll-runs/:id/summary` | Download run summary (CSV/PDF) | Admin |
| `POST` | `/payroll-runs/:id/generate-payslips` | Bulk generate payslip PDFs | Admin |
| `GET` | `/payroll-runs/:id/bank-file` | Download bank transfer file (NEFT/RTGS format) | Admin |

#### 5.2.6 User Stories

- **US-PR-01**: As an admin, I can initiate a payroll run for April 2026, and the system automatically fetches attendance, leave, and salary data to compute payroll for all active employees.
- **US-PR-02**: As an HR manager, I can review each employee's payroll breakdown before approval, seeing earnings, deductions, statutory contributions, and net pay.
- **US-PR-03**: As an admin, I can put a specific employee's payroll on hold (e.g., pending exit clearance) without blocking the rest of the run.
- **US-PR-04**: As an admin, I can add an ad-hoc bonus (festival bonus, performance bonus) to an employee during review.
- **US-PR-05**: As an admin, after finalizing the run, I can download a bank transfer file in NEFT format for bulk salary disbursement.
- **US-PR-06**: As an employee, I receive a notification when my payslip is available and can download it from the self-service portal.
- **US-PR-07**: As an admin, I can re-open an approved (not finalized) payroll run to make corrections.
- **US-PR-08**: As an admin, I can view the full audit trail showing who initiated, processed, approved, and finalized each payroll run.

---

### 5.3 Payslip Generation

#### 5.3.1 Data Model — `Payslip`

```typescript
interface IPayslip extends Document {
  organizationId: string;
  employeeId: string;
  payrollRunId: string;
  payrollEntryId: string;

  payPeriod: {
    month: number;
    year: number;
    label: string;                 // "April 2026"
  };

  employeeSnapshot: {
    employeeId: string;
    name: string;
    designation: string;
    department: string;
    bankAccount: string;           // masked: "XXXX1234"
    pan: string;                   // masked: "XXXXX1234A"
    uan?: string;
    esiNumber?: string;
  };

  organizationSnapshot: {
    name: string;
    logo?: string;
    address: string;
    pan?: string;
    tan?: string;
  };

  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  employerContributions: Array<{ code: string; name: string; amount: number }>;

  totals: {
    grossEarnings: number;
    totalDeductions: number;
    netPayable: number;
    netPayableWords: string;       // "Rupees Forty Five Thousand Only"
  };

  ytdTotals: {
    grossEarnings: number;
    pfEmployee: number;
    pfEmployer: number;
    esiEmployee: number;
    professionalTax: number;
    tds: number;
    netPayable: number;
  };

  pdfUrl?: string;
  generatedAt?: Date;
  downloadedAt?: Date;
  emailedAt?: Date;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, employeeId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 }` (unique)
- `{ payrollRunId: 1 }`

#### 5.3.2 PDF Generation Rules

1. Use org `branding.payslipHeader` and `branding.payslipFooter` from auth-service
2. Include org logo (`branding.logo`), org name, registered address
3. Layout: Company header, employee details row, earnings table (left), deductions table (right), employer contributions, YTD summary, net pay in words, footer
4. Sensitive fields masked in PDF: bank account shows last 4 digits, PAN shows last 5 chars
5. PDF generated via server-side template engine (Handlebars + Puppeteer or `pdfmake`)
6. Uploaded to `media-service`, URL stored in `Payslip.pdfUrl`
7. Employee notified via `notification-service` when payslip is ready

#### 5.3.3 API Endpoints — Payslips

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/payslips` | List employee's payslips (self) or all (admin) | Admin, HR, Self |
| `GET` | `/payslips/:id` | Get payslip details | Admin, HR, Self |
| `GET` | `/payslips/:id/download` | Download payslip PDF | Admin, HR, Self |
| `POST` | `/payslips/email/:id` | Email payslip to employee | Admin, HR |
| `POST` | `/payslips/bulk-email` | Email all payslips for a payroll run | Admin |

---

### 5.4 Statutory Compliance Engine

#### 5.4.1 PF (Provident Fund) Calculation

**Source config**: `org.payroll.pfConfig` from auth-service.

**Rules (EPF & MP Act, 1952):**

| Component | Rate | Base | Ceiling |
|---|---|---|---|
| Employee PF | `pfConfig.employeeRate` (default 12%) | Basic + DA | `pfConfig.wageCeiling` (default 15,000/month) |
| Employer PF (to EPF) | 3.67% of wage | Basic + DA | Wage ceiling |
| Employer PF (to EPS) | 8.33% of wage | Basic + DA | Wage ceiling (max 15,000) |
| Admin charges | `pfConfig.adminChargesRate` (default 0.50%) | Basic + DA | Wage ceiling |
| EDLI | `pfConfig.edliRate` (default 0.50%) | Basic + DA | Wage ceiling |

```
pfWage = min(basic + DA, wageCeiling)
employeePF = pfWage * employeeRate
employerEPF = pfWage * 3.67%
employerEPS = min(pfWage, 15000) * 8.33%
adminCharges = pfWage * adminChargesRate
edli = pfWage * edliRate
totalEmployerPF = employerEPF + employerEPS + adminCharges + edli
```

**VPF (Voluntary Provident Fund):**
- If `pfConfig.vpfAllowed === true`, employee can opt for additional PF contribution above 12%
- VPF amount stored in `SalaryStructure` as a voluntary deduction
- No employer match on VPF

#### 5.4.2 ESI (Employees' State Insurance) Calculation

**Source config**: `org.payroll.esiConfig` from auth-service.

**Rules (ESI Act, 1948):**

```
if employee's grossMonthlySalary <= esiConfig.wageCeiling (default 21,000):
  esiEmployee = grossSalary * esiConfig.employeeRate (default 0.75%)
  esiEmployer = grossSalary * esiConfig.employerRate (default 3.25%)
else:
  esiEmployee = 0
  esiEmployer = 0
```

**Edge cases:**
- If salary crosses ceiling mid-year, ESI continues for the full contribution period (April-September or October-March)
- New joinee with salary below ceiling: ESI applicable from joining month

#### 5.4.3 TDS (Tax Deducted at Source) Calculation

**Source config**: `org.payroll.tdsConfig` from auth-service.

**Data Model — `InvestmentDeclaration`:**

```typescript
interface IInvestmentDeclaration extends Document {
  organizationId: string;
  employeeId: string;
  financialYear: string;           // "2026-27"
  regime: 'old' | 'new';

  declarations: Array<{
    section: string;               // '80C', '80D', '80E', '80G', '80EEA', '80TTA', '24b', 'HRA'
    category: string;              // 'PPF', 'ELSS', 'Life Insurance', 'Mediclaim', etc.
    description?: string;
    declaredAmount: number;        // in paise
    proofSubmitted: boolean;
    proofDocumentIds: string[];    // refs to media-service
    proofVerified: boolean;
    verifiedAmount: number;        // in paise (may differ from declared)
    verifiedBy?: string;
    verifiedAt?: Date;
  }>;

  hraExemption?: {
    rentPaid: number;              // annual rent in paise
    isMetroCity: boolean;
    landlordName?: string;
    landlordPAN?: string;          // required if annual rent > 1,00,000
    exemptionAmount: number;       // computed
  };

  otherIncome?: {
    interestIncome: number;
    rentalIncome: number;
    otherSources: number;
  };

  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'locked';
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  lockedForProofVerification: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

**TDS Calculation Logic (Monthly):**

```
// Step 1: Compute annual taxable income
annualGross = grossMonthlySalary * 12 (or project based on months remaining)
standardDeduction = 50,000 (Section 16)

if regime == 'old':
  section80C = min(declaredAmount_80C, 150000)
  section80D = min(declaredAmount_80D, limitBasedOnAge)
  hraExemption = min(
    actualHRA,
    rentPaid - 10% of basic,
    50% of basic (metro) or 40% (non-metro)
  )
  // ... all other sections
  totalExemptions = section80C + section80D + hraExemption + ...
  taxableIncome = annualGross - standardDeduction - totalExemptions

else: // new regime
  taxableIncome = annualGross - standardDeduction
  // limited deductions allowed under new regime (NPS 80CCD(2))

// Step 2: Apply tax slabs
if regime == 'new' (FY 2025-26 onwards):
  0 - 4,00,000: Nil
  4,00,001 - 8,00,000: 5%
  8,00,001 - 12,00,000: 10%
  12,00,001 - 16,00,000: 15%
  16,00,001 - 20,00,000: 20%
  20,00,001 - 24,00,000: 25%
  Above 24,00,000: 30%
  Rebate u/s 87A: if taxableIncome <= 12,00,000 => zero tax

if regime == 'old':
  0 - 2,50,000: Nil
  2,50,001 - 5,00,000: 5%
  5,00,001 - 10,00,000: 20%
  Above 10,00,000: 30%
  Rebate u/s 87A: if taxableIncome <= 5,00,000 => zero tax

annualTax = slabCalculation(taxableIncome)
surcharge (if applicable)
healthAndEducationCess = annualTax * 4%
totalAnnualTax = annualTax + surcharge + cess

// Step 3: Monthly TDS
monthlyTDS = totalAnnualTax / 12

// Step 4: Adjust for already deducted months
monthsElapsed = currentMonth - financialYearStartMonth
tdsAlreadyDeducted = sum of TDS from previous payroll entries this FY
remainingMonths = 12 - monthsElapsed
adjustedMonthlyTDS = (totalAnnualTax - tdsAlreadyDeducted) / remainingMonths
```

**Investment Proof Window:**
- Declared investments used for TDS calculation from April-January
- Proof submission window: `tdsConfig.investmentProofWindow.start` to `tdsConfig.investmentProofWindow.end` (typically Jan 1 - Feb 15)
- Post proof verification, TDS recalculated for remaining months (Feb-March) with adjusted deductions
- Any shortfall recovered in March salary

#### 5.4.4 Professional Tax

**Source config**: `org.payroll.ptConfig` from auth-service.

**State-wise slab table** (stored in payroll-service as reference data):

```typescript
interface IPTSlabTable {
  state: string;
  slabs: Array<{
    minSalary: number;
    maxSalary: number;
    monthlyTax: number;
    februaryTax?: number;          // some states have different Feb amount
  }>;
  effectiveFrom: Date;
}
```

Example — Karnataka:
| Monthly Gross | PT Amount |
|---|---|
| Up to 15,000 | 0 |
| 15,001 - 25,000 | 200 |
| Above 25,000 | 200 (Feb: 300) |

Example — Maharashtra:
| Monthly Gross | PT Amount |
|---|---|
| Up to 7,500 | 0 (male), 0 (female) |
| 7,501 - 10,000 | 175 |
| Above 10,000 | 200 (Feb: 300) |

The system uses `employee.address.state` (or org `ptConfig.state` as fallback) to determine applicable slabs.

#### 5.4.5 LWF (Labour Welfare Fund)

**Source config**: `org.payroll.lwfConfig` from auth-service.

State-wise rules with varying frequencies (monthly, half-yearly, annual):

| State | Employee | Employer | Frequency |
|---|---|---|---|
| Karnataka | 20 | 40 | Annual (Jan) |
| Maharashtra | 12 | 36 | Half-yearly (Jun, Dec) |
| Delhi | 1 | 1 | Half-yearly |
| Tamil Nadu | 10 | 20 | Half-yearly |

#### 5.4.6 Statutory Reports & Forms

**Data Model — `StatutoryReport`:**

```typescript
interface IStatutoryReport extends Document {
  organizationId: string;
  reportType: 'pf_monthly' | 'esi_monthly' | 'form_16' | 'form_12ba' | 'pt_return' | 'lwf_return';
  period: {
    month?: number;
    year: number;
    financialYear?: string;
  };
  employeeId?: string;             // for Form 16/12BA (per employee)
  status: 'draft' | 'generated' | 'filed';
  fileUrl?: string;
  data: Record<string, any>;       // report-specific computed data
  generatedAt?: Date;
  generatedBy?: string;
  filedAt?: Date;
  filedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

| Report | Description | Frequency | API Endpoint |
|---|---|---|---|
| PF Monthly ECR | Electronic Challan-cum-Return (UAN-wise PF details) | Monthly | `POST /statutory/pf-ecr/:month/:year` |
| ESI Monthly Return | Employee-wise ESI contribution details | Monthly | `POST /statutory/esi-return/:month/:year` |
| Form 16 | Annual TDS certificate per employee | Annual | `POST /statutory/form-16/:financialYear/:employeeId` |
| Form 12BA | Statement of perquisites/profits in lieu of salary | Annual | `POST /statutory/form-12ba/:financialYear/:employeeId` |
| PT Return | Professional Tax challan details | As per state frequency | `POST /statutory/pt-return/:period` |
| LWF Return | Labour Welfare Fund details | As per state frequency | `POST /statutory/lwf-return/:period` |
| Bulk Form 16 | Generate Form 16 for all employees | Annual | `POST /statutory/form-16/bulk/:financialYear` |

---

### 5.5 Employee Salary Module (Self-Service)

#### 5.5.1 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/my/salary-structure` | View current salary structure | Self |
| `GET` | `/my/salary-structure/history` | View all salary revisions | Self |
| `GET` | `/my/payslips` | List all payslips | Self |
| `GET` | `/my/payslips/:id/download` | Download payslip PDF | Self |
| `GET` | `/my/investment-declaration` | Get current FY declaration | Self |
| `POST` | `/my/investment-declaration` | Submit investment declaration | Self |
| `PUT` | `/my/investment-declaration/:id` | Update declaration (if not locked) | Self |
| `POST` | `/my/investment-declaration/:id/submit-proofs` | Upload proof documents | Self |
| `GET` | `/my/tax-summary` | View YTD tax computation | Self |
| `GET` | `/my/form-16/:financialYear` | Download Form 16 | Self |

#### 5.5.2 User Stories

- **US-ESM-01**: As an employee, I can view my current CTC breakdown showing all earnings, deductions, and employer contributions.
- **US-ESM-02**: As an employee, I can submit my investment declarations (80C, 80D, HRA, etc.) at the start of the financial year.
- **US-ESM-03**: As an employee, I can upload proof documents during the proof submission window and track verification status.
- **US-ESM-04**: As an employee, I can view my YTD tax computation showing projected annual tax, deductions claimed, and monthly TDS.
- **US-ESM-05**: As an employee, I can download my Form 16 after the financial year ends.
- **US-ESM-06**: As an employee, I can view all my historical payslips and download them as PDFs.

---

### 5.6 Bonus & Incentive Processing

#### 5.6.1 Data Model — `BonusRecord`

```typescript
interface IBonusRecord extends Document {
  organizationId: string;
  employeeId: string;
  type: 'performance' | 'festival' | 'retention' | 'joining' | 'referral' | 'spot' | 'annual' | 'custom';
  description: string;
  amount: number;                  // paise
  isTaxable: boolean;
  taxTreatment: 'salary_income' | 'one_time_10_percent' | 'exempt';
  payoutMonth: number;
  payoutYear: number;
  payrollRunId?: string;           // linked when processed through payroll
  status: 'pending' | 'approved' | 'processed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5.6.2 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/bonuses` | Create bonus entry | Admin, HR |
| `GET` | `/bonuses` | List bonuses (filterable by employee, type, period) | Admin, HR |
| `POST` | `/bonuses/bulk` | Bulk create (e.g., festival bonus for all employees) | Admin |
| `PUT` | `/bonuses/:id` | Update pending bonus | Admin, HR |
| `POST` | `/bonuses/:id/approve` | Approve bonus | Admin |
| `POST` | `/bonuses/:id/cancel` | Cancel bonus | Admin |

---

## 6. Phase 2: HR Gaps

**Timeline:** 10 weeks (can begin in parallel with Phase 1 final 2 weeks)
**Priority:** HIGH — expected by enterprise customers

### 6.1 Reimbursement & Expense Management

#### 6.1.1 Data Model — `ExpenseClaim`

```typescript
interface IExpenseClaim extends Document {
  organizationId: string;
  employeeId: string;
  claimNumber: string;             // auto: "EXP-2026-04-001"
  title: string;
  category: 'travel' | 'food' | 'medical' | 'internet' | 'phone' | 'office_supplies' | 'training' | 'other';
  description?: string;

  items: Array<{
    date: Date;
    description: string;
    amount: number;                // paise
    receiptUrl?: string;           // from media-service
    ocrExtracted?: {
      vendor?: string;
      amount?: number;
      date?: Date;
      gstNumber?: string;
    };
  }>;

  totalAmount: number;             // sum of items
  approvedAmount?: number;         // may differ from claimed

  categoryLimit: number;           // org-configured max per category per month
  isOverLimit: boolean;

  approvalChain: Array<{
    level: number;
    approverId: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
    actedAt?: Date;
  }>;

  payoutMode: 'salary' | 'separate_transfer';
  payrollRunId?: string;           // if reimbursed via salary
  paidAt?: Date;

  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'partially_approved' | 'rejected' | 'reimbursed';

  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, employeeId: 1, status: 1 }`
- `{ organizationId: 1, claimNumber: 1 }` (unique)
- `{ organizationId: 1, status: 1, createdAt: -1 }`

#### 6.1.2 Business Rules

1. Each category has a configurable monthly limit per employee (stored in org settings, fetched from auth-service)
2. Claims exceeding category limits are flagged but not auto-rejected — requires manager approval with justification
3. Multi-level approval: L1 = reporting manager, L2 = department head (if amount > threshold), L3 = finance (if amount > higher threshold)
4. Thresholds configurable: e.g., L1 up to 5,000 INR, L2 up to 25,000 INR, L3 above 25,000 INR
5. Receipt OCR: when employee uploads receipt image, `ai-service` extracts vendor, amount, date, GST number
6. Payout modes: (a) include in next payroll run as reimbursement line item, or (b) separate bank transfer
7. Duplicate detection: warn if similar amount + date + category exists within 7 days

#### 6.1.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/expense-claims` | Create expense claim | Any employee |
| `GET` | `/expense-claims` | List claims (self or org-wide for admin) | All |
| `GET` | `/expense-claims/:id` | Get claim details | Self, Approver, Admin |
| `PUT` | `/expense-claims/:id` | Update draft claim | Self |
| `POST` | `/expense-claims/:id/submit` | Submit for approval | Self |
| `POST` | `/expense-claims/:id/approve` | Approve at current level | Approver |
| `POST` | `/expense-claims/:id/reject` | Reject with reason | Approver |
| `POST` | `/expense-claims/:id/items/:itemIndex/ocr` | Trigger OCR on receipt | Self |
| `GET` | `/expense-claims/pending-approval` | List claims pending my approval | Manager |
| `GET` | `/expense-claims/analytics` | Category-wise spend analytics | Admin |

#### 6.1.4 User Stories

- **US-EXP-01**: As an employee, I can submit an expense claim by uploading receipt photos, and the system auto-extracts amount and vendor via OCR.
- **US-EXP-02**: As a manager, I can approve or reject expense claims from my team, with the ability to partially approve (reduce amount).
- **US-EXP-03**: As an admin, I can configure per-category monthly limits and multi-level approval thresholds.
- **US-EXP-04**: As an employee, I can choose whether to receive reimbursement via my next salary or as a separate transfer.
- **US-EXP-05**: As an admin, I can view category-wise expense analytics to track organizational spending.

---

### 6.2 Employee Onboarding

#### 6.2.1 Data Model — `OnboardingChecklist`

```typescript
interface IOnboardingChecklist extends Document {
  organizationId: string;
  employeeId: string;

  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;

  personalDetails: {
    completed: boolean;
    dateOfBirth: boolean;
    gender: boolean;
    bloodGroup: boolean;
    maritalStatus: boolean;
    fatherName: boolean;
    motherName: boolean;
    nationality: boolean;
  };

  documents: Array<{
    type: 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license' |
          'bank_proof' | 'address_proof' | 'education_10th' | 'education_12th' |
          'education_degree' | 'education_pg' | 'experience_letter' |
          'relieving_letter' | 'offer_letter_previous' | 'payslips_previous' |
          'photos';
    label: string;
    required: boolean;
    uploaded: boolean;
    documentUrl?: string;
    uploadedAt?: Date;
    verified: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    rejectionReason?: string;
  }>;

  bankDetails: {
    completed: boolean;
    verified: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
  };

  emergencyContacts: {
    completed: boolean;
    contacts: Array<{
      name: string;
      relation: string;
      phone: string;
    }>;
  };

  taxSetup: {
    panProvided: boolean;
    pfNominee: boolean;
    taxRegimeSelected: boolean;
    investmentDeclarationDone: boolean;
  };

  itAssets: Array<{
    type: 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'headset' | 'id_card' | 'access_card' | 'other';
    description?: string;
    serialNumber?: string;
    issuedAt?: Date;
    acknowledged: boolean;
  }>;

  buddy: {
    assigned: boolean;
    buddyEmployeeId?: string;
    assignedAt?: Date;
  };

  probation: {
    startDate?: Date;
    endDate?: Date;
    reviewDate?: Date;
    confirmed: boolean;
    confirmedAt?: Date;
    confirmedBy?: string;
    extendedTo?: Date;
    extensionReason?: string;
  };

  completionPercentage: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, employeeId: 1 }` (unique)
- `{ organizationId: 1, status: 1 }`
- `{ organizationId: 1, 'probation.endDate': 1 }`

#### 6.2.2 Business Rules

1. Onboarding checklist auto-created when employee status changes to `active` or `probation`
2. Document requirements configurable per org (which documents are mandatory vs optional)
3. Completion percentage auto-computed: `(completedSteps / totalRequiredSteps) * 100`
4. Probation tracking: system sends reminder notifications at 30, 15, and 7 days before probation end date
5. Probation confirmation triggers: (a) manager review submission, (b) HR approval, (c) auto-update employee status from `probation` to `active`
6. Buddy assignment: notification sent to both buddy and new employee with introductory context
7. IT asset acknowledgement tracked — feeds into offboarding asset return list

#### 6.2.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/onboarding/:employeeId/init` | Initialize onboarding checklist | Admin, HR |
| `GET` | `/onboarding/:employeeId` | Get onboarding status | Admin, HR, Self |
| `PUT` | `/onboarding/:employeeId/personal-details` | Update personal details section | Self |
| `POST` | `/onboarding/:employeeId/documents` | Upload onboarding document | Self |
| `POST` | `/onboarding/:employeeId/documents/:type/verify` | Verify uploaded document | HR |
| `POST` | `/onboarding/:employeeId/documents/:type/reject` | Reject with reason | HR |
| `PUT` | `/onboarding/:employeeId/bank-details` | Submit bank details | Self |
| `PUT` | `/onboarding/:employeeId/emergency-contacts` | Submit emergency contacts | Self |
| `PUT` | `/onboarding/:employeeId/tax-setup` | Submit PAN, PF nominee, regime choice | Self |
| `POST` | `/onboarding/:employeeId/assets` | Record asset issuance | Admin, HR |
| `POST` | `/onboarding/:employeeId/assets/:index/acknowledge` | Employee acknowledges asset | Self |
| `POST` | `/onboarding/:employeeId/assign-buddy` | Assign buddy/mentor | HR |
| `POST` | `/onboarding/:employeeId/probation/confirm` | Confirm probation completion | Admin, HR |
| `POST` | `/onboarding/:employeeId/probation/extend` | Extend probation with reason | Admin, HR |
| `GET` | `/onboarding/pending` | List employees with incomplete onboarding | Admin, HR |
| `GET` | `/onboarding/probation-due` | List employees with upcoming probation end | Admin, HR |

#### 6.2.4 User Stories

- **US-ONB-01**: As a new employee, I see a step-by-step onboarding checklist in my dashboard with progress percentage.
- **US-ONB-02**: As a new employee, I can upload required documents (Aadhaar, PAN, bank proof, education certificates) and track their verification status.
- **US-ONB-03**: As an HR admin, I can verify or reject uploaded documents with feedback for the employee to re-upload.
- **US-ONB-04**: As an HR admin, I receive automated reminders when employees' probation periods are ending in 30/15/7 days.
- **US-ONB-05**: As a new employee, I can see my assigned buddy's profile and contact details.
- **US-ONB-06**: As an HR admin, I can track onboarding completion across all new joiners in a dashboard view.

---

### 6.3 Employee Offboarding

#### 6.3.1 Data Model — `OffboardingProcess`

```typescript
interface IOffboardingProcess extends Document {
  organizationId: string;
  employeeId: string;

  exitType: 'resignation' | 'termination' | 'absconding' | 'retirement' | 'contract_end';

  resignation?: {
    submittedAt: Date;
    reason: string;
    noticePeriodDays: number;
    lastWorkingDate: Date;         // computed: submittedAt + noticePeriodDays (minus weekends/holidays)
    noticePeriodWaived: boolean;
    waivedDays: number;
    shortfallDays: number;
    shortfallRecoveryAmount: number; // (dailySalary * shortfallDays) in paise
    acceptedBy?: string;
    acceptedAt?: Date;
  };

  clearance: Array<{
    department: 'IT' | 'finance' | 'HR' | 'admin' | 'reporting_manager' | 'library' | 'security';
    status: 'pending' | 'cleared' | 'blocked';
    clearedBy?: string;
    clearedAt?: Date;
    blockReason?: string;
    items?: string[];              // what to check, e.g., "laptop returned", "ID card returned"
  }>;

  assetReturn: Array<{
    assetType: string;
    description: string;
    serialNumber?: string;
    status: 'pending' | 'returned' | 'lost' | 'damaged';
    returnedAt?: Date;
    condition?: string;
    recoveryAmount?: number;       // if lost/damaged, in paise
  }>;

  knowledgeTransfer: {
    status: 'not_started' | 'in_progress' | 'completed';
    transferToEmployeeId?: string;
    items: Array<{
      topic: string;
      description?: string;
      completed: boolean;
      completedAt?: Date;
    }>;
    completedAt?: Date;
  };

  exitInterview: {
    scheduled: boolean;
    scheduledAt?: Date;
    conductedBy?: string;
    conductedAt?: Date;
    responses?: Record<string, string>;
    overallSentiment?: 'positive' | 'neutral' | 'negative';
    willingToRejoin?: boolean;
  };

  fullAndFinal: {
    status: 'not_initiated' | 'draft' | 'computed' | 'approved' | 'processed' | 'paid';

    earnings: Array<{
      component: string;
      amount: number;              // paise
    }>;
    // e.g., pending salary, earned leave encashment, bonus pro-rata, gratuity

    deductions: Array<{
      component: string;
      amount: number;
    }>;
    // e.g., notice period shortfall, asset recovery, loan outstanding, advance recovery

    totalEarnings: number;
    totalDeductions: number;
    netPayable: number;

    computedBy?: string;
    computedAt?: Date;
    approvedBy?: string;
    approvedAt?: Date;
    paidAt?: Date;
    paymentRef?: string;
  };

  documents: {
    experienceLetterUrl?: string;
    relievingLetterUrl?: string;
    fnfStatementUrl?: string;
    noc?: string;
  };

  status: 'initiated' | 'notice_period' | 'clearance_pending' | 'fnf_pending' | 'completed' | 'cancelled';

  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, employeeId: 1 }` (unique)
- `{ organizationId: 1, status: 1 }`
- `{ organizationId: 1, 'resignation.lastWorkingDate': 1 }`

#### 6.3.2 Full & Final Settlement Calculation

```
F&F Earnings:
  + Pending salary (days worked in last month, prorated)
  + Earned leave encashment = (unusedEarnedLeaves * dailyBasicSalary)
  + Bonus pro-rata (if applicable, e.g., 1/12th of annual bonus per month worked)
  + Gratuity (if service >= 5 years): (lastDrawnBasic * 15 * yearsOfService) / 26
  + Pending reimbursements (approved but unpaid)

F&F Deductions:
  - Notice period shortfall recovery = dailySalary * shortfallDays
  - Asset recovery (lost/damaged assets)
  - Outstanding loan balance
  - Advance recovery
  - TDS on F&F amount
  - PF contribution adjustments (if any)

Net F&F = Total Earnings - Total Deductions
```

#### 6.3.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/offboarding/:employeeId/initiate` | Start offboarding process | Admin, HR, Self (resignation) |
| `GET` | `/offboarding/:employeeId` | Get offboarding status | Admin, HR, Self |
| `POST` | `/offboarding/:employeeId/accept-resignation` | Accept resignation, set LWD | Admin, HR |
| `PUT` | `/offboarding/:employeeId/clearance/:department` | Update clearance status | Department head |
| `PUT` | `/offboarding/:employeeId/asset-return/:index` | Update asset return status | Admin, HR |
| `PUT` | `/offboarding/:employeeId/knowledge-transfer` | Update KT progress | Self, Manager |
| `POST` | `/offboarding/:employeeId/exit-interview` | Submit exit interview | HR |
| `POST` | `/offboarding/:employeeId/compute-fnf` | Compute F&F settlement | Admin, HR |
| `POST` | `/offboarding/:employeeId/approve-fnf` | Approve F&F | Admin |
| `POST` | `/offboarding/:employeeId/process-fnf` | Mark F&F as paid | Admin |
| `POST` | `/offboarding/:employeeId/generate-experience-letter` | Generate experience letter PDF | HR |
| `POST` | `/offboarding/:employeeId/generate-relieving-letter` | Generate relieving letter PDF | HR |
| `GET` | `/offboarding/active` | List all active offboarding processes | Admin, HR |
| `GET` | `/offboarding/clearance-pending` | List blocked clearances | Admin, HR |

#### 6.3.4 User Stories

- **US-OFF-01**: As an employee, I can submit my resignation through the portal, specifying my reason and preferred last working date.
- **US-OFF-02**: As an HR admin, I can accept/reject resignations and configure notice period waiver.
- **US-OFF-03**: As a department clearance owner (IT, finance, admin), I receive notifications to clear the exiting employee and can flag issues.
- **US-OFF-04**: As an HR admin, the system auto-computes F&F including leave encashment, notice shortfall, gratuity, and pending dues.
- **US-OFF-05**: As an HR admin, I can generate experience and relieving letters using org branding templates.
- **US-OFF-06**: As an exiting employee, I can track my offboarding progress — which clearances are done and what is pending.

---

### 6.4 Performance Management

#### 6.4.1 Data Model — `PerformanceReviewCycle`

```typescript
interface IPerformanceReviewCycle extends Document {
  organizationId: string;
  name: string;                    // "H1 2026 Performance Review"
  type: 'quarterly' | 'half_yearly' | 'annual' | 'probation';
  periodStart: Date;
  periodEnd: Date;

  timeline: {
    goalSettingStart: Date;
    goalSettingEnd: Date;
    selfAssessmentStart: Date;
    selfAssessmentEnd: Date;
    managerReviewStart: Date;
    managerReviewEnd: Date;
    calibrationStart?: Date;
    calibrationEnd?: Date;
    feedbackReleaseDate: Date;
  };

  ratingScale: {
    type: '5_point' | '4_point' | 'percentage';
    labels: Array<{
      value: number;
      label: string;               // e.g., "Exceeds Expectations"
      description: string;
    }>;
  };

  applicableTo: {
    departments?: string[];        // empty = all
    designationLevels?: string[];
    employmentTypes?: string[];
  };

  settings: {
    selfAssessmentRequired: boolean;
    peerFeedbackEnabled: boolean;
    peerFeedbackCount: number;
    weightDistribution: {
      goals: number;               // percentage, e.g., 70
      competencies: number;        // e.g., 20
      peerFeedback: number;        // e.g., 10
    };
    salaryRevisionLinked: boolean;
  };

  status: 'draft' | 'active' | 'in_progress' | 'calibration' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 6.4.2 Data Model — `PerformanceReview`

```typescript
interface IPerformanceReview extends Document {
  organizationId: string;
  cycleId: string;                 // ref: PerformanceReviewCycle
  employeeId: string;
  managerId: string;

  goals: Array<{
    title: string;
    description: string;
    category: 'business' | 'technical' | 'leadership' | 'personal_development';
    weight: number;                // percentage
    targetMetric?: string;
    targetValue?: number;
    actualValue?: number;
    selfRating?: number;
    managerRating?: number;
    status: 'not_started' | 'in_progress' | 'achieved' | 'partially_achieved' | 'not_achieved';
  }>;

  competencies: Array<{
    name: string;
    description: string;
    weight: number;
    selfRating?: number;
    managerRating?: number;
  }>;

  selfAssessment: {
    submitted: boolean;
    submittedAt?: Date;
    achievements: string;
    challenges: string;
    developmentAreas: string;
    comments: string;
  };

  managerReview: {
    submitted: boolean;
    submittedAt?: Date;
    overallComments: string;
    strengths: string;
    areasForImprovement: string;
    promotionRecommendation: boolean;
    salaryRevisionRecommendation?: {
      recommended: boolean;
      suggestedPercentage?: number;
    };
  };

  peerFeedback: Array<{
    peerId: string;
    rating?: number;
    strengths: string;
    improvements: string;
    submittedAt: Date;
  }>;

  finalRating: {
    goalsScore: number;
    competenciesScore: number;
    peerScore: number;
    overallScore: number;
    overallRating: number;         // mapped to rating scale
    ratingLabel: string;
    calibratedRating?: number;     // post-calibration adjustment
    calibratedBy?: string;
  };

  pip?: {
    triggered: boolean;
    reason: string;
    startDate: Date;
    endDate: Date;
    objectives: Array<{
      objective: string;
      deadline: Date;
      status: 'pending' | 'met' | 'not_met';
    }>;
    reviewDate: Date;
    outcome?: 'improved' | 'extended' | 'terminated';
  };

  acknowledgement: {
    employeeAcknowledged: boolean;
    acknowledgedAt?: Date;
    employeeComments?: string;
    disputeRaised: boolean;
    disputeReason?: string;
    disputeResolution?: string;
  };

  status: 'goal_setting' | 'self_assessment' | 'manager_review' | 'peer_feedback' |
          'calibration' | 'feedback_released' | 'acknowledged' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, cycleId: 1, employeeId: 1 }` (unique)
- `{ organizationId: 1, employeeId: 1, status: 1 }`
- `{ managerId: 1, cycleId: 1, status: 1 }`

#### 6.4.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/performance/cycles` | Create review cycle | Admin |
| `GET` | `/performance/cycles` | List review cycles | Admin, HR |
| `GET` | `/performance/cycles/:id` | Get cycle details with stats | Admin, HR |
| `PUT` | `/performance/cycles/:id` | Update cycle settings | Admin |
| `POST` | `/performance/cycles/:id/activate` | Activate cycle (creates reviews for applicable employees) | Admin |
| `GET` | `/performance/reviews` | List reviews (filterable by cycle, department, status) | Admin, HR, Manager |
| `GET` | `/performance/reviews/:id` | Get review details | Admin, HR, Manager, Self |
| `PUT` | `/performance/reviews/:id/goals` | Set/update goals | Self, Manager |
| `POST` | `/performance/reviews/:id/self-assessment` | Submit self-assessment | Self |
| `POST` | `/performance/reviews/:id/manager-review` | Submit manager review | Manager |
| `POST` | `/performance/reviews/:id/peer-feedback` | Submit peer feedback | Peer |
| `POST` | `/performance/reviews/:id/calibrate` | Calibrate rating | Admin, HR |
| `POST` | `/performance/reviews/:id/release` | Release feedback to employee | Admin, HR |
| `POST` | `/performance/reviews/:id/acknowledge` | Employee acknowledges review | Self |
| `POST` | `/performance/reviews/:id/dispute` | Raise dispute | Self |
| `POST` | `/performance/reviews/:id/pip` | Initiate PIP | Manager, HR |
| `PUT` | `/performance/reviews/:id/pip/update` | Update PIP progress | Manager |
| `GET` | `/performance/my-reviews` | Employee's own reviews | Self |
| `GET` | `/performance/team-reviews` | Manager's team reviews | Manager |

#### 6.4.4 User Stories

- **US-PERF-01**: As an admin, I can create a performance review cycle with configurable timelines, rating scales, and weight distributions.
- **US-PERF-02**: As an employee, I can set my goals at the start of the review period with categories and target metrics.
- **US-PERF-03**: As an employee, I can complete my self-assessment with ratings against each goal and competency.
- **US-PERF-04**: As a manager, I can review each team member's self-assessment, provide ratings, and write detailed feedback.
- **US-PERF-05**: As a peer, I receive a request to provide feedback for a colleague and can submit anonymized ratings.
- **US-PERF-06**: As an admin, I can calibrate ratings across departments to ensure consistency.
- **US-PERF-07**: As a manager, I can initiate a PIP for underperforming employees with specific objectives and deadlines.
- **US-PERF-08**: As an employee, I can view my final rating, acknowledge it, or raise a dispute.
- **US-PERF-09**: As an admin, when salary revision is linked, approved performance ratings trigger salary revision proposals automatically.

---

## 7. Phase 3: Differentiators

**Timeline:** 8 weeks
**Priority:** MEDIUM — competitive edge

### 7.1 AI-Powered HR Analytics

#### 7.1.1 Data Model — `AnalyticsSnapshot`

```typescript
interface IAnalyticsSnapshot extends Document {
  organizationId: string;
  snapshotDate: Date;
  type: 'daily' | 'weekly' | 'monthly';

  headcount: {
    total: number;
    byDepartment: Record<string, number>;
    byDesignation: Record<string, number>;
    byEmploymentType: Record<string, number>;
    byLocation: Record<string, number>;
    newJoiners: number;
    exits: number;
    netChange: number;
  };

  attrition: {
    monthlyRate: number;           // percentage
    annualizedRate: number;
    voluntaryExits: number;
    involuntaryExits: number;
    byDepartment: Record<string, number>;
    avgTenureAtExit: number;       // months
  };

  costAnalytics: {
    totalMonthlyCTC: number;       // paise
    totalMonthlyGross: number;
    totalStatutoryContributions: number;
    avgCTCPerEmployee: number;
    byDepartment: Record<string, number>;
    budgetVsActual?: {
      budget: number;
      actual: number;
      variance: number;
      variancePercent: number;
    };
  };

  attendanceMetrics: {
    avgAttendanceRate: number;
    avgLateArrivals: number;
    avgOvertimeHours: number;
    absenteeismRate: number;
  };

  leaveMetrics: {
    avgLeaveUtilization: number;
    pendingApprovals: number;
    lopCount: number;
  };

  createdAt: Date;
}
```

#### 7.1.2 AI Features

**Attrition Prediction Model:**
- Input features: attendance patterns (late arrivals trending up), leave patterns (increasing sick leave), performance ratings (declining), tenure, salary vs market benchmark, manager change frequency
- Output: per-employee attrition risk score (0-100) with top contributing factors
- Model: trained via `ai-service` using organization's historical data
- Refresh: weekly batch prediction job

**Salary Benchmarking:**
- Compare org salary bands against anonymized market data by role, experience, location
- Input: designation, experience years, city, department
- Output: percentile position (e.g., "Your Senior Engineers are at P45 — below market median")
- Data source: aggregated from Nexora platform data (with consent) + external APIs

**Headcount Forecasting:**
- Based on historical hiring/attrition trends, project headcount for next 3/6/12 months
- Factor in known upcoming exits (notice period employees)

#### 7.1.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/analytics/dashboard` | Organization HR dashboard metrics | Admin, HR |
| `GET` | `/analytics/headcount` | Headcount trends over time | Admin, HR |
| `GET` | `/analytics/attrition` | Attrition trends and breakdown | Admin, HR |
| `GET` | `/analytics/attrition/predictions` | AI-powered attrition risk scores | Admin, HR |
| `GET` | `/analytics/cost` | Cost-per-employee and department budgets | Admin |
| `GET` | `/analytics/salary-benchmarking` | Market salary comparison | Admin |
| `GET` | `/analytics/headcount-forecast` | Projected headcount | Admin, HR |
| `GET` | `/analytics/attendance-trends` | Attendance pattern analysis | Admin, HR |
| `POST` | `/analytics/snapshots/generate` | Trigger snapshot generation (cron-triggered) | System |

---

### 7.2 Employee Self-Service Portal Enhancements

#### 7.2.1 Tax Computation Simulator

Allows employees to model different scenarios:
- Switch between old/new tax regime and see impact
- Add/remove investment declarations and see monthly TDS change
- Project annual take-home based on current salary + bonuses

**API:**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/simulator/tax` | Simulate tax for given inputs | Self |
| `POST` | `/simulator/salary` | Simulate CTC breakdown what-if | Self, HR |

#### 7.2.2 Employee Loans & Advances

**Data Model — `EmployeeLoan`:**

```typescript
interface IEmployeeLoan extends Document {
  organizationId: string;
  employeeId: string;
  loanNumber: string;              // auto: "LOAN-2026-001"
  type: 'salary_advance' | 'personal_loan' | 'emergency_loan' | 'festival_advance';
  amount: number;                  // paise
  interestRate: number;            // annual percentage (0 for interest-free)
  tenure: number;                  // months
  emiAmount: number;               // paise
  disbursedAmount: number;
  outstandingBalance: number;
  totalInterest: number;

  schedule: Array<{
    installmentNumber: number;
    dueMonth: number;
    dueYear: number;
    principal: number;
    interest: number;
    emiAmount: number;
    status: 'pending' | 'deducted' | 'skipped';
    payrollRunId?: string;
    deductedAt?: Date;
  }>;

  reason: string;
  approvalChain: Array<{
    level: number;
    approverId: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
    actedAt?: Date;
  }>;

  disbursedAt?: Date;
  closedAt?: Date;
  status: 'applied' | 'approved' | 'disbursed' | 'active' | 'closed' | 'rejected' | 'cancelled';

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Integration with payroll:** Each month, the payroll engine checks active loans for the employee and adds EMI deductions to the `PayrollEntry.loanDeductions[]` array.

**API Endpoints:**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/loans` | Apply for loan/advance | Self |
| `GET` | `/loans` | List loans (self or all for admin) | All |
| `GET` | `/loans/:id` | Get loan details with schedule | Self, Admin |
| `POST` | `/loans/:id/approve` | Approve loan | Manager, Admin |
| `POST` | `/loans/:id/disburse` | Mark as disbursed | Admin |
| `POST` | `/loans/:id/close` | Early closure | Admin |
| `GET` | `/my/loans` | My active loans and EMI schedule | Self |

#### 7.2.3 Document Locker

Encrypted personal document storage for employees (Aadhaar, PAN, educational certificates, etc.), accessible only by the employee and authorized HR personnel.

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/document-locker/upload` | Upload personal document | Self |
| `GET` | `/document-locker` | List my documents | Self |
| `GET` | `/document-locker/:id/download` | Download document | Self, HR (with audit log) |
| `DELETE` | `/document-locker/:id` | Delete my document | Self |

---

### 7.3 Recruitment Module

#### 7.3.1 Data Model — `JobPosting`

```typescript
interface IJobPosting extends Document {
  organizationId: string;
  title: string;
  departmentId: string;
  designationId?: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  experienceRange: { min: number; max: number };
  salaryRange?: { min: number; max: number; currency: string };
  description: string;             // rich text
  requirements: string[];
  niceToHave?: string[];
  skills: string[];
  openings: number;
  filledCount: number;

  hiringManagerId: string;
  recruiterId?: string;

  pipeline: Array<{
    stageName: string;
    stageOrder: number;
    stageType: 'screening' | 'assessment' | 'interview' | 'offer' | 'hired';
  }>;

  status: 'draft' | 'open' | 'on_hold' | 'closed' | 'cancelled';
  publishedAt?: Date;
  closedAt?: Date;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 7.3.2 Data Model — `Candidate`

```typescript
interface ICandidate extends Document {
  organizationId: string;
  jobPostingId: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl: string;
  linkedinUrl?: string;
  portfolioUrl?: string;

  parsedResume?: {
    skills: string[];
    experience: Array<{
      company: string;
      role: string;
      duration: string;
    }>;
    education: Array<{
      institution: string;
      degree: string;
      year: number;
    }>;
    totalExperienceYears: number;
    matchScore?: number;           // AI-computed relevance to job posting
  };

  currentStage: string;
  stageHistory: Array<{
    stage: string;
    enteredAt: Date;
    exitedAt?: Date;
    outcome?: 'advanced' | 'rejected' | 'withdrawn';
    feedback?: string;
    feedbackBy?: string;
  }>;

  interviews: Array<{
    round: number;
    type: 'phone' | 'video' | 'onsite' | 'panel' | 'technical';
    scheduledAt: Date;
    interviewerIds: string[];
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    feedback?: {
      rating: number;
      strengths: string;
      weaknesses: string;
      recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';
      submittedBy: string;
      submittedAt: Date;
    };
  }>;

  offer?: {
    ctc: number;
    joiningDate: Date;
    designation: string;
    letterUrl?: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    sentAt?: Date;
    respondedAt?: Date;
    expiresAt?: Date;
  };

  source: 'portal' | 'referral' | 'linkedin' | 'naukri' | 'agency' | 'direct' | 'other';
  referredBy?: string;

  convertedToEmployeeId?: string;  // set when candidate becomes employee
  status: 'new' | 'screening' | 'in_process' | 'offered' | 'hired' | 'rejected' | 'withdrawn';

  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ organizationId: 1, jobPostingId: 1, email: 1 }` (unique)
- `{ organizationId: 1, status: 1 }`
- `{ jobPostingId: 1, currentStage: 1 }`

#### 7.3.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/jobs` | Create job posting | Admin, HR |
| `GET` | `/jobs` | List job postings (filterable) | Admin, HR, Manager |
| `GET` | `/jobs/:id` | Get job with pipeline stats | Admin, HR, Manager |
| `PUT` | `/jobs/:id` | Update job posting | Admin, HR |
| `PUT` | `/jobs/:id/status` | Change job status (open, hold, close) | Admin, HR |
| `POST` | `/candidates` | Add candidate to job | Admin, HR |
| `POST` | `/candidates/bulk-upload` | Bulk upload resumes | Admin, HR |
| `GET` | `/candidates` | List candidates (filterable by job, stage, status) | Admin, HR, Manager |
| `GET` | `/candidates/:id` | Get candidate details | Admin, HR, Manager |
| `POST` | `/candidates/:id/parse-resume` | Trigger AI resume parsing | Admin, HR |
| `POST` | `/candidates/:id/advance` | Move to next pipeline stage | Admin, HR |
| `POST` | `/candidates/:id/reject` | Reject with reason | Admin, HR, Interviewer |
| `POST` | `/candidates/:id/schedule-interview` | Schedule interview round | Admin, HR |
| `POST` | `/candidates/:id/interview-feedback` | Submit interview feedback | Interviewer |
| `POST` | `/candidates/:id/offer` | Create offer | Admin, HR |
| `POST` | `/candidates/:id/send-offer` | Send offer letter to candidate | Admin, HR |
| `POST` | `/candidates/:id/convert-to-employee` | Convert hired candidate to employee (creates in hr-service) | Admin, HR |
| `GET` | `/recruitment/analytics` | Pipeline analytics (time-to-hire, conversion rates, source effectiveness) | Admin, HR |

#### 7.3.4 User Stories

- **US-REC-01**: As an HR admin, I can create a job posting with a customizable hiring pipeline (stages like screening, technical round, HR round, offer).
- **US-REC-02**: As an HR admin, I can upload resumes in bulk and the system auto-parses skills, experience, and computes a relevance match score.
- **US-REC-03**: As a hiring manager, I can view all candidates in my job's pipeline, see their current stage, and review interview feedback.
- **US-REC-04**: As an interviewer, I receive a calendar invite for scheduled interviews and can submit structured feedback with hire/no-hire recommendation.
- **US-REC-05**: As an HR admin, I can generate an offer letter using org templates and send it to the candidate via email.
- **US-REC-06**: As an HR admin, when a candidate accepts the offer, I can convert them to an employee with one click — this creates the employee in hr-service and initiates the onboarding checklist.
- **US-REC-07**: As an HR admin, I can view recruitment analytics: time-to-hire by role, conversion rates per stage, source effectiveness, and cost-per-hire.

---

## 8. UI Wireframe Descriptions

### 8.1 Payroll Dashboard (Admin)

**Layout:** Full-width dashboard with summary cards at top, action area in middle, recent runs at bottom.

**Top row cards:**
- Current month payroll status (badge: Draft/Processing/Review/Approved/Paid)
- Total employees on payroll (number with delta from last month)
- Total net disbursement this month (INR formatted: 45,23,500)
- Pending approvals count

**Action area:**
- "Run Payroll" primary button (disabled if current month already processed)
- Month/year selector
- Status filter tabs: All | Draft | Review | Approved | Paid

**Payroll runs table:**
| Run # | Period | Status | Employees | Gross | Net | Actions |
| PR-2026-04-001 | Apr 2026 | Review | 234 | 1,23,45,000 | 98,76,000 | View / Approve / Download |

### 8.2 Employee Payslip View (Self-Service)

**Layout:** Clean A4-style payslip card with org branding.

**Header:** Org logo + name + address (left), "Payslip for April 2026" (right)

**Employee details row:** Name | Employee ID | Department | Designation | Bank A/C (masked) | PAN (masked)

**Two-column body:**
- Left: Earnings table (Basic, HRA, DA, Conveyance, Medical, Special, Arrears, OT — each with amount)
- Right: Deductions table (PF, ESI, PT, TDS, LWF, Loan EMI — each with amount)

**Footer row:** Gross Earnings | Total Deductions | Net Pay (bold, large) | Net Pay in Words

**Actions:** Download PDF | Email to Me

### 8.3 Onboarding Checklist (New Employee)

**Layout:** Stepper/progress bar at top showing overall completion (e.g., 60%).

**Sections as expandable cards:**
1. Personal Details (green check if done, yellow warning if incomplete)
2. Documents (progress: 4/7 uploaded, list with status badges: Uploaded / Verified / Rejected)
3. Bank Details (green check or pending)
4. Emergency Contacts (green check or pending)
5. Tax Setup (regime selection, PAN, PF nominee)
6. IT Assets (list of issued items with acknowledge button)
7. Buddy Introduction (buddy card with name, photo, department, contact)

### 8.4 Performance Review (Employee)

**Layout:** Tab-based interface.

**Tab 1 — Goals:** Table with Goal Title | Category | Weight | Target | Self Rating (editable during self-assessment) | Manager Rating (visible after release)

**Tab 2 — Self Assessment:** Rich text fields: Achievements, Challenges, Development Areas, Comments. Submit button.

**Tab 3 — Feedback:** Read-only after release. Manager's comments, strengths, areas for improvement. Peer feedback (anonymized). Final rating with label (e.g., "4.2 / 5 — Exceeds Expectations").

**Tab 4 — PIP (if applicable):** Objectives table with deadline and status tracking.

### 8.5 Recruitment Pipeline (HR)

**Layout:** Kanban board view (default) with list view toggle.

**Kanban columns:** Screening | Technical Round | HR Round | Offer | Hired
**Each card:** Candidate name, experience years, match score (AI), applied date, source badge

**Sidebar on card click:** Full candidate profile, parsed resume data, interview history with feedback, stage timeline, actions (advance, reject, schedule interview, generate offer).

---

## 9. Non-Functional Requirements

### 9.1 Compliance & Legal

| Requirement | Details |
|---|---|
| Data residency | All payroll data stored in India-region MongoDB instances |
| PII encryption | Bank account numbers, PAN, Aadhaar encrypted at rest (AES-256) |
| Audit trail | Every payroll status change, salary modification, and approval logged with actor + timestamp |
| Data retention | Payroll records retained for minimum 8 years (Income Tax Act requirement) |
| Access control | Role-based: Admin (full), HR (payroll + onboarding), Manager (team reviews + approvals), Employee (self-service) |
| Statutory updates | Tax slabs, PF/ESI rates maintained as configurable reference data — updatable without code changes |

### 9.2 Security

| Requirement | Details |
|---|---|
| Authentication | JWT-based (existing pattern from auth-service) |
| Authorization | Organization-scoped — no cross-tenant data leakage |
| Sensitive field masking | Bank account, PAN, Aadhaar masked in API responses (full values only for authorized operations) |
| PDF security | Payslip PDFs password-protected (employee DOB in DDMMYYYY format as default password) |
| API rate limiting | Payroll processing: 1 concurrent run per org; Bulk operations: 10 req/min |
| Document upload | Virus scanning on uploaded documents (via media-service) |

### 9.3 Performance

| Requirement | Target |
|---|---|
| Payroll computation (500 employees) | < 60 seconds |
| Payroll computation (5,000 employees) | < 5 minutes |
| Payslip PDF generation (single) | < 3 seconds |
| Bulk payslip generation (500) | < 10 minutes (background job) |
| API response time (read operations) | < 200ms (p95) |
| API response time (write operations) | < 500ms (p95) |
| Concurrent payroll runs (platform-wide) | 50+ orgs simultaneously |

### 9.4 Scalability

- Payroll computation runs as async background jobs using Bull queue (Redis-backed, same pattern as notification-service)
- Large payroll runs chunked into batches of 100 employees per job
- PDF generation parallelized (10 concurrent workers per org)
- Analytics snapshots pre-computed daily via cron, not calculated on-the-fly

---

## 10. Rollout Plan

### Phase 1: Payroll Engine (Weeks 1-8)

| Week | Deliverable |
|---|---|
| 1-2 | Service scaffolding, schemas, salary structure CRUD, CTC breakdown logic |
| 3-4 | Payroll run workflow (draft through paid), calculation engine, LOP/OT/arrears |
| 5-6 | Statutory compliance (PF, ESI, TDS, PT, LWF calculations), investment declarations |
| 7 | Payslip PDF generation, statutory reports (ECR, Form 16), bank file export |
| 8 | Frontend: payroll dashboard, salary structure UI, payslip viewer, investment declaration forms |
| 8 | Integration testing, UAT with 3 pilot orgs |

**Go/No-Go Criteria:**
- Payroll run completes for 500 employees with < 1% discrepancy vs manual calculation
- All statutory deductions match independent verification
- Payslip PDF contains all required fields and renders correctly

### Phase 2: HR Gaps (Weeks 9-18)

| Week | Deliverable |
|---|---|
| 9-10 | Reimbursement module: claims, approvals, OCR integration, payroll integration |
| 11-13 | Onboarding: checklist engine, document upload/verify, probation tracking |
| 14-15 | Offboarding: exit workflow, clearance, F&F calculation, letter generation |
| 16-18 | Performance management: cycles, goals, reviews, calibration, PIP |
| 18 | Frontend for all Phase 2 modules, integration testing |

### Phase 3: Differentiators (Weeks 19-26)

| Week | Deliverable |
|---|---|
| 19-20 | HR analytics dashboard, pre-computed snapshots, attrition prediction model |
| 21-22 | Self-service: tax simulator, salary simulator, document locker |
| 23-24 | Employee loans: application, approval, EMI deduction via payroll |
| 25-26 | Recruitment: job postings, applicant tracking, resume parsing, offer generation |
| 26 | Final integration testing, performance benchmarking, production deployment |

---

## 11. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Payroll processing adoption | 80% of active orgs run payroll within 3 months of launch | Monthly active payroll runs / total active orgs |
| Time to process payroll | < 2 hours end-to-end (initiate to paid) for 500 employees | Avg time from draft to paid status |
| Payroll accuracy | < 0.1% error rate in salary calculations | Manual audit of sample entries per org |
| Statutory compliance | 100% accuracy in PF/ESI/TDS calculations | Monthly reconciliation against govt portal |
| Employee self-service adoption | 70% employees download payslips via portal (vs asking HR) | Payslip download events / total payslips generated |
| Reimbursement turnaround | < 5 business days from submission to reimbursement | Avg time from submitted to reimbursed status |
| Onboarding completion | 90% of new joiners complete checklist within 7 days | Completion timestamps vs joining dates |
| Performance review participation | 95% self-assessment submission rate during active cycles | Submitted / total reviews in cycle |
| Recruitment time-to-hire | < 30 days from posting to offer acceptance | Avg across all job postings |
| Platform churn reduction | 25% reduction in customer churn post-payroll launch | Monthly churn rate comparison |

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Statutory calculation errors leading to compliance penalties | Medium | Critical | Dedicated test suite with 500+ test cases covering edge cases (mid-month join, ESI ceiling crossover, regime switch). Monthly reconciliation tool. |
| Payroll data breach (PII exposure) | Low | Critical | Field-level encryption for PAN/bank details, masked API responses, PDF password protection, SOC2-compliant infrastructure, penetration testing before launch. |
| Tax slab/rate changes by government mid-year | High | Medium | All statutory rates stored as configurable reference data (not hardcoded). Admin UI to update rates. Automated alerts when government notifications are published. |
| Performance issues with large orgs (5,000+ employees) | Medium | High | Async job processing with Bull queues, batch chunking, pre-computed analytics, load testing with 10K employee dataset before launch. |
| Scope creep from customer-specific payroll requirements | High | Medium | Core engine handles 90% use cases. Custom components via org-level salary structure templates. Escape hatch: ad-hoc additions during payroll review phase. |
| Integration complexity with existing services | Medium | Medium | Defined HTTP API contracts between services. Circuit breaker pattern for inter-service calls. Fallback to cached data if dependent service is temporarily unavailable. |
| Low adoption due to migration effort from existing payroll tools | Medium | High | CSV import tool for historical salary structures and payslip data. Parallel-run mode: customers run both systems for 2 months and compare outputs. |
| AI model accuracy for attrition prediction / resume parsing | Medium | Low | Phase 3 features are enhancements, not core. Start with rule-based scoring, iterate with ML as data volume grows. Clear "AI-assisted" labeling — not auto-decisions. |

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|---|---|
| CTC | Cost to Company — total annual compensation including employer contributions |
| Gross Salary | CTC minus employer-only contributions (employer PF, employer ESI) |
| Net Salary | Gross minus all employee deductions (PF, ESI, PT, TDS, etc.) |
| PF | Provident Fund — mandatory retirement savings under EPF Act 1952 |
| ESI | Employees' State Insurance — health insurance for employees below wage ceiling |
| TDS | Tax Deducted at Source — monthly income tax deduction |
| PT | Professional Tax — state-level employment tax |
| LWF | Labour Welfare Fund — state-level welfare contribution |
| LOP | Loss of Pay — unpaid absence days deducted from salary |
| F&F | Full and Final — settlement paid to exiting employees |
| ECR | Electronic Challan-cum-Return — PF monthly filing format |
| UAN | Universal Account Number — unique PF account identifier |
| VPF | Voluntary Provident Fund — employee's additional PF contribution above statutory 12% |
| PIP | Performance Improvement Plan — structured plan for underperforming employees |

### 13.2 External References

- EPF contribution rates: https://www.epfindia.gov.in/site_en/index.php
- ESI Act provisions: https://www.esic.gov.in/
- Income Tax slabs (New Regime FY 2025-26+): https://www.incometax.gov.in
- Professional Tax state-wise: varies by state labor department
- Form 16 format: TRACES portal (https://www.tdscpc.gov.in)

### 13.3 Service Port Registry (Updated)

| Service | Port | Database |
|---|---|---|
| API Gateway | 3000 | — |
| Auth Service | 3001 | nexora_auth |
| Chat Service | 3002 | nexora_chat |
| Notification Service | 3006 | nexora_notifications |
| Media Service | 3007 | nexora_media |
| AI Service | 3009 | — |
| HR Service | 3010 | nexora_hr |
| Attendance Service | 3011 | nexora_attendance |
| Leave Service | 3012 | nexora_leave |
| Policy Service | 3013 | nexora_policies |
| **Payroll Service** | **3014** | **nexora_payroll** |
