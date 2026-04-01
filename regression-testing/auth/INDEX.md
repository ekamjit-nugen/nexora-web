# Authentication Module - Test Documentation Index

Complete reference guide for authentication regression testing.

---

## Quick Start

1. **New to Auth Testing?** → Start with [AUTH_FLOW.md](AUTH_FLOW.md) Section 1-3
2. **Need Quick Checklist?** → Use [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md)
3. **Need Test Data?** → Reference [TEST_DATA.md](TEST_DATA.md)

---

## Documents Overview

### [AUTH_FLOW.md](AUTH_FLOW.md)
**Comprehensive End-to-End Flow Documentation**

**Contents**:
- **Section 1**: Initial User Entry (Email Input)
  - Login page
  - Email validation
  - OTP request

- **Section 2**: OTP Verification
  - OTP screen
  - OTP entry and validation
  - Resend OTP
  - New user vs existing user logic

- **Section 3**: Organization Setup (New User Path)
  - Organization form
  - Org details validation
  - First admin details
  - Default roles creation

- **Section 4**: Team Member Invitation
  - Invitation form
  - Add single member
  - Add multiple members
  - Review invitations
  - Database record creation

- **Section 5**: Post-Login Dashboard & Access
  - Dashboard access
  - Directory/members view
  - Admin dashboard
  - User profile

- **Section 6**: Team Member Login (Subsequent Users)
  - Invitation email
  - Invite link flow
  - OTP verification (existing user)
  - First login experience

- **Section 7**: Database Verification
  - Users collection structure
  - Organizations collection
  - OrgMemberships structure
  - Roles collection
  - Sample data formats

- **Section 8**: Token Management & Session
  - Token generation
  - Token usage in API
  - Token refresh
  - Logout

- **Section 9**: Error Scenarios
  - Invalid email
  - Wrong OTP
  - Expired OTP
  - Duplicate members
  - Self-invite prevention
  - Unauthorized access

- **Section 10**: Permission & Authorization
  - Admin permissions
  - Non-admin permissions
  - Pending member behavior
  - Role-based access

- **Section 11**: Regression Test Checklist
  - 30+ checkbox items
  - All key flows
  - All data validations
  - All error cases

- **Section 12**: Test Data & API Endpoints
  - Sample user data
  - Sample organization data
  - API endpoint references

**Best For**: Understanding complete flow, step-by-step execution, detailed expectations

**Read Time**: 30-45 minutes  
**Length**: ~1200 lines

---

### [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md)
**Quick Reference Verification Checklist**

**Contents**:
- **Phase 1**: Initial Setup
  - Service prerequisites
  - Infrastructure checks

- **Phase 2**: Email Entry & OTP
  - UI elements
  - OTP generation
  - Email verification

- **Phase 3**: OTP Verification
  - OTP input
  - Verification process
  - Redirect behavior

- **Phase 4**: Organization Creation
  - Form fields
  - Validation
  - Database verification

- **Phase 5**: Admin Details
  - Profile creation
  - Data persistence

- **Phase 6**: Team Member Invitation
  - Invitation form
  - Multiple members (4 members template)
  - Email verification
  - List review

- **Phase 7**: Dashboard Access
  - Navigation
  - User display
  - Organization context

- **Phase 8**: Directory Verification
  - Member list display
  - Status indicators
  - Complete member information

- **Phase 9**: Database Verification
  - Users collection
  - Organizations collection
  - OrgMemberships collection
  - Roles collection

- **Phase 10**: Team Member Login
  - Email verification
  - OTP login (multiple users)
  - Directory access
  - Permission verification

- **Phase 11**: Data Consistency
  - Status updates
  - Record integrity
  - No duplicates

- **Phase 12**: Permissions & Auth
  - Admin permissions
  - Non-admin permissions
  - Unauthorized access

- **Phase 13**: Error Scenarios
  - Email validation errors
  - OTP errors
  - Organization errors
  - Invitation errors

- **Phase 14**: UI/UX Verification
  - Responsiveness
  - Accessibility
  - Visual clarity

- **Phase 15**: Performance
  - Response times
  - Load times
  - No errors/timeouts

