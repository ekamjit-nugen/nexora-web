# Authentication Flow - Regression Testing

## Overview
Complete authentication flow covering user registration, organization setup, team member management, and post-login access.

---

## 1. Initial User Entry - Email Input

### Step 1.1: User Lands on Login Page
- **URL**: `http://localhost:3000/auth/login` (or `/auth`)
- **Expected Screen**: Login form with email input field
- **Elements visible**:
  - Email input field (placeholder: "Enter your email")
  - "Continue" or "Send OTP" button
  - Optional: Links to signup/forgot password
  - Nexora logo/branding

### Step 1.2: User Enters Email
- **Action**: User types email address (e.g., `user@company.com`)
- **Validation**:
  - Email format validation (must be valid email)
  - Error message if invalid format (e.g., "Please enter a valid email")
- **Expected Behavior**:
  - Continue button should be enabled
  - No error message if email is valid

### Step 1.3: User Clicks "Continue" / "Send OTP"
- **Action**: User clicks send OTP button
- **Backend Process**:
  - System generates OTP (6 digits)
  - System sends OTP via email
  - System logs this action (audit trail)
- **Expected Response**:
  - Success message: "OTP sent to your email"
  - Page transitions to OTP verification screen
  - Email input becomes read-only (can show "sent to {email}" with edit option)

---

## 2. OTP Verification

### Step 2.1: OTP Verification Screen
- **URL**: Stays on `/auth/login` or transitions to `/auth/verify-otp`
- **Expected Screen**: OTP input form
- **Elements visible**:
  - 6 OTP input fields (numeric only, auto-focus next field)
  - "Verify OTP" button (disabled until all 6 digits entered)
  - "Resend OTP" link (disabled for 30 seconds with countdown)
  - Email display with option to "Change Email"

### Step 2.2: User Enters OTP
- **Action**: User receives OTP from email and enters it
- **Development Mode**: Use `000000` or `123456` as test OTP
- **Validation**:
  - Only numeric input allowed
  - Auto-advance to next field when digit entered
  - Real-time validation as digits are entered
- **Expected Behavior**:
  - Verify button enables once 6 digits complete
  - No error if OTP is correct

### Step 2.3: OTP Verification
- **Action**: User clicks "Verify OTP"
- **Backend Process**:
  - System validates OTP against stored hash
  - System checks if user exists
- **Outcomes**:
  - **If new user**: Transition to Step 3 (Org Setup)
  - **If existing user in org**: Transition to Step 5 (Login Success)
  - **If wrong OTP**: Show error "Invalid OTP. Please try again"
  - **If OTP expired** (>10 minutes): Show error "OTP expired. Request a new one"

### Step 2.4: Resend OTP
- **Action**: User clicks "Resend OTP" (if first one not received)
- **Cooldown**: Button disabled for 30 seconds with countdown
- **Backend Process**:
  - Generate new OTP
  - Send to email
  - Invalidate previous OTP
- **Expected Behavior**:
  - Countdown timer visible (30, 29, 28...)
  - Success message: "New OTP sent"
  - OTP input fields cleared for new entry

---

## 3. Organization Setup (New User Path)

### Step 3.1: Organization Details Form
- **Condition**: Triggered only for new users (no existing organizations)
- **URL**: `/auth/setup-organization` or similar
- **Expected Screen**: Form with organization details
- **Fields**:
  - **Organization Name** (required)
    - Placeholder: "Enter organization name"
    - Max length: 100 characters
    - Real-time validation feedback
  - **Organization Type** (required) - Dropdown
    - Options: IT Services, Consulting, Product Company, Enterprise, Startup, Other
  - **Organization Size** (required) - Dropdown
    - Options: 1-10, 11-50, 51-200, 201-500, 500+
  - **Country** (required) - Dropdown with search
  - **Timezone** (optional, auto-detected)
    - Auto-populate based on browser/IP
    - Allow manual override

### Step 3.2: User Fills Organization Details
- **Action**: User completes all required fields
- **Validation**:
  - Organization name must be 3-100 characters
  - At least one character must be alphanumeric
  - Show validation error if field is empty
- **Expected Behavior**:
  - Submit button enabled once all required fields filled
  - Form saves as user types (draft in local storage)

