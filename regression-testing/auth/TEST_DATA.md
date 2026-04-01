# Test Data Reference - Auth Flow

Standardized test data for authentication flow regression testing.

---

## Admin User Profile

```json
{
  "email": "admin.test@nexora.io",
  "firstName": "Alex",
  "lastName": "Admin",
  "password": "N/A (Use OTP)",
  "otp": "000000",
  "phone": "+1-555-0101",
  "jobTitle": "Organization Owner"
}
```

### Credentials for Repeated Testing
- **Email**: `admin.test.{timestamp}@nexora.io` (for uniqueness)
- **OTP**: Use test OTP from environment (typically `000000`)

---

## Organization Details

```json
{
  "name": "Tech Startup Inc",
  "type": "Product Company",
  "size": "11-50",
  "country": "United States",
  "timezone": "America/New_York",
  "website": "https://example.com",
  "industry": "Information Technology"
}
```

### Alternative Organization Profiles

#### Scenario 1: Consulting Firm
```json
{
  "name": "Global Consulting Group",
  "type": "Consulting",
  "size": "51-200",
  "country": "Canada",
  "timezone": "America/Toronto"
}
```

#### Scenario 2: Enterprise
```json
{
  "name": "Fortune 500 Corp",
  "type": "Enterprise",
  "size": "500+",
  "country": "United Kingdom",
  "timezone": "Europe/London"
}
```

#### Scenario 3: Startup
```json
{
  "name": "Startup Accelerator",
  "type": "Startup",
  "size": "1-10",
  "country": "India",
  "timezone": "Asia/Kolkata"
}
```

---

## Team Members - Primary Test Set

### Member 1: John Manager

```json
{
  "email": "john.manager@nexora.io",
  "firstName": "John",
  "lastName": "Manager",
  "role": "manager",
  "phone": "+1-555-0102",
  "department": "Operations"
}
```

**For Repeated Testing**: `john.manager.{timestamp}@nexora.io`

---

### Member 2: Sarah Developer

```json
{
  "email": "sarah.developer@nexora.io",
  "firstName": "Sarah",
  "lastName": "Developer",
  "role": "developer",
  "phone": "+1-555-0103",
  "department": "Engineering"
}
```

**For Repeated Testing**: `sarah.developer.{timestamp}@nexora.io`

---

### Member 3: Emily HR

```json
{
  "email": "emily.hr@nexora.io",
  "firstName": "Emily",
  "lastName": "HR",
  "role": "hr",
  "phone": "+1-555-0104",
  "department": "Human Resources"
}
```

**For Repeated Testing**: `emily.hr.{timestamp}@nexora.io`

---

### Member 4: Mike Designer

```json
{
  "email": "mike.designer@nexora.io",
  "firstName": "Mike",
  "lastName": "Designer",
  "role": "designer",
  "phone": "+1-555-0105",
  "department": "Design"
}
```

**For Repeated Testing**: `mike.designer.{timestamp}@nexora.io`

---

## Alternative Team Members - Extended Test Set

### Developer 2: Robert Backend
```json
{
  "email": "robert.backend@nexora.io",
  "firstName": "Robert",
  "lastName": "Backend",
  "role": "developer",
  "phone": "+1-555-0201",
  "department": "Engineering"
}
```

### Developer 3: Lisa Frontend
```json
{
  "email": "lisa.frontend@nexora.io",
  "firstName": "Lisa",
  "lastName": "Frontend",
  "role": "developer",
  "phone": "+1-555-0202",
  "department": "Engineering"
}
```

### Manager 2: David Sales
```json
{
  "email": "david.sales@nexora.io",
  "firstName": "David",
  "lastName": "Sales",
  "role": "manager",
  "phone": "+1-555-0203",
  "department": "Sales"
}
```

### HR 2: Jennifer Recruiting
```json
{
  "email": "jennifer.recruiting@nexora.io",
  "firstName": "Jennifer",
  "lastName": "Recruiting",
  "role": "hr",
  "phone": "+1-555-0204",
  "department": "Human Resources"
}
```

### Employee 1: Tom Employee
```json
{
  "email": "tom.employee@nexora.io",
  "firstName": "Tom",
  "lastName": "Employee",
  "role": "employee",
  "phone": "+1-555-0205",
  "department": "Operations"
}
```