**Best For**: Quick verification, checkbox-style testing, tracking progress

**Read Time**: 15-20 minutes to execute  
**Checkpoints**: 150+

---

### [TEST_DATA.md](TEST_DATA.md)
**Test Data Reference & Examples**

**Contents**:
- **Admin User Profile**
  - Email, name, credentials
  - Repeated testing variations

- **Organization Templates**
  - Primary: Tech Startup Inc
  - Alternative scenarios (3 variants)

- **Team Members - Primary Set**
  - John Manager
  - Sarah Developer
  - Emily HR
  - Mike Designer
  - (4 members, different roles)

- **Team Members - Extended Set**
  - Robert Backend
  - Lisa Frontend
  - David Sales
  - Jennifer Recruiting
  - Tom Employee
  - (Additional members for large org testing)

- **Test Scenarios**
  - Minimal (1 user)
  - Small Team (5 users)
  - Medium Team (9 users)
  - Large Organization (16+ users)

- **Invalid Email Test Cases**
  - Format errors
  - Missing parts
  - Special cases

- **API Examples**
  - Send OTP request/response
  - Verify OTP request/response
  - Create Organization request/response
  - Invite Member request/response
  - Get Members request/response

- **Database Queries**
  - Find users
  - Find memberships
  - Count by role
  - Find pending invites
  - Check roles

- **Performance Baselines**
  - Response time expectations
  - Database size expectations

- **Cleanup Procedures**
  - Delete test data
  - Preserve template data

**Best For**: Copy-paste test data, API testing, database verification

**Read Time**: 10-15 minutes  
**Reusable Items**: 20+

---

## Testing Workflow

### Workflow 1: Complete New Test Run

