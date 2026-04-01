# Authentication Flow - Quick Checklist

Use this checklist to quickly verify all authentication flow components.

## Test Execution Date: _____________
## Tester Name: _____________

---

## Phase 1: Initial Setup

- [ ] Backend auth-service running on port 3001
- [ ] MongoDB instance accessible
- [ ] Frontend running on port 3000
- [ ] MailHog running on port 8025 for email testing
- [ ] Redis running for sessions (port 6379)

---

## Phase 2: Email Entry & OTP

- [ ] Navigate to login page successfully
- [ ] Email input field displays
- [ ] Continue/Send OTP button is disabled initially
- [ ] Enter valid email format (e.g., `test@company.com`)
- [ ] Continue button becomes enabled
- [ ] Click send OTP
- [ ] Success message appears: "OTP sent to your email"
- [ ] Check MailHog for OTP email received
- [ ] OTP email contains correct email address
- [ ] OTP email contains 6-digit code
- [ ] Navigate to OTP verification screen
- [ ] OTP input fields display (6 fields)

---

## Phase 3: OTP Verification

- [ ] Extract OTP from MailHog email
- [ ] Enter OTP in 6 input fields
- [ ] Auto-focus works between fields
- [ ] Verify button enables when all 6 digits entered
- [ ] Click Verify OTP
- [ ] OTP validation succeeds
- [ ] Redirect to organization setup (new user path)

---

## Phase 4: Organization Creation

- [ ] Organization setup form displays
- [ ] All required fields visible:
  - [ ] Organization Name field
  - [ ] Organization Type dropdown
  - [ ] Organization Size dropdown
  - [ ] Country dropdown
  - [ ] Timezone field
- [ ] Fill Organization Name: `Test Org 2026`
- [ ] Select Organization Type: `Product Company`
- [ ] Select Organization Size: `11-50`
- [ ] Select Country: `United States`
- [ ] Timezone auto-populated (verify correct)
- [ ] Click "Create Organization"
- [ ] Success message appears
- [ ] Organization created in database
- [ ] Verify organization details in MongoDB:
  ```
  - name: "Test Org 2026"
  - type: "Product Company"
  - size: "11-50"
  - country: "United States"
  - owner: [userId]
  ```

---

## Phase 5: Admin Details Setup

- [ ] First Name field displays
- [ ] Last Name field displays
- [ ] First Name: `Alex`
- [ ] Last Name: `Admin`
- [ ] Click Continue/Submit
- [ ] Admin record updated in database

---

## Phase 6: Team Member Invitation

- [ ] Team member invitation form displays
- [ ] Email field for team member
- [ ] First Name field
- [ ] Last Name field
- [ ] Role dropdown with default roles
- [ ] Invite Member button

### Member 1: John Manager
- [ ] Email: `john.manager@company.com`
- [ ] First Name: `John`
- [ ] Last Name: `Manager`
- [ ] Role: `Manager`
- [ ] Click "Invite Member" / "Add"
- [ ] Member appears in invitation list
- [ ] Status shows as "Invited" or "Pending"
- [ ] Invite email sent to MailHog
- [ ] Email contains invite link
- [ ] Email contains organization name: `Test Org 2026`

### Member 2: Sarah Developer
- [ ] Email: `sarah.developer@company.com`
- [ ] First Name: `Sarah`
- [ ] Last Name: `Developer`
- [ ] Role: `Developer`
- [ ] Click "Invite Member"
- [ ] Member appears in list
- [ ] Invite email received

### Member 3: Emily HR
- [ ] Email: `emily.hr@company.com`
- [ ] First Name: `Emily`
- [ ] Last Name: `HR`
- [ ] Role: `HR`
- [ ] Click "Invite Member"
- [ ] Member appears in list
- [ ] Invite email received

### Member 4: Mike Designer
- [ ] Email: `mike.designer@company.com`
- [ ] First Name: `Mike`
- [ ] Last Name: `Designer`
- [ ] Role: `Designer`
- [ ] Click "Invite Member"
- [ ] Member appears in list
- [ ] Invite email received

