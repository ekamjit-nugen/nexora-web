# PRD: Human Resources

**Module:** HR Service
**Version:** 1.0
**Date:** 2026-04-06
**Status:** Implemented
**Service:** `services/hr-service` (Port 3010)
**Owner:** Nexora Platform Team

---

## 1. Purpose

The HR module manages the full employee lifecycle — from onboarding and directory management to attendance tracking, leave management, department/team structure, designations, client/CRM management, and invoicing. It integrates with the Auth service for user provisioning and the Project service for client-project linking, all within a multi-tenant, org-scoped architecture.

---

## 2. Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Employee onboarding | < 5 minutes from invite to active employee |
| Attendance compliance | Manual entry approval turnaround < 24 hours |
| Leave visibility | Real-time balance tracking per leave type |
| Payroll readiness | Statutory config completeness > 90% before first payroll |
| CRM integration | Client-project linking with invoice tracking |

---

## 3. Architecture Overview

### 3.1 Service Configuration

| Property | Value |
|----------|-------|
| Port | 3010 (env: `HR_SERVICE_PORT`) |
| API Prefix | `/api/v1` |
| Database | MongoDB (`nexora_hr`) |
| Security | Helmet, JWT auth guard |
| Body Limit | 5MB (JSON/URL-encoded) |
| Health Check | `GET /api/v1/health` |

### 3.2 Module Structure

| Module | Entities |
|--------|----------|
| HR Module | Employees, Departments, Designations, Teams, Clients, Invoices, Invoice Templates, Call Logs |
| Health Module | Service health check |

### 3.3 Data Collections (8)

| Collection | Purpose |
|------------|---------|
| `employees` | Employee records and lifecycle |
| `departments` | Organizational structure |
| `designations` | Job titles, levels, salary bands |
| `teams` | Cross-functional or department teams |
| `clients` | CRM client management |
| `invoices` | Invoice generation and tracking |
| `invoicetemplates` | Reusable invoice templates |
| `calllogs` | CRM call tracking |

---

## 4. Employees

### 4.1 Employee Schema

**Identity & Contact:**

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope (indexed) |
| `userId` | string | Auth service user reference (unique) |
| `employeeId` | string | Auto-generated: `NXR-XXXX` (unique) |
| `firstName` | string | Required, trimmed |
| `lastName` | string | Required, trimmed |
| `email` | string | Unique, lowercase |
| `avatar` | string | Profile image URL |
| `phone` | string | Phone number |
| `dateOfBirth` | Date | Optional |
| `gender` | enum | male, female, other |

**Organization:**

| Field | Type | Notes |
|-------|------|-------|
| `departmentId` | string | Department reference (indexed) |
| `designationId` | string | Designation reference |
| `teamId` | string | Team reference |
| `reportingManagerId` | string | Manager employee ID (indexed, for org chart) |
| `employmentType` | enum | full_time, part_time, contract, intern (default: full_time) |

**Employment Timeline:**

| Field | Type | Notes |
|-------|------|-------|
| `joiningDate` | Date | Required |
| `probationEndDate` | Date | End of probation period |
| `confirmationDate` | Date | When confirmed |
| `exitDate` | Date | Last working day |
| `exitReason` | string | Reason for exit |

**Work Details:**

| Field | Type | Notes |
|-------|------|-------|
| `location` | string | Work location |
| `timezone` | string | Default: `Asia/Kolkata` |
| `skills` | string[] | Skill tags |

**Contact & Financial:**

| Field | Type | Notes |
|-------|------|-------|
| `emergencyContact` | object | {name, relation, phone} |
| `address` | object | {street, city, state, country, zip} |
| `bankDetails` | object | {bankName, accountNumber, ifsc, accountHolder} |

**Documents:**

| Field | Type | Notes |
|-------|------|-------|
| `documents` | array | [{type, url, uploadedAt, verified}] |

**Status & Policies:**

| Field | Type | Notes |
|-------|------|-------|
| `status` | enum | active, invited, pending, on_notice, exited, on_leave, probation |
| `isActive` | boolean | Default: true |
| `policyIds` | string[] | Attached HR policy IDs |

**Soft Delete & Audit:**

| Field | Type | Notes |
|-------|------|-------|
| `isDeleted` | boolean | Default: false |
| `deletedAt` | Date | Deletion timestamp |
| `createdBy` | string | Creator user ID |
| `updatedBy` | string | Last updater |