### Step 3.3: User Submits Organization Form
- **Action**: User clicks "Create Organization" / "Continue" button
- **Backend Process**:
  - Validate all fields on server
  - Create organization in database
  - Assign user as organization owner/admin
  - Create default roles (Admin, HR, Manager, Developer, Designer, Employee)
  - Assign user to organization with Admin role
- **Expected Response**:
  - Success message: "Organization created successfully"
  - Transition to Step 3.4 (First Admin Setup) or directly to Step 4 (Team Setup)

### Step 3.4: First Admin Details (Optional, if not filled during registration)
- **URL**: `/auth/setup-admin` or part of org setup
- **Fields**:
  - First Name (required)
  - Last Name (required)
  - Phone Number (optional)
  - Job Title (optional)
- **Expected Behavior**:
  - Pre-fill if already available from email signup
  - Allow user to confirm/update
  - Skip button if already complete

---

## 4. Team Member Invitation (Organization Setup)

### Step 4.1: Team Members Invitation Screen
- **URL**: `/auth/invite-team` or `/org/setup/members`
- **Condition**: Shown after organization is created
- **Expected Screen**: Form to add team members
- **Elements**:
  - "Invite Team Members" heading
  - Table/List showing invited members (initially empty)
  - Form to add new member with fields:
    - Email (required)
    - First Name (required)
    - Last Name (required)
    - Role (required) - Dropdown with default roles
    - Send Invite button (only on this row, or bulk add button)
  - "Skip" or "Continue to Dashboard" button
  - Progress indicator (Step 3 of 4, or similar)

### Step 4.2: Add First Team Member
- **Action**: User fills in team member details
  - Email: `member1@company.com`
  - First Name: `John`
  - Last Name: `Doe`
  - Role: `Manager` (or any role from organization)
- **Validation**:
  - Email must be valid format
  - Email must not be the same as admin user
  - Email must not already exist in invitation list
  - First/Last names must be 2-50 characters
  - Role must be selected from available roles
- **Error Messages**:
  - "Invalid email format"
  - "This email is already invited"
  - "You cannot invite yourself"
  - "Please enter a valid name"

### Step 4.3: User Clicks "Add Member" / "Invite"
- **Action**: System processes invitation for first member
- **Backend Process**:
  - Validate email doesn't already exist in system
  - Create invitation record
  - Send invitation email with:
    - Unique invite link (or OTP for them to login)
    - Organization name
    - Admin name
    - Instructions to join
  - Add member to organization with assigned role
  - Create org membership record
- **Expected Response**:
  - Member appears in "Pending Invitations" table
  - Status shown as "Invited" or "Pending"
  - Sent date/time displayed
  - Option to resend invitation or remove member
  - Form clears for next member entry

### Step 4.4: Add Additional Team Members
- **Action**: User adds more members (2-5 recommended for testing)
- **Each Member**:
  - Email: `member2@company.com`, `member3@company.com`, etc.
  - Each should have different role: Manager, Developer, HR, etc.
  - Same validation as Step 4.2
- **Expected Behavior**:
  - All members appear in list with status
  - Can add unlimited members (or show limit like 50)
  - Scroll if many members added

### Step 4.5: Review Invitations
- **Action**: User reviews all invited members before continuing
- **Expected Information**:
  - Table with columns: Email | Name | Role | Status | Actions
  - Total count of invited members
  - Option to remove any member (shows confirmation)
  - Option to resend invite to any member

### Step 4.6: Proceed to Dashboard
- **Action**: User clicks "Continue to Dashboard" or "Finish Setup"
- **Backend Process**:
  - Mark organization setup as complete
  - Create user session/tokens
  - Log successful setup completion
- **Expected Response**:
  - Redirect to dashboard/home page (`/dashboard` or `/`)
  - Welcome message: "Welcome {FirstName}! Your organization is set up."
  - Show organization name in sidebar/header

---

## 5. Post-Login Dashboard & Access

### Step 5.1: Admin User Logged In Successfully
- **URL**: `/dashboard` or `/`
- **Expected State**:
  - User is authenticated (token in headers)
  - Organization context is set
  - Sidebar shows organization name
  - User profile shows in top-right
- **Available Features**:
  - View organization members
  - Invite new members
  - Manage roles and permissions
  - Access other modules (HR, Projects, etc.)