### Review Invitations
- [ ] All 4 members appear in invitation list
- [ ] Each shows correct email, name, and role
- [ ] Option to remove individual members
- [ ] Option to resend invitations

---

## Phase 7: Complete Setup & Dashboard Access

- [ ] Click "Continue to Dashboard" or "Finish Setup"
- [ ] Redirect to dashboard/home page
- [ ] Welcome message appears
- [ ] Organization name displays in header/sidebar: `Test Org 2026`
- [ ] User profile accessible
- [ ] Directory/Members option visible in navigation

---

## Phase 8: Admin Verification in Directory

- [ ] Click on "Directory" / "Team" / "Members" in navigation
- [ ] Member list page loads
- [ ] Table shows all organization members:
  - [ ] Alex Admin (Admin) - Status: Active
  - [ ] John Manager (Manager) - Status: Pending/Active
  - [ ] Sarah Developer (Developer) - Status: Pending/Active
  - [ ] Emily HR (HR) - Status: Pending/Active
  - [ ] Mike Designer (Designer) - Status: Pending/Active
- [ ] Total member count: 5 shown
- [ ] Each member shows:
  - [ ] Full name (First + Last)
  - [ ] Email address
  - [ ] Role
  - [ ] Status
  - [ ] Join date or invite date

---

## Phase 9: Database Verification

### Users Collection (nexora_auth.users)
- [ ] Admin user record exists:
  ```
  email: test@company.com
  firstName: Alex
  lastName: Admin
  isActive: true
  organizations: [orgId]
  ```
- [ ] John Manager record exists:
  ```
  email: john.manager@company.com
  firstName: John
  lastName: Manager
  isActive: true
  organizations: [orgId]
  ```
- [ ] Sarah Developer record exists
- [ ] Emily HR record exists
- [ ] Mike Designer record exists
- [ ] Total 5 user records created

### Organizations Collection (nexora_auth.organizations)
- [ ] Organization record exists:
  ```
  name: Test Org 2026
  type: Product Company
  size: 11-50
  country: United States
  timezone: America/New_York (or detected)
  owner: [adminUserId]
  createdAt: [timestamp]
  ```

### Organization Memberships Collection (nexora_auth.orgmemberships)
- [ ] Admin membership record:
  ```
  userId: [adminUserId]
  organizationId: [orgId]
  role: admin
  status: active
  joinedAt: [timestamp]
  ```
- [ ] John membership:
  ```
  userId: [johnUserId]
  organizationId: [orgId]
  role: manager
  status: pending | active
  invitedBy: [adminUserId]
  invitedAt: [timestamp]
  ```
- [ ] Sarah, Emily, Mike records similar to John
- [ ] Total 5 membership records

### Roles Collection (nexora_auth.roles)
- [ ] Default roles created for organization:
  - [ ] admin
  - [ ] hr
  - [ ] manager
  - [ ] developer
  - [ ] designer
  - [ ] employee
- [ ] All 6 roles linked to organization: [orgId]

---

## Phase 10: Team Member Login Flow

### John Manager Login
- [ ] Open MailHog email for john.manager@company.com
- [ ] Click invite link or go to login page
- [ ] Email field pre-filled: `john.manager@company.com` (if using invite link)
- [ ] Click "Send OTP"
- [ ] Check MailHog for OTP email
- [ ] Extract OTP from email
- [ ] Enter OTP in verification form
- [ ] Click "Verify OTP"
- [ ] **IMPORTANT**: Since John already exists in org (invited), should NOT show org setup
- [ ] Redirect to dashboard
- [ ] John's dashboard shows organization: `Test Org 2026`
- [ ] John's profile shows role: `Manager`

### Directory Visibility for John
- [ ] Click "Directory" / "Team"
- [ ] John can see all organization members:
  - [ ] Alex Admin
  - [ ] John Manager (himself)
  - [ ] Sarah Developer
  - [ ] Emily HR
  - [ ] Mike Designer
- [ ] All 5 members visible (or 4 others + self = 5 total)
- [ ] John's membership status should now be: `active`