**Indexes:**
- Full-text: firstName, lastName, email, skills
- Compound: `{isDeleted, isActive}`, `{departmentId, status}`

### 4.2 Employee ID Generation

Format: `NXR-XXXX` (e.g., NXR-0001, NXR-0042)
- Finds highest existing NXR number globally
- Increments by 1
- Zero-padded to 4 digits

### 4.3 Employee Creation Flow

1. Validate email uniqueness per organization
2. Auto-generate `employeeId` (NXR-XXXX)
3. Auto-generate `userId` if not provided: `usr-{timestamp}-{random}`
4. Provision auth account:
   - If orgId provided → `POST /auth/organizations/{orgId}/invite` (creates user + org membership)
   - Else → `POST /auth/send-otp` (creates user without org context)
5. Send invitation email via SMTP with accept link
6. Employee record created with status `invited` or `active`

### 4.4 Employee Status Lifecycle

```
invited → active → on_notice → exited
                 → on_leave → active
                 → probation → active
```

| Status | Description |
|--------|-------------|
| `active` | Currently employed |
| `invited` | Invitation sent, not yet accepted |
| `pending` | Account created, setup incomplete |
| `on_notice` | Serving notice period |
| `exited` | No longer employed |
| `on_leave` | Currently on leave |
| `probation` | In probation period |

### 4.5 Org Chart

- Built from `reportingManagerId` relationships
- Hierarchical tree structure with nested children
- Root nodes: employees with no manager or manager not in org
- Filterable by department

### 4.6 Employee Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/employees` | Create employee (auto-provisions auth account) |
| GET | `/employees` | List with pagination, search, filters |
| GET | `/employees/stats` | Stats: total, active, on_notice, departments |
| GET | `/employees/org-chart` | Hierarchical org chart |
| GET | `/employees/:id` | Get employee details |
| PUT | `/employees/:id` | Update employee |
| DELETE | `/employees/:id` | Soft delete |
| GET | `/employees/:id/policies` | Get attached policy IDs |
| POST | `/employees/:id/policies` | Attach policy |
| DELETE | `/employees/:id/policies/:policyId` | Detach policy |

### 4.7 Employee Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search firstName, lastName, email, employeeId, skills |
| `departmentId` | string | Filter by department |
| `designationId` | string | Filter by designation |
| `employmentType` | enum | Filter by employment type |
| `status` | enum | Filter by status |
| `location` | string | Filter by location |
| `page` | number | Page number (default: 1) |
| `limit` | number | Page size (default: 20, max: 100) |
| `sort` | string | Sort field (prefix `-` for descending) |

---

## 5. Departments

### 5.1 Department Schema

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `name` | string | Required, trimmed |
| `code` | string | Required, unique per org, uppercase (e.g., ENG, HR) |
| `description` | string | Optional |
| `headId` | string | Department head employee ID |
| `parentDepartmentId` | string | For hierarchical departments |
| `costCenter` | string | Cost center code |
| `budget` | object | {amount, currency (INR), period (monthly/quarterly/annual)} |
| `isActive` | boolean | Default: true |
| `isDeleted` | boolean | Soft delete |

### 5.2 Default Departments

One-click seed from frontend:

| Name | Code |
|------|------|
| Engineering | ENG |
| Design | DESIGN |
| Human Resources | HR |
| Finance | FIN |
| Marketing | MKT |
| Sales | SALES |
| Operations | OPS |
| Leadership | LEAD |

### 5.3 Department Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/departments` | Create department |
| GET | `/departments` | List all departments |
| GET | `/departments/:id` | Get department |
| PUT | `/departments/:id` | Update department |
| DELETE | `/departments/:id` | Delete (fails if employees assigned) |

### 5.4 Hierarchical Structure

- `parentDepartmentId` enables nested departments
- Frontend renders tree view with indented children
- Tree branch icon (└) for visual hierarchy

---

## 6. Designations

### 6.1 Designation Schema

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `title` | string | Job title (required) |
| `level` | number | Career level 1-10 (required) |
| `track` | enum | individual_contributor, management (default: IC) |
| `departmentId` | string | Optional department scope |
| `salaryBand` | object | {min, max, currency (INR)} |
| `isActive` | boolean | Default: true |
| `isDeleted` | boolean | Soft delete |

### 6.2 Designation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/designations` | Create designation |
| GET | `/designations` | List all (sorted by level, title) |
| PUT | `/designations/:id` | Update designation |
| DELETE | `/designations/:id` | Soft delete |