### Step 5.2: View Organization Directory/Members
- **URL**: `/directory` or `/org/members` or `/admin/members`
- **Action**: Admin clicks on "Directory" or "Team" or "Members" menu
- **Expected Screen**: List of organization members
- **Table Columns**:
  - Name (First Name + Last Name)
  - Email
  - Role
  - Status (Active/Pending/Inactive)
  - Join Date
  - Actions (Edit, Remove, etc.)

### Step 5.3: Verify All Invited Members Appear
- **Expected Behavior**:
  - All members added in Step 4 should appear in directory
  - Admin user (logged-in user) should appear
  - Status should match:
    - **Active**: For members who have already logged in
    - **Pending**: For members not yet logged in
    - **Invited**: For recently invited members (< 24 hours)
  - Count should match: 1 (admin) + number of invitations sent

### Step 5.4: Member Information Visible
- **Details Shown for Each Member**:
  - Full name (First + Last)
  - Email address
  - Role assigned
  - Department (if applicable)
  - Join date
  - Last login (if applicable)
  - Status indicator

### Step 5.5: Admin Can See Own Profile
- **Action**: Admin clicks on own name/avatar
- **Expected Information**:
  - First Name
  - Last Name
  - Email
  - Organization
  - Role (Admin)
  - Timezone
  - Preferences (language, theme, etc.)

---

## 6. Invited Team Member Login (Subsequent Users)

### Step 6.1: Team Member Receives Invitation Email
- **Email Contents**:
  - Subject: "You've been invited to {OrgName} on Nexora"
  - Body includes:
    - Welcome message
    - Admin name who invited them
    - Organization name
    - "Join Now" button/link
    - Instructions to set up account

### Step 6.2: Team Member Clicks Invitation Link
- **Action**: Member clicks "Join Now" in email
- **Redirect**: Takes them to login page with email pre-filled
- **URL**: `/auth/login?email=member@company.com&org={orgId}` (or similar)
- **Expected Behavior**:
  - Email field is pre-filled with invited email
  - Email field is read-only (with edit option)
  - Can proceed directly to OTP entry

### Step 6.3: Team Member Enters OTP
- **Process**: Same as Step 2 (OTP Verification)
- **Key Difference**: This is an existing user in the system (from org setup)
- **Expected Behavior**:
  - OTP verification succeeds
  - User already has organization context
  - Skips organization setup (already done)
  - Proceeds directly to dashboard login

### Step 6.4: Team Member Logged In
- **URL**: `/dashboard` or first-time welcome page
- **Expected State**:
  - User is authenticated
  - Organization context is set to the organization they were invited to
  - User sees organization dashboard
  - User's role is set to the role assigned in invitation

### Step 6.5: Team Member Accesses Directory
- **Action**: Team member clicks "Directory" / "Team"
- **Expected Screen**: Member list (same as Step 5.2)
- **Key Differences**:
  - Can see all organization members (based on role permissions)
  - Cannot manage/remove members (unless they have HR/Admin role)
  - Can see the admin who invited them
  - Cannot see members from other organizations

---

## 7. Data Verification in System

### Step 7.1: User Accounts Created
- **Verify in Database** (`nexora_auth.users` collection):
  ```javascript
  {
    _id: ObjectId,
    email: "admin@company.com",
    firstName: "Admin",
    lastName: "User",
    isActive: true,
    organizations: [ObjectId],  // Array of org IDs
    createdAt: ISODate,
    updatedAt: ISODate
  }
  ```
- **For Each Team Member**:
  ```javascript
  {
    _id: ObjectId,
    email: "member@company.com",
    firstName: "John",
    lastName: "Doe",
    isActive: true,
    organizations: [ObjectId],  // Same org ID
    createdAt: ISODate,
    updatedAt: ISODate
  }
  ```

### Step 7.2: Organization Record Created
- **Verify in Database** (`nexora_auth.organizations` collection):
  ```javascript
  {
    _id: ObjectId,
    name: "Company Name",
    type: "IT Services",
    size: "11-50",
    country: "US",
    timezone: "America/New_York",
    owner: ObjectId,  // Admin user ID
    createdAt: ISODate,
    updatedAt: ISODate
  }
  ```

