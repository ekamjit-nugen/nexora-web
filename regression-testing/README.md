# Regression Testing Suite

Complete regression testing documentation for Nexora platform. This folder contains detailed test flows and scenarios for validating core platform functionality.

## Structure

```
regression-testing/
├── auth/
│   ├── AUTH_FLOW.md          # Complete authentication flow documentation
│   └── (additional test cases will be added here)
├── README.md                   # This file
└── (other modules will be added)
```

## Available Test Flows

### Authentication Module (`auth/`)

#### [AUTH_FLOW.md](auth/AUTH_FLOW.md)
Complete end-to-end authentication flow covering:
- Email entry and validation
- OTP generation and verification
- Organization setup for new users
- Team member invitation and management
- Post-login access and permissions
- Directory/member visibility
- Data verification in system
- Token management and session handling
- Error scenarios and edge cases
- Permission and authorization checks
- Regression test checklist
- Test data samples

**Scope**: Covers 12 major sections with detailed step-by-step flows

## Quick Start

1. Open `auth/AUTH_FLOW.md`
2. Follow steps sequentially from Section 1 (Initial User Entry) through Section 12
3. Use the regression test checklist (Section 11) to track completion
4. Refer to test data samples (Section 12) for consistent test inputs

## Test Execution Guidelines

### Prerequisites
- Backend services running (auth-service, organization-service, etc.)
- MongoDB instance available
- MailHog or email service for OTP verification
- Frontend application running

### Environment Setup
- **Dev OTP**: Use `000000` or `123456` for OTP verification
- **Email Testing**: Access MailHog at `http://localhost:8025`
- **Database**: MongoDB at `mongodb://root:password@localhost:27017`
- **API Gateway**: `http://localhost:3005`

### Test Execution Steps

1. **Create Test User**
   - Go to login page
   - Enter test email
   - Verify OTP in MailHog
   - Complete organization setup

2. **Create Test Organization**
   - Fill organization details
   - Verify in database

3. **Add Team Members**
   - Invite 3-4 test members
   - Verify emails sent to MailHog

4. **Verify Data in System**
   - Check MongoDB for user records
   - Verify organization memberships
   - Confirm roles created

5. **Test Team Member Login**
   - Open invite email
   - Click invite link
   - Login with OTP
   - Verify access to directory

6. **Verify Permissions**
   - Admin: Can view/manage members
   - Members: Can view directory (read-only)
   - Verify role-based access

### Success Criteria

✅ All users created successfully in database  
✅ Organization created with correct details  
✅ All 6 default roles created  
✅ All invited members appear in directory  
✅ All members can login with OTP  
✅ Members see correct organization and team  
✅ Permissions enforced correctly  
✅ All error scenarios handled gracefully  

## Test Coverage

| Component | Coverage | Status |
|-----------|----------|--------|
| OTP Generation | ✅ Complete | Ready |
| OTP Verification | ✅ Complete | Ready |
| Email Validation | ✅ Complete | Ready |
| Organization Creation | ✅ Complete | Ready |
| Team Member Invitation | ✅ Complete | Ready |
| Member Directory | ✅ Complete | Ready |
| Permission Checks | ✅ Complete | Ready |
| Error Handling | ✅ Complete | Ready |
| Database Verification | ✅ Complete | Ready |

## Known Issues & Notes

- OTP should expire after 10 minutes
- Email invitations may take 5-10 seconds in development
- Test data should be cleaned up between test runs (or use unique timestamps)
- Admin user is automatically organization owner

## Next Steps

Additional regression test modules to be added:
- [ ] HR/Employee Management
- [ ] Attendance & Leave
- [ ] Projects & Tasks
- [ ] CRM & Clients
- [ ] Payroll & Invoicing
- [ ] Reports & Analytics
- [ ] Integrations
- [ ] API Gateway
- [ ] Real-time Features
- [ ] Security & Compliance

## Support

For questions or issues during testing:
1. Check the relevant section in AUTH_FLOW.md
2. Verify all prerequisites are running
3. Check MongoDB for data consistency
4. Review backend service logs

---

**Last Updated**: April 1, 2026  
**Version**: 1.0.0 - Auth Module Complete