---

## 7. Teams

### 7.1 Team Schema

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `name` | string | Required |
| `description` | string | Optional |
| `departmentId` | string | Parent department (required) |
| `leadId` | string | Team lead employee ID |
| `members` | string[] | Member employee IDs |
| `isCrossFunctional` | boolean | Cross-department team |
| `isActive` | boolean | Default: true |
| `isDeleted` | boolean | Soft delete |

### 7.2 Team Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams` | Create team |
| GET | `/teams` | List teams (filter by departmentId) |
| PUT | `/teams/:id` | Update team |
| DELETE | `/teams/:id` | Soft delete |

---

## 8. Attendance

### 8.1 Overview

Attendance tracking with check-in/out, manual entries, and an approval workflow for corrections.

### 8.2 Attendance Record

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | string | Employee reference |
| `date` | string | Attendance date |
| `checkInTime` | string | Clock-in timestamp |
| `checkOutTime` | string | Clock-out timestamp |
| `totalWorkingHours` | number | Calculated hours |
| `status` | enum | present, late, absent, wfh |
| `entryType` | enum | system, manual |
| `checkInMethod` | string | Tracking method used |
| `approvalStatus` | enum | pending, approved, rejected |
| `notes` | string | Optional notes |

### 8.3 Features

**Check-in/Check-out:**
- One-click clock in/out
- Live elapsed time timer
- Multiple sessions per day tracked
- Session count tracking

**Manual Entry:**
- Submit missed attendance with date, times, reason
- Reason categories: forgot, system_down, network_issue, wfh, other
- Quick time select buttons (09:00, 09:30, 10:00 / 17:00, 18:00, 19:00)

**Approval Workflow:**
- Manual entries require HR/Admin approval
- Status flow: pending → approved / rejected
- Separate "Pending Approvals" tab for reviewers

**Policy Integration:**
- Displays active work timing policy (start/end times, minimum hours)
- Visual progress bar: hours worked vs policy minimum
- Overtime warning when exceeding policy hours

### 8.4 Attendance Statistics

| Metric | Description |
|--------|-------------|
| Present | Count of present employees today |
| Late | Employees who arrived late |
| Absent | Missing attendance records |
| WFH | Working from home count |
| Pending Approvals | Manual entries awaiting review |

### 8.5 Attendance Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attendance/check-in` | Clock in |
| POST | `/attendance/check-out` | Clock out |
| GET | `/attendance/today` | Get today's record |
| GET | `/attendance/my` | Personal history |
| GET | `/attendance/all` | All employees (admin/HR) |
| GET | `/attendance/stats` | Attendance statistics |
| POST | `/attendance/manual` | Submit manual entry |
| GET | `/attendance/pending` | Pending approvals |
| PUT | `/attendance/:id/approve` | Approve/reject entry |

---

## 9. Leave Management

### 9.1 Overview

Leave application, balance tracking, and approval workflow with policy-based allocation.

### 9.2 Leave Types

| Type | Code | Description |
|------|------|-------------|
| Casual Leave | CL | General personal leave |
| Sick Leave | SL | Medical leave |
| Earned Leave | EL | Accrued leave |
| Work From Home | WFH | Remote work day |
| Maternity Leave | ML | Female employees |
| Paternity Leave | PL | Male employees |
| Bereavement Leave | BL | Family loss |
| Compensatory Off | CO | For extra work days |
| Loss of Pay | LOP | Unpaid leave |

### 9.3 Leave Record

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | string | Employee reference |
| `leaveType` | enum | casual, sick, earned, wfh, maternity, paternity, bereavement, comp_off, lop |
| `startDate` | Date | Leave start |
| `endDate` | Date | Leave end |
| `totalDays` | number | Business days calculated |
| `reason` | string | Leave reason |
| `status` | enum | pending, approved, rejected, cancelled |
| `approvedBy` | string | Approver user ID |
| `rejectionReason` | string | If rejected |

### 9.4 Leave Balance

| Field | Type | Notes |
|-------|------|-------|
| Opening balance | number | Start of period |
| Accrued | number | Earned during period |
| Used | number | Consumed |
| Adjusted | number | Manual adjustments |
| Carried forward | number | From previous period |
| Available | number | Total - Used |
| Annual quota | number | From policy |

### 9.5 Leave Status Workflow