---

## Test Scenarios

### Scenario 1: Minimal Setup
**Description**: Single admin, no team members

```
- Admin: Alex Admin
- Organization: Tech Startup Inc
- Team Members: 0
- Total Users: 1
```

### Scenario 2: Small Team
**Description**: Admin + 4 team members

```
- Admin: Alex Admin
- Organization: Tech Startup Inc
- Team Members:
  1. John Manager
  2. Sarah Developer
  3. Emily HR
  4. Mike Designer
- Total Users: 5
```

### Scenario 3: Medium Team
**Description**: Admin + 8 team members with various roles

```
- Admin: Alex Admin
- Organization: Global Consulting Group
- Team Members:
  1. John Manager
  2. Sarah Developer
  3. Emily HR
  4. Mike Designer
  5. Robert Backend
  6. Lisa Frontend
  7. David Sales
  8. Jennifer Recruiting
- Total Users: 9
```

### Scenario 4: Large Organization
**Description**: Admin + 15+ team members

```
- Admin: Alex Admin
- Organization: Fortune 500 Corp
- Team Members: 15+ (use above + create additional as needed)
- Total Users: 16+
```

---

## Email Addresses - Invalid Test Cases

### Invalid Format
```
- test (no @)
- test@ (no domain)
- @example.com (no local part)
- test@.com (no domain name)
- test..name@example.com (double dot)
- test@example..com (double dot in domain)
```

### Special Cases
```
- test@localhost (no TLD)
- test@domain.c (single char TLD)
- very.long.email.address.with.many.dots@subdomain.example.com (may work, test length limits)
```

---

## Passwords & Secrets (For API Testing)

### JWT Tokens (Sample Structure)
```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "sub": "user_id",
  "email": "admin.test@nexora.io",
  "org": "org_id",
  "role": "admin",
  "iat": 1704067200,
  "exp": 1704153600
}
```

### Sample Access Token (Expired - for testing)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MzY4YzE0ZWZhMDgyNTAwMDEwODcyYWUiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwib3JnIjoiNjM2OGMxNGVmYTA4MjUwMDAxMDg3MmFmIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MDQxNTM2MDB9.signature
```

---

## API Request/Response Examples

### Send OTP Request
```bash
curl -X POST http://localhost:3001/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin.test@nexora.io"
  }'
```

**Expected Response**:
```json
{
  "status": 200,
  "message": "OTP sent successfully",
  "data": {
    "email": "admin.test@nexora.io",
    "expiresIn": 600
  }
}
```

---

### Verify OTP Request
```bash
curl -X POST http://localhost:3001/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin.test@nexora.io",
    "otp": "000000"
  }'
```

**Expected Response**:
```json
{
  "status": 200,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "_id": "user_id",
      "email": "admin.test@nexora.io",
      "firstName": "Alex",
      "lastName": "Admin",
      "isActive": true
    },
    "organization": {
      "_id": "org_id",
      "name": "Tech Startup Inc"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "refresh_token",
      "expiresIn": 900
    }
  }
}
```

---

### Create Organization Request
```bash
curl -X POST http://localhost:3001/auth/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer access_token" \
  -d '{
    "name": "Tech Startup Inc",
    "type": "Product Company",
    "size": "11-50",
    "country": "United States",
    "timezone": "America/New_York"
  }'
```

**Expected Response**:
```json
{
  "status": 201,
  "message": "Organization created successfully",
  "data": {
    "_id": "org_id",
    "name": "Tech Startup Inc",
    "type": "Product Company",
    "size": "11-50",
    "country": "United States",
    "timezone": "America/New_York",
    "owner": "user_id",
    "createdAt": "2026-04-01T10:00:00Z"
  }
}
```

---

### Invite Team Member Request
```bash
curl -X POST http://localhost:3001/auth/organizations/org_id/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer access_token" \
  -d '{
    "email": "john.manager@nexora.io",
    "firstName": "John",
    "lastName": "Manager",
    "role": "manager"
  }'