### Step 7.3: Organization Membership Records
- **Verify in Database** (`nexora_auth.orgmemberships` collection):
  ```javascript
  // For Admin User
  {
    _id: ObjectId,
    userId: ObjectId,  // Admin user ID
    organizationId: ObjectId,
    role: "admin",
    status: "active",
    joinedAt: ISODate,
    createdAt: ISODate
  }
  
  // For Each Team Member
  {
    _id: ObjectId,
    userId: ObjectId,  // Team member user ID
    organizationId: ObjectId,
    role: "manager" | "developer" | "hr" | etc,
    status: "active",  // "pending" if not logged in yet
    invitedBy: ObjectId,  // Admin user ID
    invitedAt: ISODate,
    joinedAt: ISODate,
    createdAt: ISODate
  }
  ```

### Step 7.4: Default Roles Created
- **Verify in Database** (`nexora_auth.roles` collection):
  ```javascript
  // Organization should have these default roles
  [
    { name: "admin", organizationId: ObjectId, createdAt: ISODate },
    { name: "hr", organizationId: ObjectId, createdAt: ISODate },
    { name: "manager", organizationId: ObjectId, createdAt: ISODate },
    { name: "developer", organizationId: ObjectId, createdAt: ISODate },
    { name: "designer", organizationId: ObjectId, createdAt: ISODate },
    { name: "employee", organizationId: ObjectId, createdAt: ISODate }
  ]
  ```

---

## 8. Authentication Tokens & Session

### Step 8.1: Token Generation on Login
- **After successful OTP verification**:
- **Backend generates**:
  - `accessToken` (JWT, 15-30 min expiry)
  - `refreshToken` (JWT, 7 days expiry)
- **Stored in Frontend**:
  - `accessToken`: HTTP-only cookie or localStorage
  - `refreshToken`: HTTP-only cookie or localStorage
  - Organization context stored

### Step 8.2: Token Usage
- **All API requests** include:
  - Authorization header: `Authorization: Bearer {accessToken}`
  - Requests to `/directory`, `/members`, etc. use this token
- **Server validates**:
  - Token signature
  - Token expiry
  - User exists and is active
  - User belongs to organization

### Step 8.3: Token Refresh
- **When accessToken near expiry**:
  - Frontend sends `refreshToken` to `/auth/refresh`
  - Backend validates refresh token
  - New `accessToken` issued
  - User session continues without re-login

### Step 8.4: Logout
- **Action**: User clicks "Logout" or session expires
- **Backend Process**:
  - Invalidate tokens (optional)
  - Clear session
  - Remove organization context
- **Frontend**:
  - Clear tokens from storage
  - Redirect to login page `/auth/login`

---

## 9. Error Scenarios & Handling

### Error 9.1: Invalid Email
- **Scenario**: User enters non-existent email format
- **Expected**: "Please enter a valid email address"
- **Button State**: Submit disabled

### Error 9.2: Wrong OTP
- **Scenario**: User enters incorrect 6-digit OTP
- **Expected**: "Invalid OTP. Please try again."
- **Behavior**: Input clears, user can retry
- **Attempts**: Allow 5 attempts, then ask to resend OTP

### Error 9.3: OTP Expired
- **Scenario**: User takes >10 minutes to enter OTP
- **Expected**: "OTP expired. Request a new one"
- **Action**: Show "Resend OTP" button

### Error 9.4: Organization Name Missing
- **Scenario**: User tries to proceed with empty org name
- **Expected**: "Organization name is required"
- **Button State**: Submit disabled until filled

### Error 9.5: Duplicate Email in Team Members
- **Scenario**: User adds same email twice in team setup
- **Expected**: "This email is already invited"
- **Behavior**: Input shows error, cannot add duplicate

### Error 9.6: Invite Own Email
- **Scenario**: User tries to invite their own email as team member
- **Expected**: "You cannot invite yourself"
- **Behavior**: Error shown, cannot add

### Error 9.7: Unauthorized Access to Directory
- **Scenario**: User tries to access `/directory` without being logged in
- **Expected**: Redirect to `/auth/login`
- **Behavior**: Store intended URL and redirect after login

### Error 9.8: Access Denied - Wrong Organization
- **Scenario**: User logs in to Org A, tries to access Org B's directory (if invited to both)
- **Expected**: Can only see members of currently selected organization
- **Behavior**: Organization switcher available if user in multiple orgs