1. **Review Prerequisites** (5 min)
   - Read [AUTH_FLOW.md](AUTH_FLOW.md) Sections 1-3
   - Check [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 1

2. **Execute Test** (45 min)
   - Follow [AUTH_FLOW.md](AUTH_FLOW.md) step-by-step
   - Use [TEST_DATA.md](TEST_DATA.md) for data
   - Check UI/UX as you go

3. **Verify Data** (15 min)
   - Use [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phases 8-9
   - Run database queries from [TEST_DATA.md](TEST_DATA.md)

4. **Test Edge Cases** (20 min)
   - Reference [AUTH_FLOW.md](AUTH_FLOW.md) Section 9
   - Use [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phases 13-15

5. **Document Results** (10 min)
   - Complete [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) summary
   - Log any issues found

**Total Time**: ~95 minutes

---

### Workflow 2: Quick Regression Test

1. **Setup Check** (2 min)
   - Run [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 1

2. **Execute Core Flow** (20 min)
   - Run [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phases 2-8
   - Follow checklist exactly

3. **Database Check** (5 min)
   - Run [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 9 queries

4. **Document** (3 min)
   - Mark pass/fail on checklist

**Total Time**: ~30 minutes

---

### Workflow 3: Targeted Testing

**Scenario**: Testing only team member invitation flow

1. Read [AUTH_FLOW.md](AUTH_FLOW.md) Section 4 (15 min)
2. Use [TEST_DATA.md](TEST_DATA.md) Team Members section
3. Reference [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 6
4. Verify database with [TEST_DATA.md](TEST_DATA.md) queries

---

## Common Questions

### Q: What's the difference between these documents?

| Document | Purpose | Use When |
|----------|---------|----------|
| AUTH_FLOW.md | Complete documentation | Learning, detailed testing, documentation |
| AUTH_CHECKLIST.md | Quick verification | Running tests, tracking progress |
| TEST_DATA.md | Reference data | Getting test data, API examples |

### Q: How long does a complete test take?

**Full Test**: ~95 minutes  
**Quick Test**: ~30 minutes  
**Specific Flow**: ~15 minutes (depends on scope)

### Q: Where do I find test data?

All test data in [TEST_DATA.md](TEST_DATA.md):
- User profiles
- Organization templates
- Email addresses
- API examples
- Database queries

### Q: What if a test fails?

1. Check [AUTH_FLOW.md](AUTH_FLOW.md) Section 9 (Error Scenarios)
2. Verify all prerequisites in [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 1
3. Check backend logs
4. Review [TEST_DATA.md](TEST_DATA.md) API examples for expected responses

### Q: How do I verify data in database?

Use queries in [TEST_DATA.md](TEST_DATA.md) "Database Test Queries" section:
```javascript
db.users.find({ organizations: ObjectId("org_id") })
db.orgmemberships.find({ organizationId: ObjectId("org_id") })
```

### Q: Can I run multiple tests in parallel?

**Yes**, use unique emails with timestamps:
```
admin.test.{Date.now()}@nexora.io
```

### Q: What's the OTP for testing?

Check [TEST_DATA.md](TEST_DATA.md):
- Default: `000000`
- Check `.env` for `DEV_OTP` setting

---

## File Locations

```
regression-testing/
├── README.md                      # Overview of regression testing
├── auth/
│   ├── INDEX.md                   # This file
│   ├── AUTH_FLOW.md              # Complete detailed flow (1200+ lines)
│   ├── AUTH_CHECKLIST.md         # Quick checklist (150+ checks)
│   ├── TEST_DATA.md              # Test data reference
│   └── (future: additional auth tests)
└── (future: other modules - HR, Attendance, Projects, etc.)
```

---

## Success Criteria Checklist

By the end of auth regression testing, you should have verified:

- [ ] **User Registration**: Email → OTP → Organization Setup → Dashboard
- [ ] **Organization Creation**: All fields validated, stored in DB
- [ ] **Default Roles**: 6 roles created (admin, hr, manager, developer, designer, employee)
- [ ] **Team Invitations**: Multiple members invited, emails sent, records created
- [ ] **Member Directory**: All members visible, statuses correct, permissions enforced
- [ ] **Subsequent Logins**: Invited members can login, see same organization
- [ ] **Database Integrity**: All records created, no duplicates, data consistent
- [ ] **Tokens & Sessions**: Access token works, refresh token works, logout clears session
- [ ] **Permissions**: Admin can manage, non-admin cannot
- [ ] **Error Handling**: All error messages display, validation works
- [ ] **UI/UX**: Responsive on all devices, accessible
- [ ] **Performance**: All responses < 500ms

---

## Regression Testing Schedule

### Weekly
- Run [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Quick Test (30 min)

### Before Release
- Run Complete Test Flow (95 min)
- Test all error scenarios (20 min)
- Performance check (10 min)

### After Code Changes
- Run Targeted Tests for changed areas
- Verify database integrity

---

## Related Documentation

- Parent: [regression-testing/README.md](../README.md)
- Auth Service: Services/auth-service/README.md (see project docs)
- API Documentation: API endpoints listed in [AUTH_FLOW.md](AUTH_FLOW.md) Section 12
- Frontend Code: frontend/src/pages/auth/ (see web app)
- Mobile Code: mobile/src/screens/Auth/ (see mobile app)

---

## Support & Issues

**If tests fail**:
1. Check prerequisites in [AUTH_CHECKLIST.md](AUTH_CHECKLIST.md) Phase 1
2. Review expected behavior in [AUTH_FLOW.md](AUTH_FLOW.md)
3. Check error section: [AUTH_FLOW.md](AUTH_FLOW.md) Section 9
4. Review backend service logs

**If unsure about data**:
1. Check [TEST_DATA.md](TEST_DATA.md) for examples
2. Use database queries from [TEST_DATA.md](TEST_DATA.md)
3. Verify API responses match examples

**For new scenarios**:
1. Create variations of [TEST_DATA.md](TEST_DATA.md) scenarios
2. Document expected behavior
3. Add checklist items as needed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial release with complete auth flow |

---

## Last Updated

**Date**: April 1, 2026  
**Version**: 1.0.0  
**Status**: Complete and Ready for Testing

---

**Quick Links**:
- 📖 [Full Auth Flow](AUTH_FLOW.md)
- ✅ [Checklist](AUTH_CHECKLIST.md)
- 📊 [Test Data](TEST_DATA.md)
- 📑 [Parent README](../README.md)