```

**Expected Response**:
```json
{
  "status": 200,
  "message": "Invitation sent successfully",
  "data": {
    "_id": "membership_id",
    "email": "john.manager@nexora.io",
    "firstName": "John",
    "lastName": "Manager",
    "role": "manager",
    "status": "invited",
    "invitedAt": "2026-04-01T10:05:00Z"
  }
}
```

---

### Get Organization Members Request
```bash
curl -X GET http://localhost:3001/auth/organizations/org_id/members \
  -H "Authorization: Bearer access_token"
```

**Expected Response**:
```json
{
  "status": 200,
  "message": "Members retrieved successfully",
  "data": [
    {
      "_id": "membership_id_1",
      "user": {
        "_id": "user_id_1",
        "firstName": "Alex",
        "lastName": "Admin",
        "email": "admin.test@nexora.io"
      },
      "role": "admin",
      "status": "active",
      "joinedAt": "2026-04-01T10:00:00Z"
    },
    {
      "_id": "membership_id_2",
      "user": {
        "_id": "user_id_2",
        "firstName": "John",
        "lastName": "Manager",
        "email": "john.manager@nexora.io"
      },
      "role": "manager",
      "status": "pending",
      "invitedAt": "2026-04-01T10:05:00Z"
    }
  ],
  "total": 2
}
```

---

## Database Test Queries

### Find All Users in Organization
```javascript
db.users.find({ organizations: ObjectId("org_id") })
```

### Find All Organization Memberships
```javascript
db.orgmemberships.find({ organizationId: ObjectId("org_id") })
```

### Find User by Email
```javascript
db.users.findOne({ email: "admin.test@nexora.io" })
```

### Count Members by Role
```javascript
db.orgmemberships.aggregate([
  { $match: { organizationId: ObjectId("org_id") } },
  { $group: { _id: "$role", count: { $sum: 1 } } }
])
```

### Check Default Roles Created
```javascript
db.roles.find({ organizationId: ObjectId("org_id") })
```

### Find All Pending Invitations
```javascript
db.orgmemberships.find({
  organizationId: ObjectId("org_id"),
  status: "pending"
})
```

---

## Performance Baseline

### Expected Response Times
```
Send OTP: < 2 seconds
Verify OTP: < 2 seconds
Create Organization: < 2 seconds
Invite Member: < 1 second
Get Members: < 500ms
Update Member: < 1 second
```

### Expected Database Sizes
```
After 1 admin: ~1 KB
After 5 users: ~5 KB
After 100 users: ~100 KB
```

---

## File Upload Test Data

### Profile Picture (Optional)
```
File: profile-pic.jpg
Size: < 5 MB
Format: JPG/PNG
Dimensions: Any (will be resized)
```

### Organization Logo (Optional)
```
File: org-logo.png
Size: < 2 MB
Format: PNG with transparency
Dimensions: Square preferred (500x500+)
```

---

## Test Data Cleanup

### After Each Test
```bash
# Delete test organization and its data
db.organizations.deleteOne({ name: "Tech Startup Inc" })
db.users.deleteMany({ email: { $regex: "test@nexora.io" } })
db.orgmemberships.deleteMany({ organizationId: ObjectId("org_id") })
db.roles.deleteMany({ organizationId: ObjectId("org_id") })
```

### Keep for Future Runs
```
- Keep template data
- Keep test users with unique timestamps
- Keep organizations from other scenarios
```

---

## Notes for Test Data Usage

1. **Unique Emails**: When running tests repeatedly, use timestamp:
   ```
   admin.test.{Date.now()}@nexora.io
   ```

2. **OTP in Development**: 
   - Use `000000` for consistent testing
   - Check `.env` for `DEV_OTP` setting

3. **Timezone Handling**:
   - Auto-detect on frontend (browser timezone)
   - Allow override in form
   - Store in UTC in database

4. **Role Assignment**:
   - Only use roles that exist for organization
   - Default roles: admin, hr, manager, developer, designer, employee
   - Custom roles can be created by organization

5. **Email Testing**:
   - Use MailHog at `localhost:8025` to view sent emails
   - Emails sent but not received? Check SMTP configuration
   - Check spam folder in test email services

---

**Last Updated**: April 1, 2026  
**Version**: 1.0.0