```
pending → approved → (taken)
       → rejected
       → cancelled (by employee)
approved → cancelled (by employee before start)
```

### 9.6 Features

- **Business day calculation:** Auto-excludes weekends
- **Balance enforcement:** Cannot exceed available balance
- **Policy integration:** Leave types and quotas from org work preferences
- **Cancellation:** Employees can cancel pending or approved (future) leaves
- **Rejection reason:** HR provides reason when rejecting

### 9.7 Leave Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/leaves/apply` | Submit leave request |
| GET | `/leaves/my` | Personal leave history |
| GET | `/leaves/all` | All leaves (admin/HR) |
| GET | `/leaves/balance` | Current leave balances |
| PUT | `/leaves/:id/approve` | Approve/reject with reason |
| PUT | `/leaves/:id/cancel` | Cancel leave with reason |
| GET | `/leaves/stats` | Leave statistics |

---

## 10. Work Preferences (Settings)

Configured at the organization level via the Auth service settings endpoints.

### 10.1 Work Timing

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workingDays` | string[] | Mon-Fri | Active working days |
| `saturdayPattern` | string | — | Saturday work pattern |
| `workingHours.start` | string | 09:00 | Shift start |
| `workingHours.end` | string | 18:00 | Shift end |
| `workingHours.breakMinutes` | number | 60 | Break duration |
| `workingHours.effectiveHours` | number | — | Net working hours |
| `flexibleTiming` | boolean | false | Allow flexible hours |
| `gracePeriodLate` | number | 15 | Late grace (minutes) |
| `gracePeriodEarly` | number | 15 | Early leave grace (minutes) |
| `halfDayThreshold` | number | 4 | Hours for half day |

### 10.2 Overtime

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `overtime.applicable` | boolean | false | Overtime tracking enabled |
| `overtime.rate` | number | 1.5 | Overtime multiplier (1.5x, 2x, 2.5x) |
| `overtime.minimumTriggerMinutes` | number | 30 | Min minutes to trigger OT |

### 10.3 Attendance Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `trackingMethods` | string[] | — | Manual, Mobile App, Biometric, GPS |
| `geoFenceRadius` | number | — | GPS geo-fence (meters) |
| `officeLocations` | array | — | [{name, latitude, longitude, radius}] |
| `allowedIPRanges` | string[] | — | IP whitelist |
| `autoCheckout` | boolean | false | Auto clock-out |
| `regularizationAllowed` | boolean | true | Allow manual entries |
| `regularizationWindowDays` | number | — | Days to submit corrections |

### 10.4 Holidays

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Holiday name |
| `date` | Date | Holiday date |
| `type` | enum | National, Optional |
| `isOptional` | boolean | Restricted holiday |

### 10.5 Leave Type Configuration

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Leave type name |
| `code` | string | Short code (max 10 chars) |
| `annualQuota` | number | Days per year |
| `accrualMethod` | enum | fixed, monthly, pro-rata |
| `genderSpecific` | enum | no, female, male |
| `carryForward` | boolean | Allow carry forward |
| `maxCarryForwardDays` | number | If carry forward enabled |
| `encashable` | boolean | Can encash unused days |
| `approvalRequired` | boolean | Needs manager approval |

---

## 11. Payroll Configuration (Settings)

Statutory deduction setup configured at the organization level.

### 11.1 Payroll Schedule

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `payCycle` | enum | monthly | monthly, quarterly, half-yearly, yearly |
| `payDay` | number | — | Day of month for payment |
| `processingStartDay` | number | — | When payroll processing begins |
| `attendanceCutoff` | number | — | Attendance data cutoff day |
| `arrearsProcessing` | boolean | false | Process arrears |
| `paymentModes` | string[] | — | Bank Transfer, Cheque, NEFT, RTGS, IMPS, Cash, DD |

### 11.2 Provident Fund (PF)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applicable` | boolean | false | PF enabled |
| `registrationNumber` | string | — | PF registration |
| `registrationDate` | Date | — | Registration date |
| `employerRate` | number | 12% | Employer contribution |
| `employeeRate` | number | 12% | Employee contribution |
| `adminRate` | number | 0.5% | Admin charges |
| `edliRate` | number | 0.5% | EDLI contribution |
| `wageCeiling` | number | 15,000 | PF wage ceiling (INR) |
| `includeInCTC` | boolean | — | Include in CTC calculation |
| `vpfAllowed` | boolean | — | Voluntary PF allowed |

