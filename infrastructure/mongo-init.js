db.createDatabase("nexora");
db = db.getSiblingDB("nexora");

// Create collections
db.createCollection("users");
db.createCollection("employees");
db.createCollection("departments");
db.createCollection("teams");
db.createCollection("designations");
db.createCollection("roles");
db.createCollection("permissions");
db.createCollection("attendance");
db.createCollection("leaves");
db.createCollection("projects");
db.createCollection("tasks");
db.createCollection("boards");
db.createCollection("sprints");
db.createCollection("clients");
db.createCollection("invoices");
db.createCollection("expenses");
db.createCollection("payroll-policies");
db.createCollection("payslips");
db.createCollection("documents");
db.createCollection("assets");
db.createCollection("candidates");
db.createCollection("notifications");
db.createCollection("sessions");
db.createCollection("audit-logs");

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ employeeId: 1 });
db.users.createIndex({ isDeleted: 1 });

db.employees.createIndex({ userId: 1 });
db.employees.createIndex({ departmentId: 1 });
db.employees.createIndex({ reportingManagerId: 1 });

db.attendance.createIndex({ employeeId: 1, date: 1 }, { unique: true });
db.attendance.createIndex({ date: 1 });
db.attendance.createIndex({ status: 1 });

db.leaves.createIndex({ employeeId: 1, year: 1 });
db.leaves.createIndex({ status: 1 });
db.leaves.createIndex({ startDate: 1, endDate: 1 });

db.projects.createIndex({ clientId: 1 });
db.projects.createIndex({ status: 1 });
db.projects.createIndex({ createdAt: 1 });

db.tasks.createIndex({ projectId: 1 });
db.tasks.createIndex({ assigneeId: 1 });
db.tasks.createIndex({ status: 1 });
db.tasks.createIndex({ dueDate: 1 });

db.invoices.createIndex({ clientId: 1 });
db.invoices.createIndex({ status: 1 });
db.invoices.createIndex({ createdAt: 1 });

db.audit-logs.createIndex({ userId: 1, createdAt: -1 });
db.audit-logs.createIndex({ resourceType: 1, resourceId: 1 });
db.audit-logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired sessions

// Policy Service
db = db.getSiblingDB('nexora_policies');
db.createCollection('policies');
db.createCollection('policyacknowledgements');
db.policies.createIndex({ organizationId: 1, isDeleted: 1 });
db.policies.createIndex({ category: 1 });
db.policies.createIndex({ isTemplate: 1 });
db.policies.createIndex({ isLatestVersion: 1, isDeleted: 1 });
db.policies.createIndex({ organizationId: 1, category: 1, isActive: 1, isLatestVersion: 1 });
db.policyacknowledgements.createIndex({ policyId: 1, employeeId: 1 }, { unique: true });

console.log("Nexora database initialized successfully!");