---

## 10. Permission & Authorization Checks

### Step 10.1: Admin Permissions
- **Can perform**:
  - View all organization members
  - Invite new members
  - Remove members
  - Change member roles
  - View organization settings
  - Access all org modules
- **Cannot perform**:
  - Downgrade own role below admin
  - Delete organization (or requires confirmation)

### Step 10.2: Non-Admin Member Permissions
- **Can perform**:
  - View own profile
  - View organization members (based on role)
  - Update own preferences
  - Access modules assigned to their role
- **Cannot perform**:
  - Invite members (unless they have permission)
  - Remove members
  - Change other members' roles
  - Access admin panel

### Step 10.3: Pending Member Behavior
- **Before first login**:
  - User record exists in database
  - OrgMembership status is "pending"
  - Cannot access dashboard until they log in
- **After first login**:
  - Status changes to "active"
  - Full access granted (based on role)

---

## 11. Regression Test Checklist

- [ ] New user email entry flow
- [ ] OTP generation and delivery
- [ ] OTP validation (correct OTP)
- [ ] OTP validation (wrong OTP with retry)
- [ ] OTP expiry and resend
- [ ] Organization creation with all fields
- [ ] Organization setup completion
- [ ] Team member invitation (single)
- [ ] Team member invitation (multiple, 3+)
- [ ] Team member email validation
- [ ] Duplicate email prevention
- [ ] Self-invite prevention
- [ ] First admin after org creation
- [ ] Admin views organization directory
- [ ] All invited members appear in directory
- [ ] Member statuses display correctly
- [ ] Second user login with invite link
- [ ] Second user sees same organization
- [ ] Second user sees all members in directory
- [ ] Database records created correctly
- [ ] Roles created for organization
- [ ] Tokens generated and stored
- [ ] Token refresh works
- [ ] Logout clears session
- [ ] Unauthorized access redirects to login
- [ ] Permission checks enforced
- [ ] Error messages display correctly
- [ ] Form validation works
- [ ] UI responsiveness (mobile/tablet)
- [ ] Email delivery confirmation
- [ ] Audit logs created for actions

---

## 12. Test Data Sample

### Admin User Setup
```
Email: admin.test@nexora.io
Password/OTP: 000000 (dev mode)
First Name: Alex
Last Name: Admin
Organization: Tech Startup Inc
Organization Type: Product Company
Organization Size: 11-50
Country: United States
Timezone: America/New_York
```

### Team Members to Invite
```
1. John Manager
   Email: john.manager@nexora.io
   Role: Manager

2. Sarah Developer
   Email: sarah.dev@nexora.io
   Role: Developer

3. Emily HR
   Email: emily.hr@nexora.io
   Role: HR

4. Mike Designer
   Email: mike.design@nexora.io
   Role: Designer
```

### Expected Outcomes
- 1 organization created: "Tech Startup Inc"
- 5 users created (1 admin + 4 team members)
- 1 set of default roles created (6 roles)
- 5 organization memberships created
- All members visible in directory
- All members can login with OTP
- All members see same organization and team

---

## Notes for QA/Testing

1. **OTP in Development**: Use `000000` or `123456` (configure in auth service)
2. **Email Testing**: Use MailHog at `http://localhost:8025` to view emails
3. **Database Access**: Connect to MongoDB at `mongodb://root:password@localhost:27017`
4. **Token Validation**: Check JWT tokens at `jwt.io`
5. **API Testing**: Use Postman or similar tool to verify endpoints
6. **Mobile Testing**: Test on iOS and Android devices/emulators
7. **Browser Testing**: Chrome, Firefox, Safari, Edge
8. **Performance**: Monitor response times, should be <500ms per request

---

## Related API Endpoints

- `POST /auth/send-otp` - Send OTP to email
- `POST /auth/verify-otp` - Verify OTP and create user if new
- `POST /auth/organizations` - Create organization
- `POST /auth/organizations/{orgId}/invite` - Invite team members
- `GET /auth/organizations/{orgId}/members` - List members
- `GET /directory` or `GET /employees` - View organization directory
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user info

---

**Last Updated**: April 1, 2026
**Version**: 1.0.0