### 11.3 Employee State Insurance (ESI)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applicable` | boolean | false | ESI enabled |
| `registrationNumber` | string | — | ESI registration |
| `registrationDate` | Date | — | Registration date |
| `employerRate` | number | 3.25% | Employer contribution |
| `employeeRate` | number | 0.75% | Employee contribution |
| `wageCeiling` | number | 21,000 | ESI wage limit (INR) |
| `dispensaryCode` | string | — | Dispensary code |
| `dispensaryName` | string | — | Dispensary name |

### 11.4 Tax Deducted at Source (TDS)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applicable` | boolean | false | TDS enabled |
| `defaultTaxRegime` | enum | new | old, new |
| `autoCalculate` | boolean | false | Auto TDS calculation |
| `fileTdsReturns` | boolean | false | File returns |

### 11.5 Professional Tax (PT)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applicable` | boolean | false | PT enabled |
| `state` | string | — | State for PT rules |
| `registrationNumber` | string | — | PT registration |
| `deductionFrequency` | enum | monthly | monthly, quarterly, annually |

### 11.6 Labour Welfare Fund (LWF)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applicable` | boolean | false | LWF enabled |
| `state` | string | — | State for LWF rules |
| `deductionFrequency` | enum | — | Deduction frequency |

---

## 12. Business Details (Settings)

Legal and regulatory information configured at the organization level.

### 12.1 Registered Address

| Field | Required | Notes |
|-------|----------|-------|
| `line1` | Yes | Address line 1 |
| `line2` | No | Address line 2 |
| `city` | Yes | City |
| `state` | Yes | State/Province |
| `pincode` | Yes | PIN/ZIP (6 digits) |
| `country` | Read-only | Set in General Settings |

### 12.2 Tax & Registration Numbers

| Field | Format | Description |
|-------|--------|-------------|
| PAN | `ABCDE1234F` (10 chars) | Permanent Account Number |
| GSTIN | `22ABCDE1234F1Z5` (15 chars) | GST Identification Number |
| TAN | `ABCD12345E` (10 chars) | Tax Deduction Account Number |
| CIN | `U12345MH2020PLC123456` (21 chars) | Corporate Identity Number |
| MSME | `UDYAM-XX-00-0000000` | Udyam Registration |
| IEC | 10 digits | Import Export Code |
| S&E License | — | Shops & Establishment License |

### 12.3 Authorized Signatory

| Field | Notes |
|-------|-------|
| Full Name | Signatory name |
| Designation | Title/position |
| Personal PAN | Signatory PAN |
| DIN | Director Identification Number (8 digits) |

### 12.4 Bank Details

| Field | Required | Notes |
|-------|----------|-------|
| Bank Name | Yes | Bank name |
| Branch Name | No | Branch |
| Account Number | Yes | Encrypted at rest |
| IFSC Code | Yes | `SBIN0001234` (11 chars) |
| Account Type | No | Current/Savings |
| MICR Code | No | 9 digits |
| SWIFT Code | No | 8-11 chars (international) |

---

## 13. Clients (CRM)

### 13.1 Client Schema

**Basic Information:**

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `companyName` | string | Required, unique per org |
| `displayName` | string | Optional friendly name |
| `industry` | enum | technology, finance, healthcare, education, retail, manufacturing, media, consulting, other |
| `website` | string | Company website |
| `taxId` | string | Tax identifier |

**Contact Persons:**

| Field | Type | Notes |
|-------|------|-------|
| `contactPersons` | array | [{name, email, phone, designation, isPrimary}] |
| `contactPerson` | object | Legacy single contact (deprecated) |

**Financial:**

| Field | Type | Notes |
|-------|------|-------|
| `totalRevenue` | number | Cumulative revenue |
| `outstandingAmount` | number | Unpaid amount |
| `lastInvoiceDate` | Date | Most recent invoice |
| `lastPaymentDate` | Date | Most recent payment |
| `currency` | string | Default: INR |
| `paymentTerms` | number | Days (default: 30) |

**Billing:**

| Field | Type | Notes |
|-------|------|-------|
| `billingAddress` | object | {street, city, state, country, zip} |

**Status:**

| Status | Description |
|--------|-------------|
| `active` | Current client |
| `inactive` | Dormant client |
| `prospect` | Potential client |

### 13.2 Client Dashboard

