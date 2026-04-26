# Nexora Authentication — QA Test Cases for Browser Extension Testing

**Date:** 2026-04-14
**Target:** Nexora Web App (http://localhost:3000 or http://192.168.29.218:3100)
**API Gateway:** http://localhost:3005
**Mail:** http://localhost:8025 (MailHog)
**Prepared by:** Vegeta (QA Sentinel)

> **IMPORTANT:** All user data has been wiped clean. Start testing from a completely fresh state.

---

## Prerequisites

- Nexora running (all Docker services up)
- MailHog accessible at port 8025 for invite emails
- Database is clean (no existing users or orgs)
- Browser with developer tools available
- Use incognito/private windows for testing different users simultaneously

---

## TEST SUITE 1: First User — Organization Owner Setup

> There is NO separate registration page. All users start from `/login`. The system detects new vs existing users automatically after OTP verification.

### TC-1.1: First user onboarding (Org Owner — Rajesh Kumar)

**Steps:**
1. Open `/login` page in Browser A
2. Enter email: `rajesh.kumar@nexora.test`
3. Click "Continue" — OTP is sent
4. Open MailHog (http://localhost:8025) — copy the 6-digit OTP
5. Enter the OTP on the verify page
6. System detects `isNewUser: true` → shows welcome/profile form
7. Complete profile:
   - First Name: `Rajesh`
   - Last Name: `Kumar`
8. Create Organization:
   - Name: `TechNova Solutions`
   - Industry: `IT Services`
   - Size: `51-200`
9. Verify redirect to dashboard

**Expected:**
- OTP email received in MailHog within 5 seconds
- After OTP, profile form appears (NOT org selection since no orgs exist)
- After org creation, lands on dashboard
- Sidebar shows "TechNova Solutions" in org switcher
- Rajesh's role = "owner"
- Dashboard shows 1 Team Member

**Verify:**
- [ ] OTP email received
- [ ] Profile form shown after OTP
- [ ] Org created successfully
- [ ] Dashboard loads
- [ ] Org name in sidebar matches

---

## TEST SUITE 2: Add Team Members — Multiple Departments

### TC-2.1: Create departments first

**Precondition:** Logged in as Rajesh (owner of TechNova Solutions)

**Steps:**
1. Go to Departments (sidebar → PEOPLE → Departments)
2. Create these departments:
   - **Engineering** — "Core development team"
   - **Design** — "UI/UX design team"
   - **Human Resources** — "People operations"
   - **Finance** — "Financial operations"
   - **QA** — "Quality assurance team"

**Expected:**
- 5 departments created
- Each shows in the departments list

**Verify:**
- [ ] All 5 departments created
- [ ] Each has correct name

---

### TC-2.2: Create designations

**Steps:**
1. Go to Settings → Organization (or wherever designations are managed)
2. Verify designations exist or create:
   - Software Engineer (Level 3, IC)
   - Senior Software Engineer (Level 4, IC)
   - Tech Lead (Level 5, Management)
   - UI/UX Designer (Level 3, IC)
   - HR Manager (Level 5, Management)
   - Finance Executive (Level 3, IC)
   - QA Engineer (Level 3, IC)

**Expected:**
- Designations available for employee creation

---

### TC-2.3: Add Engineering team members

**Precondition:** Logged in as Rajesh (owner)

**Steps:**
1. Go to Directory (sidebar → PEOPLE → Directory)
2. Click "Add Employee"
3. Add **Employee 1:**
   - First Name: `Priya`
   - Last Name: `Sharma`
   - Email: `priya.sharma@nexora.test`
   - Department: Engineering
   - Designation: Senior Software Engineer
   - Employment Type: Full-time
   - Joining Date: Today
4. Click "Create Employee"
5. Verify invite email sent — check MailHog
6. Verify Directory shows Priya with "Invited" status

7. Repeat for **Employee 2:**
   - First Name: `Amit`
   - Last Name: `Patel`
   - Email: `amit.patel@nexora.test`
   - Department: Engineering
   - Designation: Software Engineer

8. Repeat for **Employee 3:**
   - First Name: `Neha`
   - Last Name: `Gupta`
   - Email: `neha.gupta@nexora.test`
   - Department: Engineering
   - Designation: Tech Lead

**Expected:**
- Each employee created with status "Invited"
- Each receives an invite email in MailHog
- Directory shows all 3 engineering members + Rajesh = 4 total
- Each assigned to "Engineering" department

**Verify:**
- [ ] Priya created, invite email received
- [ ] Amit created, invite email received
- [ ] Neha created, invite email received
- [ ] All 3 show "Invited" in Directory
- [ ] All 3 in Engineering department

---

### TC-2.4: Add Design team members

**Steps:**
1. Add **Employee 4:**
   - First Name: `Sanya`
   - Last Name: `Reddy`
   - Email: `sanya.reddy@nexora.test`
   - Department: Design
   - Designation: UI/UX Designer

2. Add **Employee 5:**
   - First Name: `Vikram`
   - Last Name: `Joshi`
   - Email: `vikram.joshi@nexora.test`
   - Department: Design
   - Designation: UI/UX Designer

**Expected:**
- Both created with "Invited" status in Design department
- Both receive invite emails

**Verify:**
- [ ] Sanya created, email received
- [ ] Vikram created, email received
- [ ] Both in Design department

---

### TC-2.5: Add HR, Finance, and QA members

**Steps:**
1. Add **Employee 6 (HR):**
   - First Name: `Meera`
   - Last Name: `Nair`
   - Email: `meera.nair@nexora.test`
   - Department: Human Resources
   - Designation: HR Manager

2. Add **Employee 7 (Finance):**
   - First Name: `Arjun`
   - Last Name: `Singh`
   - Email: `arjun.singh@nexora.test`
   - Department: Finance
   - Designation: Finance Executive

3. Add **Employee 8 (QA):**
   - First Name: `Deepa`
   - Last Name: `Verma`
   - Email: `deepa.verma@nexora.test`
   - Department: QA
   - Designation: QA Engineer

**Expected:**
- All 3 created with "Invited" status
- Total in Directory: 9 (Rajesh + 8 invited members)
- Each in correct department

**Verify:**
- [ ] Meera (HR) created and email sent
- [ ] Arjun (Finance) created and email sent
- [ ] Deepa (QA) created and email sent
- [ ] Directory total = 9
- [ ] Department filter works correctly

---

### TC-2.6: Verify Directory counts and filters

**Steps:**
1. On Directory page, check total employee count card
2. Filter by Department = "Engineering" → should show 3 members
3. Filter by Department = "Design" → should show 2 members
4. Filter by Department = "Human Resources" → should show 1 member
5. Filter by Department = "Finance" → should show 1 member
6. Filter by Department = "QA" → should show 1 member
7. Clear filter → should show all 9

**Expected:**
- Count matches: 3 + 2 + 1 + 1 + 1 + 1 (Rajesh, unassigned or owner dept) = 9
- Status badge "Invited" on all 8 added members
- Status "Active" on Rajesh only

**Verify:**
- [ ] Total count = 9
- [ ] Department filter works
- [ ] Status badges correct

---

## TEST SUITE 3: Accept Invitation — Each Member Signs In

### TC-3.1: Priya Sharma accepts invitation (Engineering)

**Steps:**
1. Open a NEW incognito/private browser window (Browser B)
2. Go to MailHog → find invite email for `priya.sharma@nexora.test`
3. Click "Accept & Join" button in the email — note the invite link URL
4. OR: Go to `/login` and enter `priya.sharma@nexora.test`
5. OTP is sent — check MailHog for the OTP (separate from invite email)
6. Enter OTP
7. If new user: complete profile (First Name: Priya, Last Name: Sharma)
8. Set password (if prompted): `Priya@2026!`
9. Accept the organization invite
10. Verify Priya lands on TechNova Solutions dashboard

**Expected:**
- Priya can log in via OTP
- After accepting invite, she's in "TechNova Solutions"
- Her role = "employee" (or whatever was set)
- Directory now shows her as "Active"
- She can see Dashboard, My Work, Team Chat, Attendance, Leaves, My Payslips

**Verify:**
- [ ] OTP received and verified
- [ ] Profile completed
- [ ] Invite accepted
- [ ] Dashboard shows TechNova Solutions
- [ ] Status in Directory changed to "Active"

---

### TC-3.2: Amit Patel accepts invitation (Engineering)

**Steps:**
1. New incognito window (Browser C)
2. Go to `/login`, enter `amit.patel@nexora.test`
3. Send OTP → check MailHog → enter OTP
4. Complete profile: First Name: Amit, Last Name: Patel
5. Accept invite to TechNova Solutions

**Expected:**
- Amit logged in and in TechNova Solutions
- Status changed to "Active" in Directory

**Verify:**
- [ ] Login successful
- [ ] Invite accepted
- [ ] Active in Directory

---

### TC-3.3: Neha Gupta accepts invitation (Engineering — Tech Lead)

**Steps:**
1. New incognito window
2. Login as `neha.gupta@nexora.test` via OTP
3. Complete profile, accept invite

**Expected:**
- Neha in TechNova Solutions as Tech Lead
- Active in Directory

**Verify:**
- [ ] Login and invite acceptance successful

---

### TC-3.4: Meera Nair accepts invitation (HR Manager)

**Steps:**
1. New incognito window
2. Login as `meera.nair@nexora.test` via OTP
3. Complete profile, accept invite

**After acceptance, as Rajesh (admin):**
4. Go back to Browser A (Rajesh)
5. Go to Settings → Members
6. Change Meera's role from "employee" to "hr"
7. Meera logs out and logs back in

**Expected (after role change):**
- Meera can see HR-specific sidebar items: Onboarding, Offboarding, Recruitment
- Meera can see Payroll Runs, Statutory Reports
- Meera can view/manage employee records

**Verify:**
- [ ] Meera accepted invite
- [ ] Role changed to "hr"
- [ ] After re-login, HR sidebar items visible

---

### TC-3.5: Sanya, Vikram, Arjun, Deepa accept invitations

**Steps:**
1. For each remaining member, in a new incognito window:
   - `sanya.reddy@nexora.test` → Login, OTP, profile, accept
   - `vikram.joshi@nexora.test` → Login, OTP, profile, accept
   - `arjun.singh@nexora.test` → Login, OTP, profile, accept
   - `deepa.verma@nexora.test` → Login, OTP, profile, accept

**Expected:**
- All 4 successfully log in and join TechNova Solutions
- All show "Active" in Directory

**Verify:**
- [ ] Sanya accepted — Active
- [ ] Vikram accepted — Active
- [ ] Arjun accepted — Active
- [ ] Deepa accepted — Active
- [ ] Directory now shows 9 members, ALL Active

---

### TC-3.6: Final Directory verification — all members active

**Steps:**
1. Log in as Rajesh (owner)
2. Go to Directory
3. Verify:
   - Total: 9 members
   - All status: "Active"
   - Engineering: Priya, Amit, Neha (3)
   - Design: Sanya, Vikram (2)
   - HR: Meera (1)
   - Finance: Arjun (1)
   - QA: Deepa (1)
   - Owner/Unassigned: Rajesh (1)

**Verify:**
- [ ] All 9 members Active
- [ ] Department counts correct
- [ ] No "Invited" status remaining

---

## TEST SUITE 4: Second Organization — Complete Isolation

### TC-4.1: Create second organization (GlobalEdge Corp)

**Steps:**
1. Open a completely new browser/incognito window
2. Go to `/login`
3. Enter NEW email: `ananya.das@nexora.test`
4. Complete OTP verification
5. Complete profile: First Name: Ananya, Last Name: Das
6. Create organization:
   - Name: `GlobalEdge Corp`
   - Industry: `Consulting`
   - Size: `11-50`
7. Verify dashboard loads with "GlobalEdge Corp"

**Expected:**
- New org "GlobalEdge Corp" created
- Ananya is owner
- Completely separate from TechNova Solutions

**Verify:**
- [ ] Org created
- [ ] Dashboard shows GlobalEdge Corp
- [ ] No TechNova data visible

---

### TC-4.2: Add members to GlobalEdge Corp

**Precondition:** Logged in as Ananya (owner of GlobalEdge Corp)

**Steps:**
1. Create departments: "Consulting", "Operations"
2. Add employees:
   - `ravi.mehta@nexora.test` — Consulting department
   - `pooja.kapoor@nexora.test` — Operations department
   - `karan.shah@nexora.test` — Consulting department
3. Verify all 3 receive invite emails
4. Each accepts invitation (repeat TC-3.x flow)

**Expected:**
- GlobalEdge Corp has 4 members (Ananya + 3)
- All Active after acceptance

**Verify:**
- [ ] 3 members invited and emails sent
- [ ] All 3 accepted invitations
- [ ] Directory shows 4 members

---

### TC-4.3: Cross-org isolation verification

**Steps:**
1. Log in as `ravi.mehta@nexora.test` (GlobalEdge member)
2. Go to Directory → should see ONLY GlobalEdge members (4 people)
3. Should NOT see Rajesh, Priya, Amit, or any TechNova member
4. Check API in DevTools: responses should have GlobalEdge org ID only

5. Log in as `priya.sharma@nexora.test` (TechNova member)
6. Go to Directory → should see ONLY TechNova members (9 people)
7. Should NOT see Ananya, Ravi, Pooja, or any GlobalEdge member

**Expected:**
- ZERO overlap between org directories
- API responses scoped to correct org

**Verify:**
- [ ] GlobalEdge user sees only GlobalEdge data
- [ ] TechNova user sees only TechNova data
- [ ] No cross-org data leakage

---

### TC-4.4: Cross-org API attack test

**Steps:**
1. Log in as `ravi.mehta@nexora.test` (GlobalEdge)
2. Open DevTools → Network tab
3. Copy the `organizationId` from any API response (this is GlobalEdge's org ID)
4. Now find TechNova's org ID (from Rajesh's session or MailHog invite links)
5. Try calling API with TechNova's org ID:
   ```
   GET /api/v1/employees?organizationId=<technova-org-id>
   ```
6. Should return empty or 403

**Expected:**
- Cannot access another org's data by tampering with org ID
- JWT token's org context is enforced server-side

**Verify:**
- [ ] Cross-org API call blocked

---

## TEST SUITE 5: Multi-Org User

### TC-5.1: Invite TechNova member to GlobalEdge

**Steps:**
1. Log in as Ananya (GlobalEdge owner)
2. Add employee: `priya.sharma@nexora.test` (already exists in TechNova)
3. Priya receives invite email

4. Log in as Priya
5. Accept GlobalEdge invitation

**Expected:**
- Priya is now in BOTH orgs
- On next login, shows org selection: "TechNova Solutions" and "GlobalEdge Corp"
- Can switch between them via sidebar org switcher

**Verify:**
- [ ] Priya invited to GlobalEdge
- [ ] Priya accepted
- [ ] Org selection shown on login
- [ ] Can switch between orgs

---

### TC-5.2: Multi-org data isolation for same user

**Steps:**
1. As Priya, switch to TechNova Solutions
2. Note Dashboard data, Directory (9 members), projects
3. Switch to GlobalEdge Corp via org switcher
4. Dashboard data should change completely
5. Directory should show GlobalEdge members (now 5 with Priya)
6. TechNova projects not visible

**Expected:**
- Complete data switch on org change
- JWT refreshed with new org context
- Sidebar reflects current org

**Verify:**
- [ ] Data changes on org switch
- [ ] Directory count changes
- [ ] No TechNova data in GlobalEdge context

---

## TEST SUITE 6: Role-Based Access — TechNova Solutions

### TC-6.1: Set up roles

**Precondition:** Logged in as Rajesh (TechNova owner)

**Steps:**
1. Go to Settings → Members
2. Change roles:
   - Neha Gupta → "manager" (she's Tech Lead)
   - Meera Nair → "hr" (she's HR Manager)
   - Keep others as "employee"

**Verify:**
- [ ] Neha's role = manager
- [ ] Meera's role = hr
- [ ] Others remain employee

---

### TC-6.2: Verify Owner (Rajesh) — full access

**Steps:**
1. As Rajesh, verify ALL sidebar sections visible:
   - MAIN: Dashboard, My Work, Manager, Calendar ✓
   - COMMUNICATION: All items ✓
   - WORK: All items including Profitability, Bench, Reports, Templates ✓
   - PAYROLL & HR: All items ✓
   - PERFORMANCE: All items including OKR Alignment, Review Cycles ✓
   - ADMIN: Roles, Policies, Custom Fields, Automations ✓
2. Can access Settings → Members, change roles
3. Can access Settings → Organization

**Verify:**
- [ ] All sidebar sections visible
- [ ] Admin section accessible
- [ ] Can manage members and roles

---

### TC-6.3: Verify Manager (Neha) — manager access

**Steps:**
1. Log in as `neha.gupta@nexora.test`
2. Check sidebar:
   - Should see: Manager Dashboard, Profitability, Bench, Reports, Templates, Roadmap
   - Should see: Chat Analytics, All Tickets (helpdesk), Helpdesk Dashboard
   - Should see: Statutory Reports, Review Cycles, OKR Alignment
   - Should NOT see: ADMIN section (Roles, Policies, Custom Fields, Automations)
3. Try navigating to `/roles` directly → should redirect or show access denied

**Verify:**
- [ ] Manager items visible
- [ ] Admin section NOT visible
- [ ] Cannot access admin routes

---

### TC-6.4: Verify HR (Meera) — HR-specific access

**Steps:**
1. Log in as `meera.nair@nexora.test`
2. Check sidebar:
   - Should see: Onboarding, Offboarding, Recruitment
   - Should see: Payroll Runs, Statutory Reports, Analytics
   - Should be able to add employees in Directory
   - Should NOT see: ADMIN section

**Verify:**
- [ ] HR-specific items visible
- [ ] Can add employees
- [ ] Admin section NOT visible

---

### TC-6.5: Verify Employee (Amit) — basic access

**Steps:**
1. Log in as `amit.patel@nexora.test`
2. Check sidebar — should see ONLY:
   - Dashboard, My Work, Calendar
   - Team Chat, Calls, Meetings, Standups, Announcements
   - Tasks, Timesheets (basic work items)
   - Attendance, Leaves
   - My Payslips, Salary Structure, Declarations, Expenses, Loans
   - Goals & OKRs, Reviews, Kudos, Surveys, Learning
   - My Tickets (helpdesk)
   - My Assets, All Assets
   - Wiki, Bookmarks, Search
   - Directory, Org Chart
3. Should NOT see:
   - Manager, Profitability, Bench, Roadmap, Reports, Templates
   - Payroll Runs, Statutory Reports, Onboarding, Offboarding, Recruitment, Analytics
   - OKR Alignment, Review Cycles
   - All Tickets, Helpdesk Teams, Helpdesk Dashboard
   - Asset Categories, Asset Dashboard
   - Chat Analytics
   - ADMIN section
   - FINANCE section (Clients, Invoices, Finance Reports)

**Verify:**
- [ ] Only employee-level items visible
- [ ] No manager/admin items
- [ ] Cannot access restricted URLs directly

---

## TEST SUITE 7: Session & Security

### TC-7.1: Concurrent sessions

**Steps:**
1. Log in as Rajesh in Browser A (Chrome)
2. Log in as Rajesh in Browser B (Firefox/Incognito)
3. Both sessions should work simultaneously
4. From Browser A, if session management exists: revoke Browser B's session
5. Browser B should get logged out on next API call

**Verify:**
- [ ] Both sessions work
- [ ] Revocation works (if feature available)

---

### TC-7.2: Logout clears all state

**Steps:**
1. Log in as any user
2. Note localStorage contents (DevTools → Application → Local Storage)
3. Click Logout
4. Verify: accessToken, refreshToken, currentOrgId all cleared
5. Navigate to `/dashboard` → should redirect to `/login`
6. Press browser Back button → should NOT return to authenticated page

**Verify:**
- [ ] All tokens cleared
- [ ] Redirect to login
- [ ] Back button doesn't expose auth pages

---

### TC-7.3: OTP lockout

**Steps:**
1. Go to `/login`, enter any email, send OTP
2. Enter wrong OTP 10 times consecutively
3. On 11th attempt with correct OTP

**Expected:**
- Error: "Account locked" after 10 failures
- Even correct OTP fails during 15-minute lockout
- After 15 minutes: correct OTP works again

**Verify:**
- [ ] Lockout triggers after 10 failures
- [ ] Correct OTP rejected during lockout
- [ ] Unlocks after 15 minutes

---

### TC-7.4: `/register` redirects to `/login`

**Steps:**
1. Navigate directly to `/register`

**Expected:**
- Immediately redirected to `/login`
- No registration form shown

**Verify:**
- [ ] Redirect happens
- [ ] URL changes to /login

---

## TEST SUITE 8: Edge Cases

### TC-8.1: Invite same email twice

**Steps:**
1. As Rajesh, try adding `priya.sharma@nexora.test` again (already exists)

**Expected:**
- Error: "Employee with this email already exists"
- No duplicate created

**Verify:**
- [ ] Duplicate prevented

---

### TC-8.2: User logs in who was never invited

**Steps:**
1. New incognito window
2. Go to `/login`, enter `random.person@nexora.test`
3. Send OTP, verify OTP
4. Complete profile

**Expected:**
- User created but has NO org
- Shown org creation flow (create new org)
- Should NOT see any existing org's data

**Verify:**
- [ ] No error during login
- [ ] No access to existing orgs
- [ ] Org creation flow shown

---

### TC-8.3: Admin removes a member

**Steps:**
1. As Rajesh (owner), go to Settings → Members
2. Remove `deepa.verma@nexora.test` from TechNova
3. Log in as Deepa in incognito

**Expected:**
- Deepa's membership revoked
- Deepa cannot access TechNova data
- If Deepa has no other orgs, shown org creation flow
- Directory count drops to 8

**Verify:**
- [ ] Member removed
- [ ] Deepa can't access TechNova
- [ ] Directory updated

---

## Full Member Reference

### TechNova Solutions (Org 1)

| # | Name | Email | Department | Designation | Role |
|---|------|-------|------------|-------------|------|
| 1 | Rajesh Kumar | rajesh.kumar@nexora.test | — | — | owner |
| 2 | Priya Sharma | priya.sharma@nexora.test | Engineering | Senior Software Engineer | employee |
| 3 | Amit Patel | amit.patel@nexora.test | Engineering | Software Engineer | employee |
| 4 | Neha Gupta | neha.gupta@nexora.test | Engineering | Tech Lead | manager |
| 5 | Sanya Reddy | sanya.reddy@nexora.test | Design | UI/UX Designer | employee |
| 6 | Vikram Joshi | vikram.joshi@nexora.test | Design | UI/UX Designer | employee |
| 7 | Meera Nair | meera.nair@nexora.test | Human Resources | HR Manager | hr |
| 8 | Arjun Singh | arjun.singh@nexora.test | Finance | Finance Executive | employee |
| 9 | Deepa Verma | deepa.verma@nexora.test | QA | QA Engineer | employee |

### GlobalEdge Corp (Org 2)

| # | Name | Email | Department | Role |
|---|------|-------|------------|------|
| 1 | Ananya Das | ananya.das@nexora.test | — | owner |
| 2 | Ravi Mehta | ravi.mehta@nexora.test | Consulting | employee |
| 3 | Pooja Kapoor | pooja.kapoor@nexora.test | Operations | employee |
| 4 | Karan Shah | karan.shah@nexora.test | Consulting | employee |
| 5 | Priya Sharma | priya.sharma@nexora.test | — | employee (multi-org) |

---

## Quick Checklist for Each Test Run

- [ ] Clear localStorage before testing (DevTools → Application → Clear)
- [ ] Open MailHog in separate tab (http://localhost:8025)
- [ ] Have DevTools Network tab open to monitor API calls
- [ ] Use incognito windows for different users
- [ ] Check console for JavaScript errors after each action
- [ ] Screenshot evidence for each major step

## Execution Order

1. **TC-1.1** → Create Rajesh + TechNova Solutions
2. **TC-2.1 to TC-2.6** → Add all 8 team members
3. **TC-3.1 to TC-3.6** → Each member accepts invitation
4. **TC-4.1 to TC-4.4** → Create GlobalEdge Corp, add members, verify isolation
5. **TC-5.1 to TC-5.2** → Multi-org user (Priya in both orgs)
6. **TC-6.1 to TC-6.5** → Role assignments and verification
7. **TC-7.1 to TC-7.4** → Session and security tests
8. **TC-8.1 to TC-8.3** → Edge cases
