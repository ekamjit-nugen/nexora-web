# Wave 3: Quick Start Guide

**Last Updated:** March 31, 2026  
**Status:** Ready for Integration

---

## 🚀 Getting Started in 5 Minutes

### Step 1: Understand the Architecture

Wave 3 adds **per-project roles** and **advanced project management** on top of organization roles.

```
Organization Level        Project Level
─────────────────────────────────────────
admin                  → Can be admin on Project A
                       → Can be developer on Project B

platform_admin         → Can access ALL projects
```

### Step 2: Key Files to Review

| Purpose | File | Lines | Focus |
|---------|------|-------|-------|
| **Schemas** | `project-member.schema.ts` | 50 | ProjectMember model |
| **Permissions** | `permissions.ts` | 120 | Permission matrix |
| **Features** | `wave3-methods.ts` | 280 | CRUD operations |
| **API** | `wave3.controller.ts` | 220 | REST endpoints |
| **Guards** | `project-access.guard.ts` | 60 | Access control |
| **Tests** | `wave3.test.ts` | 430 | Usage examples |

### Step 3: Permission Matrix Quick Reference

```
ROLE       canCreate  canEdit  canDelete  canManage  canDelete  canView
           Task       Task     Task       Members    Project    Analytics
───────────────────────────────────────────────────────────────────────
admin      ✅         ✅       ✅         ✅         ✅         ✅
lead       ✅         ✅       ❌         ❌         ❌         ✅
developer  ✅         ✅       ❌         ❌         ❌         ❌
viewer     ❌         ❌       ❌         ❌         ❌         ✅
```

### Step 4: Common Use Cases

#### Add a user to a project
```typescript
await wave3Service.addProjectMember(projectId, {
  userId: 'user-123',
  role: 'developer'  // or 'admin', 'lead', 'viewer'
}, currentUserId);
```

#### Change project visibility
```typescript
await wave3Service.updateProjectVisibility(projectId, {
  visibility: 'private'  // or 'public', 'restricted'
});
```

#### Create a project component
```typescript
await wave3Service.addComponent(projectId, {
  name: 'Authentication Module',
  lead: 'user-456',
  defaultAssignee: 'user-789'
});
```

#### Create a release
```typescript
await wave3Service.createRelease(projectId, {
  name: 'v2.1.0',
  releaseDate: '2026-04-15',
  status: 'planned'
});
```

---

## 📡 API Endpoint Cheat Sheet

### Project Members (5 endpoints)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/projects/:id/members` | Add member |
| GET | `/projects/:id/members` | List members |
| GET | `/projects/:id/members/:userId` | Get member |
| PUT | `/projects/:id/members/:userId` | Update role |
| DELETE | `/projects/:id/members/:userId` | Remove member |

**Example:**
```bash
# Add admin to project
curl -X POST http://api/projects/proj-123/members \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "role": "admin"
  }'
```

### Visibility (1 endpoint)

| Method | Endpoint | Action |
|--------|----------|--------|
| PUT | `/projects/:id/visibility` | Set visibility |

**Example:**
```bash
curl -X PUT http://api/projects/proj-123/visibility \
  -H "Authorization: Bearer TOKEN" \
  -d '{"visibility": "private"}'
```

### Components (4 endpoints)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/projects/:id/components` | Create |
| GET | `/projects/:id/components` | List |
| PUT | `/projects/:id/components/:compId` | Update |
| DELETE | `/projects/:id/components/:compId` | Delete |

### Releases (4 endpoints)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/projects/:id/releases` | Create |
| GET | `/projects/:id/releases` | List |
| PUT | `/projects/:id/releases/:relId` | Update |
| DELETE | `/projects/:id/releases/:relId` | Delete |

### Task Cloning (1 endpoint)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/projects/:id/tasks/:taskId/clone` | Clone task |

---

## 🔐 Permission Checks

### Check if user can perform action
```typescript
const canDelete = await permissionsService.canAccessProject(
  userId,
  projectId,
  'deleteTask',  // permission key
  orgRole        // optional, user's org role
);
```

### Get all permissions for a role
```typescript
const perms = permissionsService.getPermissionsForRole('developer');
// Returns: { createTask: true, editTask: true, deleteTask: false, ... }
```

### Get user's role in project
```typescript
const role = await permissionsService.getUserProjectRole(
  userId,
  projectId
);
// Returns: 'admin' | 'lead' | 'developer' | 'viewer' | null
```

---

## 📝 Request/Response Formats

### Add Project Member
```json
// REQUEST
{
  "userId": "user-123",
  "role": "developer",
  "permissions": []  // optional
}

// RESPONSE
{
  "success": true,
  "message": "Member added to project",
  "data": {
    "_id": "member-id",
    "projectId": "proj-123",
    "userId": "user-123",
    "role": "developer",
    "addedAt": "2026-03-31T10:00:00Z",
    "addedBy": "user-456"
  }
}
```

### Update Visibility
```json
// REQUEST
{
  "visibility": "private"  // "public" | "private" | "restricted"
}

// RESPONSE
{
  "success": true,
  "message": "Project visibility updated",
  "data": {
    "_id": "proj-123",
    "visibility": "private",
    // ... other project fields
  }
}
```