Aggregated view including:
- Client details
- Linked projects (fetched from project-service)
- Invoice summary (total, paid, pending, overdue)

### 13.3 Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clients` | Create client |
| GET | `/clients` | List with pagination, search, filters |
| GET | `/clients/stats` | Stats: total, active, inactive, prospects |
| GET | `/clients/:id` | Get client details |
| GET | `/clients/:id/dashboard` | Client dashboard with projects + invoices |
| GET | `/clients/:id/projects` | Linked projects (from project-service) |
| POST | `/clients/:id/projects` | Link project to client |
| DELETE | `/clients/:id/projects/:projId` | Unlink project |
| POST | `/clients/:id/contacts` | Add contact person |
| DELETE | `/clients/:id/contacts/:idx` | Remove contact person |
| PUT | `/clients/:id` | Update client |
| DELETE | `/clients/:id` | Soft delete |

---

## 14. Invoices

### 14.1 Invoice Schema

**Invoice Identity:**

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `invoiceNumber` | string | Auto: `INV-YYYY-XXXX` (unique per org) |
| `clientId` | string | Client reference |
| `projectId` | string | Optional project reference |
| `templateId` | string | Invoice template used |

**Dates:**

| Field | Type | Notes |
|-------|------|-------|
| `issueDate` | Date | Invoice date |
| `dueDate` | Date | Payment due date |
| `sentAt` | Date | When emailed |

**Line Items:**

| Field | Type | Notes |
|-------|------|-------|
| `description` | string | Item description |
| `quantity` | number | Quantity (min: 0) |
| `rate` | number | Unit rate (min: 0) |
| `amount` | number | Calculated: quantity x rate |
| `taxRate` | number | Tax percentage |
| `taxAmount` | number | Calculated tax |

**Totals:**

| Field | Type | Notes |
|-------|------|-------|
| `subtotal` | number | Sum of item amounts |
| `taxTotal` | number | Sum of item taxes |
| `discount` | number | Discount value |
| `discountType` | enum | percentage, fixed |
| `total` | number | subtotal + taxTotal - discount |
| `amountPaid` | number | Payments received |
| `balanceDue` | number | total - amountPaid |

**Status:**

| Status | Description | Editable | Deletable |
|--------|-------------|----------|-----------|
| `draft` | Newly created | Yes | Yes |
| `sent` | Emailed to client | Yes | No |
| `partially_paid` | Partial payment received | No | No |
| `paid` | Fully paid (balanceDue = 0) | No | No |
| `overdue` | Past due date | No | No |
| `cancelled` | Cancelled | No | No |

**Recurring:**

| Field | Type | Notes |
|-------|------|-------|
| `isRecurring` | boolean | Recurring invoice |
| `recurringInterval` | enum | weekly, biweekly, monthly, quarterly, yearly |
| `recurringEmail` | string | Auto-send to email |
| `recurringNextDate` | Date | Next generation date |
| `recurringEndDate` | Date | Stop date |

**Branding:**

| Field | Type | Notes |
|-------|------|-------|
| `brandName` | string | Company name on invoice |
| `brandLogo` | string | Logo URL |
| `brandAddress` | string | Company address |
| `signature` | string | Authorized signature |

### 14.2 Invoice Calculation Logic

```
For each line item:
  amount = quantity × rate
  taxAmount = amount × (taxRate / 100)

subtotal = Σ item.amount
taxTotal = Σ item.taxAmount

if discountType === 'percentage':
  discountAmount = (subtotal + taxTotal) × (discount / 100)
else:
  discountAmount = discount

total = subtotal + taxTotal - discountAmount
balanceDue = total - amountPaid
```

### 14.3 Invoice Number Generation

Format: `INV-YYYY-XXXX`
- YYYY = current year
- XXXX = sequential number (finds highest for current year, increments)
- Unique per organization via compound index

### 14.4 Invoice Email

- HTML invoice generated with itemized table, totals, branding
- Sent via SMTP (Nodemailer)
- Currency symbols: USD ($), EUR (€), INR (₹)
- Updates: status → `sent`, sentAt, sentTo, emailCount++

### 14.5 Payment Recording

- `markAsPaid(id, {amount, paymentMethod, paymentNotes})`
- Supports partial payments (multiple calls)
- If `balanceDue ≤ 0` → status = `paid`
- Else → status = `partially_paid`

