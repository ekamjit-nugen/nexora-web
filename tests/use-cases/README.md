# Nexora Test Use Cases

## Module Coverage Map

### 1. Auth & Organization (auth-service)
- UC-AUTH-01: New user signup via OTP (email → OTP → profile → org → team → dashboard)
- UC-AUTH-02: Existing user login via OTP (email → OTP → org select → dashboard)
- UC-AUTH-03: Invited user login (should skip profile/org setup, go to dashboard)
- UC-AUTH-04: Token refresh preserves organizationId
- UC-AUTH-05: Org creation seeds default roles
- UC-AUTH-06: Duplicate org name rejected
- UC-AUTH-07: Invite non-existent user (creates active account with names)
- UC-AUTH-08: Invite existing user (creates membership)
- UC-AUTH-09: Claim pending invitations on profile completion
- UC-AUTH-10: Switch organization returns new tokens
- UC-AUTH-11: Update profile (name, avatar, phone)
- UC-AUTH-12: Change password
- UC-AUTH-13: MFA setup and disable
- UC-AUTH-14: User preferences (save/load theme)
- UC-AUTH-15: Org member management (update role, remove)
- UC-AUTH-16: Delete organization (soft delete)
- UC-AUTH-17: Account lockout after 5 failed attempts
- UC-AUTH-18: OTP expiry (10 minutes)
- UC-AUTH-19: Role CRUD (org-scoped)
- UC-AUTH-20: Multi-org user sees all orgs on login

### 2. HR & Directory (hr-service)
- UC-HR-01: Create employee with org context
- UC-HR-02: List employees filtered by org
- UC-HR-03: Employee not visible across orgs (data isolation)
- UC-HR-04: Update employee details
- UC-HR-05: Soft delete employee
- UC-HR-06: Create department with org context
- UC-HR-07: Delete department blocked if has employees
- UC-HR-08: Create designation
- UC-HR-09: Create team linked to department
- UC-HR-10: Employee search (name, email, skills)
- UC-HR-11: Employee stats (total, active, on_notice)
- UC-HR-12: Org chart generation
- UC-HR-13: Auto-generate employee ID (NXR-XXXX)
- UC-HR-14: Client CRUD with org isolation
- UC-HR-15: Duplicate email rejected within same org

### 3. Attendance (attendance-service)
- UC-ATT-01: Clock in records attendance
- UC-ATT-02: Clock out calculates working hours
- UC-ATT-03: Cannot clock in twice without clock out
- UC-ATT-04: Admin/super_admin cannot clock in
- UC-ATT-05: Manual entry requires approval
- UC-ATT-06: Approve/reject manual entry
- UC-ATT-07: Today status shows all sessions
- UC-ATT-08: Attendance stats by date range
- UC-ATT-09: Shift CRUD with org isolation
- UC-ATT-10: Policy CRUD (work_timing, leave, wfh)
- UC-ATT-11: Policy compliance check (late arrival alert)
- UC-ATT-12: Create policy from template
- UC-ATT-13: Alerts generated on policy violation
- UC-ATT-14: Acknowledge alert

### 4. Leave (leave-service)
- UC-LV-01: Apply leave with date validation
- UC-LV-02: Overlapping leave rejected
- UC-LV-03: Insufficient balance rejected
- UC-LV-04: Approve leave deducts balance
- UC-LV-05: Reject leave with reason
- UC-LV-06: Cancel approved leave restores balance
- UC-LV-07: Cannot cancel rejected leave
- UC-LV-08: Auto-initialize leave balance from policy
- UC-LV-09: Leave balance defaults without policy
- UC-LV-10: Team calendar shows approved leaves
- UC-LV-11: Leave stats aggregation
- UC-LV-12: Leave policy CRUD with org isolation
- UC-LV-13: Half-day leave (0.5 days)
- UC-LV-14: LOP leave skips balance check

### 5. Projects (project-service)
- UC-PRJ-01: Create project with org context
- UC-PRJ-02: List projects filtered by org
- UC-PRJ-03: Add/remove team members
- UC-PRJ-04: Add/update milestones
- UC-PRJ-05: Health score calculation
- UC-PRJ-06: Budget tracking
- UC-PRJ-07: Risk management (add, update, remove)
- UC-PRJ-08: Activity log (max 50 entries)
- UC-PRJ-09: Duplicate project
- UC-PRJ-10: Archive project
- UC-PRJ-11: Project dashboard aggregation
- UC-PRJ-12: My projects filter by team membership

### 6. Tasks & Timesheets (task-service)
- UC-TSK-01: Create task linked to project
- UC-TSK-02: Update task status
- UC-TSK-03: Add comments to task
- UC-TSK-04: Log time on task
- UC-TSK-05: Task stats by project
- UC-TSK-06: My tasks filter
- UC-TSK-07: Create timesheet (auto-populate from attendance + tasks)
- UC-TSK-08: Submit timesheet for review
- UC-TSK-09: Approve/reject timesheet
- UC-TSK-10: Expected hours from policy
- UC-TSK-11: Cannot edit submitted timesheet
- UC-TSK-12: Delete only draft timesheets

### 7. Multi-Tenancy (cross-service)
- UC-MT-01: Employees from Org A invisible to Org B
- UC-MT-02: Projects from Org A invisible to Org B
- UC-MT-03: Roles scoped per org (same name, different orgs)
- UC-MT-04: Policies scoped per org
- UC-MT-05: Leave balance scoped per org
- UC-MT-06: API Gateway forwards X-Organization-Id header

### 8. Business Logic Validation
- UC-BIZ-01: Onboarding creates policies automatically
- UC-BIZ-02: Onboarding creates departments & designations
- UC-BIZ-03: Invited users are fully provisioned (active + named)
- UC-BIZ-04: Logged-in user not visible in own directory
- UC-BIZ-05: Settings/preferences per-user (not shared via localStorage)
- UC-BIZ-06: Theme resets to default on logout
- UC-BIZ-07: Org admin can manage members (change role, remove)
- UC-BIZ-08: Employee count includes only current org