### Create Component
```json
// REQUEST
{
  "name": "Auth Module",
  "description": "Authentication system",
  "lead": "user-456",
  "defaultAssignee": "user-789",
  "color": "#FF5733"
}

// RESPONSE
{
  "success": true,
  "message": "Component created",
  "data": [
    {
      "_id": "comp-123",
      "name": "Auth Module",
      "description": "Authentication system",
      "lead": "user-456",
      "defaultAssignee": "user-789",
      "color": "#FF5733"
    }
  ]
}
```

### Create Release
```json
// REQUEST
{
  "name": "v2.1.0",
  "description": "Major feature release",
  "releaseDate": "2026-04-15T00:00:00Z",
  "status": "planned"
}

// RESPONSE
{
  "success": true,
  "message": "Release created",
  "data": [
    {
      "_id": "rel-123",
      "name": "v2.1.0",
      "description": "Major feature release",
      "releaseDate": "2026-04-15T00:00:00Z",
      "status": "planned"
    }
  ]
}
```

---

## 🧪 Running Tests

### Run all Wave 3 tests
```bash
cd services/project-service
npm test -- wave3.test.ts
```

### Run specific test suite
```bash
npm test -- wave3.test.ts --testNamePattern="Per-Project Role"
```

### Watch mode (during development)
```bash
npm test -- wave3.test.ts --watch
```

---

## 🛠️ Common Tasks

### Making a user admin of a project
```typescript
async function promoteToAdmin(projectId, userId, currentUser) {
  return await wave3Service.updateProjectMember(
    projectId,
    userId,
    { role: 'admin' }
  );
}
```

### Making a project private
```typescript
async function makePrivate(projectId) {
  return await wave3Service.updateProjectVisibility(
    projectId,
    { visibility: 'private' }
  );
}
```

### Removing a user from a project
```typescript
async function removeUser(projectId, userId) {
  return await wave3Service.removeProjectMember(projectId, userId);
}
```

### Creating a release
```typescript
async function createV2Release(projectId) {
  return await wave3Service.createRelease(projectId, {
    name: 'v2.0.0',
    description: 'Major release',
    releaseDate: new Date('2026-05-01'),
    status: 'planned'
  });
}
```

---

## ⚠️ Important Notes

### Platform Admin Always Has Access
Platform admin users bypass all visibility and membership checks.

### Visibility Changes Affect Access
When you change a project from public to private, non-members immediately lose access.

### Permission Matrix is Fixed
The permission matrix is hardcoded per role. Custom permissions array exists but isn't used yet.

### Task Service Integration Pending
Task cloning and component/release assignment require task-service implementation.

### Migration Required
Run migration script for projects created before Wave 3:
```typescript
// Projects with team[] field need to migrate to ProjectMember collection
```

---

## 🚨 Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 400 | Bad request | Check request body format |
| 403 | Forbidden | User lacks permission for action |
| 404 | Not found | ProjectId, userId, or component doesn't exist |
| 409 | Conflict | User already a member of project |

**Example Error:**
```json
{
  "statusCode": 403,
  "message": "You do not have access to this project",
  "error": "Forbidden"
}
```

---

## 📊 Data Model Quick Reference

### ProjectMember
```typescript
{
  _id: ObjectId;
  projectId: string;
  userId: string;
  role: 'admin' | 'lead' | 'developer' | 'viewer';
  permissions: string[];  // Custom overrides (future)
  addedAt: Date;
  addedBy: string;
  updatedAt: Date;
}
```

### Project (Added Fields)
```typescript
{
  // ... existing fields
  visibility: 'public' | 'private' | 'restricted';
  components: [{
    _id: ObjectId;
    name: string;
    description?: string;
    lead?: string;
    defaultAssignee?: string;
    color?: string;
  }];
  releases: [{
    _id: ObjectId;
    name: string;
    description?: string;
    releaseDate?: Date;
    status: 'planned' | 'in_progress' | 'released' | 'archived';
    startDate?: Date;
    releasedDate?: Date;
    releaseNotes?: string;
    issues: string[];
  }];
}
```

---

## 💡 Tips & Tricks

1. **Bulk add members:** Loop and call `addProjectMember()` for each user
2. **Check permissions:** Use `canAccessProject()` before allowing operations
3. **Get accessible projects:** Use `getAccessibleProjects()` for user's filtered list
4. **Component leads:** Set `lead` to auto-assign tasks when component is selected
5. **Release notes:** Use markdown format in `releaseNotes` field

---

## 📚 Additional Resources

- Full Documentation: `WAVE-3-COMPLETION.md`
- Technical Details: `WAVE-3-IMPLEMENTATION-SUMMARY.md`
- Status Report: `WAVE-3-STATUS.md`
- Test Examples: `wave3.test.ts`

---

## ✅ Checklist Before Going Live

- [ ] Read `WAVE-3-COMPLETION.md` 
- [ ] Understand permission matrix
- [ ] Review `wave3.test.ts` for examples
- [ ] Run tests locally
- [ ] Integration test with auth-service
- [ ] Deploy to staging
- [ ] Test all permission scenarios
- [ ] Deploy frontend changes
- [ ] Monitor for permission errors
- [ ] Document for team

---

**Ready to integrate Wave 3?**  
Start with the test file to understand how to use the API, then integrate with your frontend!

**Questions?** Check `WAVE-3-COMPLETION.md` for detailed documentation.