### 14.6 Invoice Templates

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Template name |
| `description` | string | Description |
| `layout` | enum | standard, modern, minimal, professional, creative |
| `colorScheme` | string | Hex color (default: #2E86C1) |
| `showLogo` | boolean | Display logo |
| `showTax` | boolean | Display tax breakdown |
| `showDiscount` | boolean | Display discount |
| `defaultPaymentTerms` | number | Default 30 days |
| `defaultCurrency` | string | Default INR |
| `defaultNotes` | string | Default footer notes |
| `defaultTerms` | string | Default terms |
| `defaultItems` | array | [{description, rate}] |
| `isDefault` | boolean | Organization default template |

### 14.7 Invoice Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/invoices` | Create invoice (auto-generates number, calculates totals) |
| GET | `/invoices` | List with pagination, filters |
| GET | `/invoices/stats` | Stats: counts by status, revenue, paid/pending |
| GET | `/invoices/templates` | List templates |
| POST | `/invoices/templates` | Create template |
| DELETE | `/invoices/templates/:id` | Delete template |
| GET | `/invoices/:id` | Get invoice details |
| POST | `/invoices/:id/send` | Email invoice to client |
| POST | `/invoices/:id/mark-paid` | Record payment |
| PUT | `/invoices/:id` | Update invoice (draft/sent only) |
| DELETE | `/invoices/:id` | Delete invoice (draft only) |
| PUT | `/invoices/:id/status` | Update invoice status |

---

## 15. Call Logs (CRM)

### 15.1 Call Log Schema

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant scope |
| `callerId` | string | Caller user ID |
| `receiverId` | string | Receiver user ID |
| `callerName` | string | Caller display name |
| `receiverName` | string | Receiver display name |
| `type` | enum | audio, video |
| `status` | enum | initiated, ringing, answered, missed, declined, ended, failed |
| `startTime` | Date | Call start |
| `endTime` | Date | Call end |
| `duration` | number | Auto-calculated (seconds) |
| `notes` | string | Call notes |
| `roomId` | string | WebRTC room reference |
| `isDeleted` | boolean | Soft delete |

### 15.2 Duration Auto-Calculation

When status changes to `ended` without explicit endTime:
- `duration = (endTime - startTime) / 1000` seconds

### 15.3 Call Statistics (Daily)

| Metric | Description |
|--------|-------------|
| Total calls | Count of today's calls |
| Missed | Missed call count |
| Completed | Ended calls count |
| Avg duration | Average of completed call durations |

### 15.4 Call Log Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/call-logs` | Create call log |
| GET | `/call-logs` | List with pagination, filters |
| GET | `/call-logs/stats` | Daily statistics |
| GET | `/call-logs/recent` | Last 20 calls for user |
| GET | `/call-logs/:id` | Get call log |
| PUT | `/call-logs/:id` | Update status/notes |

---

## 16. Setup Completeness

Organization onboarding progress tracked across 6 weighted categories:

| Category | Weight | Checks |
|----------|--------|--------|
| Basic Info | 15% | Org name, type, size, country |
| Business Details | 20% | Address, pincode, PAN |
| Payroll Setup | 25% | PF registration, TDS/TAN |
| Work Configuration | 15% | Working days, hours, holidays |
| Branding | 10% | Logo uploaded |
| Team Setup | 15% | 2+ active members |

- Dashboard widget shows overall percentage and per-category status
- Suggests next high-impact action
- Dismissible (stored in localStorage)

---

## 17. Frontend Architecture

### 17.1 HR Pages

| Page | Route | Purpose |
|------|-------|---------|
| Directory | `/directory` | Employee CRUD, search, org chart |
| Attendance | `/attendance` | Check-in/out, manual entry, approvals |
| Leaves | `/leaves` | Leave application, balance, approvals |
| Departments | `/settings/departments` | Department structure management |
| Work Preferences | `/settings/work-preferences` | Work timing, holidays, leave types |
| Payroll | `/settings/payroll` | Statutory deduction config |
| Business | `/settings/business` | Legal, tax, bank details |

### 17.2 Role-Based Access

| Feature | Employee | HR | Admin | Owner |
|---------|----------|-----|-------|-------|
| View directory | Read-only | Full | Full | Full |
| Add/edit employees | No | Yes | Yes | Yes |
| Check in/out | Yes | Yes | Yes | Yes |
| Submit manual entry | Yes | Yes | Yes | Yes |
| Approve attendance | No | Yes | Yes | Yes |
| Apply for leave | Yes | Yes | Yes | Yes |
| Approve/reject leave | No | Yes | Yes | Yes |
| Manage departments | No | No | Yes | Yes |
| Configure work prefs | No | Yes | Yes | Yes |
| Configure payroll | No | No | Yes | Yes |
| Business details | No | No | Yes | Yes |

### 17.3 UI Patterns

**Status Color Coding:**

| Status | Color |
|--------|-------|
| Active / Approved / Present | Emerald |
| Pending | Amber |
| Rejected / Absent / Missed | Red |
| On Notice / Probation | Amber |
| Invited | Blue |
| Exited / Cancelled | Gray |

**View Modes:**
- Directory: Grid view (3-4 columns) and List view
- Attendance: My / All Employees / Pending Approvals tabs
- Leaves: My / All / Pending tabs

---

## 18. Cross-Service Integration

| Service | Integration | Mechanism |
|---------|-------------|-----------|
| Auth Service | Employee provisioning, org invites | HTTP: `POST /auth/organizations/{orgId}/invite` |
| Auth Service | User creation (no org) | HTTP: `POST /auth/send-otp` |
| Project Service | Client-project linking, dashboard | HTTP: `GET /projects/{id}` |
| SMTP | Invitation emails, invoice delivery | Nodemailer (Mailhog in dev) |

---

## 19. Pagination & Querying

### 19.1 Standard Parameters

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `page` | number | 1 | — |
| `limit` | number | 20 | 100 |
| `sort` | string | — | Prefix `-` for descending |

### 19.2 Response Format

```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## 20. Error Handling

### 20.1 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (creation) |
| 400 | Validation errors |
| 401 | Missing/invalid JWT |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/code, business rule violation) |

### 20.2 Business Rule Exceptions

| Rule | Error |
|------|-------|
| Delete department with employees | 409 Conflict |
| Edit non-draft/sent invoice | 400 Bad Request |
| Delete non-draft invoice | 400 Bad Request |
| Mark cancelled invoice as paid | 400 Bad Request |
| Duplicate employee email in org | 409 Conflict |
| Duplicate department code in org | 409 Conflict |
| Duplicate client company name in org | 409 Conflict |

---

## 21. Environment Configuration

### 21.1 Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key |

### 21.2 Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `HR_SERVICE_PORT` | `3010` | Service port |
| `MONGODB_URI` | `mongodb://localhost:27017/nexora_hr` | Database connection |
| `AUTH_SERVICE_URL` | `http://auth-service:3001` | Auth service for provisioning |
| `PROJECT_SERVICE_URL` | `http://project-service:3020` | Project service for CRM |
| `SMTP_HOST` | `mailhog` | SMTP server |
| `SMTP_PORT` | `1025` | SMTP port |
| `FRONTEND_URL` | — | Frontend URL for invite links |

---

## 22. Soft Delete Pattern

All entities implement soft delete:

| Field | Type | Behavior |
|-------|------|----------|
| `isDeleted` | boolean | Marks as deleted (default: false) |
| `deletedAt` | Date | Deletion timestamp |
| `isActive` | boolean | Active flag (employees only) |

- All queries filter `isDeleted: false` by default
- Client queries support `showDeleted` flag
- Preserves referential integrity and audit trail

---

## 23. Known Constraints & Future Considerations

| Area | Current State | Consideration |
|------|---------------|---------------|
| Payroll processing | Configuration only | Full payslip generation, tax calculation engine |
| Attendance methods | Manual check-in only | Biometric, GPS geo-fence, IP-based validation |
| Leave accrual | Policy-configured | Automated monthly accrual cron job |
| Shift management | Single shift (work hours) | Multiple shifts, rotational scheduling |
| Document management | Schema defined, not UI | Document upload, verification workflow |
| Employee self-service | Basic profile view | Payslips, tax declarations, reimbursements |
| Reporting | Stats endpoints only | Comprehensive HR analytics dashboard |
| Onboarding checklist | Not implemented | New joiner task list, document collection |
| Exit management | Status tracking only | Full exit workflow, clearance, FnF settlement |
| Audit trail | Auth service handles | HR-specific audit logging |
| Asset management | Schema not present | Laptop/equipment assignment tracking |
| Expense management | Not implemented | Expense claims, approval workflow |

---

*Generated by Krillin — Nexora Documentation Agent*
*Last verified against codebase: 2026-04-06*