### Sarah Developer Login (Similar to John)
- [ ] Extract OTP from MailHog for sarah.developer@company.com
- [ ] Login with OTP
- [ ] Verify in directory with role: `Developer`
- [ ] Sarah sees all 5 members

### Emily HR Login (Similar to John)
- [ ] Extract OTP from MailHog for emily.hr@company.com
- [ ] Login with OTP
- [ ] Verify in directory with role: `HR`
- [ ] Emily sees all 5 members

### Mike Designer Login (Similar to John)
- [ ] Extract OTP from MailHog for mike.designer@company.com
- [ ] Login with OTP
- [ ] Verify in directory with role: `Designer`
- [ ] Mike sees all 5 members

---

## Phase 11: Data Consistency Verification

After all team members logged in:

- [ ] All 5 users have status: `active` in organization
- [ ] All membership records show `status: active`
- [ ] All membership records have `joinedAt` timestamp
- [ ] Member order in directory is consistent
- [ ] No duplicate records in database
- [ ] No orphaned records

---

## Phase 12: Permission & Authorization Checks

### Admin User (Alex) Permissions
- [ ] Can view all members in directory
- [ ] Can click on members to see details
- [ ] Can invite new members (if option available)
- [ ] Can remove members (if option available)
- [ ] Can change member roles (if option available)

### Non-Admin User (John, Sarah, Emily, Mike) Permissions
- [ ] Can view own profile
- [ ] Can view all organization members in directory
- [ ] Cannot remove other members
- [ ] Cannot change roles (unless they have permission)
- [ ] Cannot access admin panel

### Unauthorized Access
- [ ] Try accessing `/admin` without admin role → Should be denied
- [ ] Try accessing other org directory while in another org → Should be denied
- [ ] Try accessing protected routes without login → Redirect to login

---

## Phase 13: Error Scenario Testing

### Email Validation Errors
- [ ] Enter invalid email (no @) → "Invalid email format" error
- [ ] Enter empty email → "Email is required" error
- [ ] Continue button disabled for invalid emails

### OTP Errors
- [ ] Enter wrong OTP → "Invalid OTP" error
- [ ] Allow retry
- [ ] After 5 attempts → "Too many attempts, request new OTP"
- [ ] Wait >10 min for OTP → "OTP expired" error
- [ ] Resend OTP → New code sent
- [ ] Previous OTP no longer works

### Organization Setup Errors
- [ ] Leave organization name empty → "Organization name is required"
- [ ] Submit button disabled
- [ ] Organization name < 3 chars → "Name must be at least 3 characters"

### Team Member Invitation Errors
- [ ] Invite same email twice → "Email already invited" error
- [ ] Invite admin's own email → "Cannot invite yourself" error
- [ ] Invite invalid email → "Invalid email format"
- [ ] Leave First Name empty → "First name is required"
- [ ] Leave Last Name empty → "Last name is required"
- [ ] Leave Role unselected → "Role is required"

---

## Phase 14: UI/UX Verification

- [ ] Login page responsive on mobile
- [ ] OTP input accessible on mobile
- [ ] Organization setup form responsive
- [ ] Team invitation form responsive
- [ ] Directory table scrollable on mobile
- [ ] Member details readable on all devices
- [ ] Touch targets are minimum 44x44px
- [ ] Colors have sufficient contrast
- [ ] All text is readable

---

## Phase 15: Performance Checks

- [ ] Login OTP response < 2 seconds
- [ ] Organization creation < 2 seconds
- [ ] Team member invitation < 1 second per member
- [ ] Directory load < 2 seconds
- [ ] Member search/filter < 500ms
- [ ] No console errors
- [ ] No network timeouts
- [ ] API responses under 500ms

---

## Summary

**Total Checks**: 150+

**Passed**: _____  
**Failed**: _____  
**Skipped**: _____  

**Overall Status**: ☐ PASS ☐ FAIL ☐ NEEDS REVIEW

**Issues Found**:
```
1. 
2. 
3. 
```

**Notes**:
```


```

**Tester Signature**: _________________ **Date**: _________

---

**Last Updated**: April 1, 2026
