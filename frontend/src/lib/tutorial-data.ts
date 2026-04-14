export interface TutorialStep {
  title: string;
  description: string;
  tip?: string;
}

export interface Tutorial {
  id: string;
  section: string;
  sectionIcon: string;
  sectionColor: string;
  title: string;
  description: string;
  duration: number;
  audience: 'admin' | 'manager' | 'employee' | 'all';
  steps: TutorialStep[];
  proTips: string[];
  relatedIds: string[];
}

export interface TutorialSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  tutorials: Tutorial[];
}

const SECTIONS = {
  getting_started: { title: 'Getting Started', icon: '🚀', color: '#2E86C1' },
  people_hr: { title: 'People & HR', icon: '👥', color: '#8B5CF6' },
  time_attendance: { title: 'Time & Attendance', icon: '⏰', color: '#10B981' },
  work_projects: { title: 'Work & Projects', icon: '📋', color: '#3B82F6' },
  payroll_finance: { title: 'Payroll & Finance', icon: '💰', color: '#F59E0B' },
  communication: { title: 'Communication', icon: '💬', color: '#EC4899' },
  it_assets: { title: 'IT Assets', icon: '💻', color: '#06B6D4' },
  knowledge_base: { title: 'Knowledge Base', icon: '📚', color: '#8B5CF6' },
  performance: { title: 'Performance & Engagement', icon: '🎯', color: '#EF4444' },
};

export const TUTORIALS: Tutorial[] = [
  // ── Getting Started ──
  {
    id: 'setup-organization',
    section: 'getting_started', sectionIcon: SECTIONS.getting_started.icon, sectionColor: SECTIONS.getting_started.color,
    title: 'Setting Up Your Organization',
    description: 'Configure your company profile, logo, and basic business details in Nexora.',
    duration: 5, audience: 'admin',
    steps: [
      { title: 'Open Organization Settings', description: 'Click "Settings" in the bottom-left of the sidebar, then select "Organization" from the settings menu.' },
      { title: 'Enter Company Details', description: 'Fill in your company name, registered address, industry type, and company size. These details appear on invoices and official documents.' },
      { title: 'Upload Your Logo', description: 'Click the logo placeholder and upload your company logo (PNG or SVG recommended, max 2MB). This appears in the sidebar, payslips, and client portal.' },
      { title: 'Set Business Information', description: 'Navigate to Settings > Business and enter your PAN, TAN, GST number, and registered office address. This is required for payroll statutory compliance.' },
      { title: 'Configure Branding', description: 'Go to Settings > Branding to set your primary color, which themes the entire application. You can also set a favicon and email header logo.' },
      { title: 'Save and Verify', description: 'Click "Save Changes" and verify your company name appears in the sidebar header. Your organization is now configured.', tip: 'You can update these details anytime from the same settings page.' },
    ],
    proTips: [
      'Complete branding setup before inviting employees — first impressions matter.',
      'Use your brand\'s primary color for a consistent look across the platform.',
      'The business details (PAN, TAN, GST) are critical for payroll — set them up before your first payroll run.',
    ],
    relatedIds: ['add-departments', 'invite-members', 'configure-features'],
  },
  {
    id: 'add-departments',
    section: 'getting_started', sectionIcon: SECTIONS.getting_started.icon, sectionColor: SECTIONS.getting_started.color,
    title: 'Adding Departments & Designations',
    description: 'Create your organizational structure with departments and job designations.',
    duration: 3, audience: 'admin',
    steps: [
      { title: 'Navigate to Departments', description: 'Click "Departments" under the PEOPLE section in the sidebar. You\'ll see an empty list if this is a fresh setup.' },
      { title: 'Create a Department', description: 'Click the "Add Department" button. Enter the department name (e.g., "Engineering", "Human Resources"), an optional description, and select a department head if one exists.' },
      { title: 'Add More Departments', description: 'Repeat for all your departments. Common ones: Engineering, Design, QA, HR, Finance, Sales, Marketing, Operations.' },
      { title: 'Set Up Designations', description: 'Go to Settings > Organization and look for the Designations section. Add job titles like "Software Engineer", "Senior Developer", "Project Manager", "HR Executive".' },
      { title: 'Assign Department Heads', description: 'Edit each department and select the head/lead. This person will receive leave approval requests and manage their team.' },
    ],
    proTips: [
      'Keep department names consistent — "Engineering" not "Engg" or "Dev Team".',
      'Department heads automatically become leave approvers for their team members.',
      'You can add sub-teams within departments later for more granular organization.',
    ],
    relatedIds: ['setup-organization', 'invite-members', 'employee-directory'],
  },
  {
    id: 'invite-members',
    section: 'getting_started', sectionIcon: SECTIONS.getting_started.icon, sectionColor: SECTIONS.getting_started.color,
    title: 'Inviting Team Members',
    description: 'Add employees to your organization and send them login invitations.',
    duration: 3, audience: 'admin',
    steps: [
      { title: 'Go to Employee Directory', description: 'Click "Directory" under the PEOPLE section in the sidebar.' },
      { title: 'Click Add Employee', description: 'Click the "Add Employee" button in the top-right corner. A form will open.' },
      { title: 'Fill Employee Details', description: 'Enter first name, last name, email, phone number, department, designation, employment type (full-time/part-time/contract), and joining date.' },
      { title: 'Set Role & Permissions', description: 'Assign an organization role: Employee (basic access), Manager (team management, approvals), Admin (full platform access), or HR (payroll and people management).' },
      { title: 'Send Invitation', description: 'Click "Create Employee". An invitation email is automatically sent to their email address with a link to set their password and log in.' },
      { title: 'Verify Invitation', description: 'The new employee appears in the directory with an "Invited" status badge. Once they accept and log in, the status changes to "Active".', tip: 'You can resend the invitation from the employee\'s profile if they didn\'t receive it.' },
    ],
    proTips: [
      'Bulk invites: You can add multiple employees quickly by repeating this process.',
      'Set up departments first — it\'s easier to assign employees to existing departments.',
      'Employees with "Manager" role can approve leaves and view their direct reports\' data.',
    ],
    relatedIds: ['add-departments', 'employee-directory', 'manage-profiles'],
  },
  {
    id: 'configure-features',
    section: 'getting_started', sectionIcon: SECTIONS.getting_started.icon, sectionColor: SECTIONS.getting_started.color,
    title: 'Configuring Features',
    description: 'Enable or disable Nexora modules based on what your organization needs.',
    duration: 2, audience: 'admin',
    steps: [
      { title: 'Open Feature Settings', description: 'Go to Settings > Features from the sidebar. You\'ll see a list of all available modules with toggle switches.' },
      { title: 'Review Available Modules', description: 'Each module can be toggled on or off: Projects, Tasks, Sprints, Timesheets, Attendance, Leaves, Clients, Invoices, Reports, Chat, Calls, AI.' },
      { title: 'Enable Needed Modules', description: 'Toggle on the modules your organization uses. Disabled modules are hidden from the sidebar and inaccessible to all users.' },
      { title: 'Save Configuration', description: 'Click "Save" to apply. The sidebar will immediately update to show only enabled modules.', tip: 'You can enable new modules anytime as your team grows — no data is lost when toggling.' },
    ],
    proTips: [
      'Start with core modules (Attendance, Leaves, Projects) and enable more as your team adapts.',
      'Disabling a module hides it but preserves all data — you can re-enable it anytime.',
      'Chat and Calls require separate setup for WebSocket connections.',
    ],
    relatedIds: ['setup-organization', 'setup-policies'],
  },
  {
    id: 'setup-policies',
    section: 'getting_started', sectionIcon: SECTIONS.getting_started.icon, sectionColor: SECTIONS.getting_started.color,
    title: 'Setting Up Policies',
    description: 'Create company policies for leave, attendance, work hours, and more.',
    duration: 3, audience: 'admin',
    steps: [
      { title: 'Navigate to Policies', description: 'Click "Policies" under the ADMIN section in the sidebar.' },
      { title: 'Create a New Policy', description: 'Click "Create Policy". Select the policy type: Leave Policy, Attendance Policy, Work Hours Policy, or General Policy.' },
      { title: 'Define Policy Rules', description: 'For leave policies: set leave types (casual, sick, earned), annual quotas, carry-forward rules, and approval workflow. For attendance: set grace period, half-day rules, and overtime thresholds.' },
      { title: 'Assign to Employees', description: 'Select which employees or departments this policy applies to. You can have different policies for different departments.' },
      { title: 'Publish the Policy', description: 'Click "Publish" to make the policy active. Employees in the assigned group will immediately see the policy reflected in their leave balances and attendance rules.' },
    ],
    proTips: [
      'Create separate leave policies for probation vs confirmed employees.',
      'Set grace periods in attendance policy to avoid penalizing minor delays (e.g., 10 minutes).',
      'Employees can view their assigned policies from their profile page.',
    ],
    relatedIds: ['configure-features', 'apply-leave', 'mark-attendance'],
  },

  // ── People & HR ──
  {
    id: 'employee-directory',
    section: 'people_hr', sectionIcon: SECTIONS.people_hr.icon, sectionColor: SECTIONS.people_hr.color,
    title: 'Employee Directory Overview',
    description: 'Browse, search, and filter your organization\'s employee directory.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Open the Directory', description: 'Click "Directory" under the PEOPLE section in the sidebar. You\'ll see all active employees displayed as cards or in a list view.' },
      { title: 'Search for Employees', description: 'Use the search bar at the top to find employees by name, email, or employee ID. Results filter in real-time as you type.' },
      { title: 'Filter by Department', description: 'Use the department dropdown filter to view employees in a specific department (e.g., Engineering, HR, Finance).' },
      { title: 'View Employee Cards', description: 'Each card shows the employee\'s avatar, name, designation, department, email, and phone. Click any card to view their full profile.' },
      { title: 'Check Stats', description: 'The top of the page shows summary stats: total employees, active, on notice period, and new joiners this month.' },
    ],
    proTips: [
      'The directory respects role-based access — employees see basic info, managers see more details for their reports.',
      'Use the directory to quickly find a colleague\'s phone number or email.',
    ],
    relatedIds: ['manage-profiles', 'org-chart', 'invite-members'],
  },
  {
    id: 'manage-profiles',
    section: 'people_hr', sectionIcon: SECTIONS.people_hr.icon, sectionColor: SECTIONS.people_hr.color,
    title: 'Managing Employee Profiles',
    description: 'View and edit employee details including personal info, bank details, and documents.',
    duration: 4, audience: 'admin',
    steps: [
      { title: 'Open an Employee Profile', description: 'Go to Directory and click on any employee card to open their full profile page.' },
      { title: 'View Personal Information', description: 'The profile shows personal details (DOB, gender, contact), employment details (joining date, department, designation), and reporting manager.' },
      { title: 'Edit Employee Details', description: 'Click the "Edit" button to modify any field. Changes are saved immediately and logged in the activity trail.' },
      { title: 'Manage Bank Details', description: 'Scroll to the Bank Details section to add or update the employee\'s bank account number, IFSC code, and account holder name. This is used for salary payouts.' },
      { title: 'Upload Documents', description: 'Use the Documents section to upload ID proofs, offer letters, and other employment documents. Each document can be marked as "Verified" by HR.' },
    ],
    proTips: [
      'Bank details must be accurate before running payroll — verify them during onboarding.',
      'Employees can also update some of their own details from their profile page.',
      'Document verification creates an audit trail for compliance.',
    ],
    relatedIds: ['employee-directory', 'onboard-employee', 'salary-structures'],
  },
  {
    id: 'org-chart',
    section: 'people_hr', sectionIcon: SECTIONS.people_hr.icon, sectionColor: SECTIONS.people_hr.color,
    title: 'Understanding the Org Chart',
    description: 'Navigate your organization\'s reporting hierarchy visually.',
    duration: 2, audience: 'all',
    steps: [
      { title: 'Open Org Chart', description: 'Click "Org Chart" under the PEOPLE section in the sidebar.' },
      { title: 'Explore the Hierarchy', description: 'The org chart displays employees in a tree structure based on reporting manager relationships. The CEO/founder appears at the top.' },
      { title: 'Expand and Collapse', description: 'Click the expand/collapse arrows on any node to show or hide their direct reports.' },
      { title: 'Click for Details', description: 'Click on any person\'s card to see their designation, department, email, and a link to their full profile.' },
    ],
    proTips: [
      'The org chart is auto-generated from reporting manager assignments — keep those updated.',
      'Use this to understand who reports to whom before making leave/approval decisions.',
    ],
    relatedIds: ['employee-directory', 'add-departments'],
  },
  {
    id: 'onboard-employee',
    section: 'people_hr', sectionIcon: SECTIONS.people_hr.icon, sectionColor: SECTIONS.people_hr.color,
    title: 'Onboarding a New Employee',
    description: 'Complete the full onboarding process for a new hire — from profile creation to Day 1 readiness.',
    duration: 5, audience: 'admin',
    steps: [
      { title: 'Navigate to Onboarding', description: 'Go to "Onboarding" under the PAYROLL section in the sidebar.' },
      { title: 'Initiate Onboarding', description: 'Click "New Onboarding" and select the employee (they should already be created in the directory). An onboarding checklist is generated.' },
      { title: 'Complete the Checklist', description: 'Work through each checklist item: document collection (ID proof, address proof, photo), background check, bank details verification, IT asset assignment, and system access setup.' },
      { title: 'Track Document Verification', description: 'Mark each submitted document as "Verified" or "Pending". The onboarding won\'t be marked complete until all mandatory documents are verified.' },
      { title: 'Complete Onboarding', description: 'Once all checklist items are done, click "Complete Onboarding". The employee\'s status changes from "Probation" to "Active" (or stays in probation based on policy).' },
    ],
    proTips: [
      'Prepare the onboarding checklist before the employee\'s first day to ensure a smooth start.',
      'IT asset assignment during onboarding automatically links to the Asset Management module.',
      'Share the Knowledge Base wiki with new joiners — point them to the "Onboarding" space for self-service learning.',
    ],
    relatedIds: ['invite-members', 'manage-profiles', 'add-assign-assets'],
  },
  {
    id: 'offboard-employee',
    section: 'people_hr', sectionIcon: SECTIONS.people_hr.icon, sectionColor: SECTIONS.people_hr.color,
    title: 'Offboarding an Employee',
    description: 'Manage the complete exit process including clearance, asset return, and final settlement.',
    duration: 4, audience: 'admin',
    steps: [
      { title: 'Navigate to Offboarding', description: 'Go to "Offboarding" under the PAYROLL section in the sidebar.' },
      { title: 'Initiate Exit', description: 'Click "Initiate Offboarding", select the employee, enter the last working date, and the reason for leaving (resignation, termination, etc.).' },
      { title: 'Department Clearance', description: 'Each department (IT, Finance, HR, Admin) must clear the employee. The IT clearance automatically checks for unreturned assets from the Asset Management module.' },
      { title: 'Conduct Exit Interview', description: 'Fill in the exit interview section with the employee\'s feedback, reason for leaving, and any suggestions.' },
      { title: 'Final Settlement', description: 'Once all clearances are complete, the system calculates the Full & Final settlement: pending salary, leave encashment, deductions, and generates the F&F statement.' },
      { title: 'Complete Offboarding', description: 'Generate the experience letter and relieving letter, then mark the offboarding as complete. The employee\'s status changes to "Exited".' },
    ],
    proTips: [
      'IT clearance will be blocked if the employee has unreturned assets — ensure all hardware is collected.',
      'The F&F calculation integrates with payroll to account for all pending amounts.',
      'Keep exit interview data for attrition analysis — it feeds into the AI prediction model.',
    ],
    relatedIds: ['onboard-employee', 'view-my-assets', 'payroll-run'],
  },

  // ── Time & Attendance ──
  {
    id: 'mark-attendance',
    section: 'time_attendance', sectionIcon: SECTIONS.time_attendance.icon, sectionColor: SECTIONS.time_attendance.color,
    title: 'Marking Attendance',
    description: 'Clock in and out to record your daily attendance.',
    duration: 2, audience: 'employee',
    steps: [
      { title: 'Go to Attendance', description: 'Click "Attendance" under the TIME & ATTENDANCE section in the sidebar.' },
      { title: 'Clock In', description: 'Click the "Clock In" button when you start your workday. Your check-in time is recorded along with your location (if GPS tracking is enabled).' },
      { title: 'Clock Out', description: 'At the end of your workday, click "Clock Out". The system calculates your total working hours for the day.' },
      { title: 'View Your Attendance', description: 'Your monthly attendance summary shows present days, absent days, half days, late arrivals, and overtime hours in a calendar view.' },
    ],
    proTips: [
      'You can also clock in from the Dashboard — look for the attendance widget.',
      'If you forget to clock out, contact your manager or HR to manually adjust the record.',
      'Grace period (if configured) means minor delays won\'t count as late.',
    ],
    relatedIds: ['attendance-reports', 'apply-leave'],
  },
  {
    id: 'apply-leave',
    section: 'time_attendance', sectionIcon: SECTIONS.time_attendance.icon, sectionColor: SECTIONS.time_attendance.color,
    title: 'Applying for Leave',
    description: 'Request time off by submitting a leave application.',
    duration: 2, audience: 'employee',
    steps: [
      { title: 'Go to Leaves', description: 'Click "Leaves" under the TIME & ATTENDANCE section in the sidebar.' },
      { title: 'Check Your Balance', description: 'The top section shows your leave balance by type: Casual Leave, Sick Leave, Earned Leave, etc.' },
      { title: 'Apply for Leave', description: 'Click "Apply Leave". Select the leave type, start date, end date, and whether it\'s a full day or half day.' },
      { title: 'Add Reason', description: 'Enter a reason for the leave (required for most leave types). For sick leave, you may need to upload a medical certificate.' },
      { title: 'Submit Application', description: 'Click "Submit". Your leave request goes to your reporting manager for approval. You\'ll see it in "Pending" status.' },
    ],
    proTips: [
      'Check the team calendar before applying — it shows who else is on leave to avoid conflicts.',
      'Planned leaves should be applied at least 2-3 days in advance per most company policies.',
      'You\'ll receive a notification when your leave is approved or rejected.',
    ],
    relatedIds: ['approve-leaves', 'mark-attendance', 'setup-policies'],
  },
  {
    id: 'approve-leaves',
    section: 'time_attendance', sectionIcon: SECTIONS.time_attendance.icon, sectionColor: SECTIONS.time_attendance.color,
    title: 'Approving Leaves (Manager)',
    description: 'Review and approve or reject leave requests from your team members.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Open Leave Requests', description: 'Go to "Leaves" in the sidebar. Managers see a "Pending Requests" tab showing all unapproved leave applications from their direct reports.' },
      { title: 'Review the Request', description: 'Click on a leave request to see the details: employee name, leave type, dates, duration, reason, and current leave balance.' },
      { title: 'Check Team Calendar', description: 'Review the team calendar to see if other team members are already on leave during the requested dates. This helps avoid understaffing.' },
      { title: 'Approve or Reject', description: 'Click "Approve" to grant the leave or "Reject" with a comment explaining why. The employee is notified immediately.' },
    ],
    proTips: [
      'Approve leaves promptly — employees waiting for approval creates anxiety and planning uncertainty.',
      'If you\'re unavailable, you can delegate leave approvals from Settings > Work Preferences.',
      'The system automatically deducts approved leave from the employee\'s balance.',
    ],
    relatedIds: ['apply-leave', 'attendance-reports'],
  },
  {
    id: 'attendance-reports',
    section: 'time_attendance', sectionIcon: SECTIONS.time_attendance.icon, sectionColor: SECTIONS.time_attendance.color,
    title: 'Attendance Reports',
    description: 'View monthly attendance summaries and export reports.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Go to Attendance', description: 'Navigate to "Attendance" in the sidebar. Managers see the full team view.' },
      { title: 'Select Month', description: 'Use the month selector to view attendance for any month. The current month is shown by default.' },
      { title: 'View Summary', description: 'The summary shows: total present days, absents, half days, late marks, overtime hours, and average working hours per employee.' },
      { title: 'Export Report', description: 'Click "Export" to download the attendance report as a CSV file. This can be used for payroll processing or compliance records.' },
    ],
    proTips: [
      'Attendance data directly feeds into payroll — LOP (Loss of Pay) deductions are calculated automatically.',
      'Review attendance before running payroll to catch and correct any discrepancies.',
      'Overtime hours can be configured to auto-calculate based on attendance policy settings.',
    ],
    relatedIds: ['mark-attendance', 'payroll-run'],
  },

  // ── Work & Projects ──
  {
    id: 'create-project',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Creating Your First Project',
    description: 'Set up a new project with team, methodology, and configuration.',
    duration: 4, audience: 'manager',
    steps: [
      { title: 'Go to Projects', description: 'Click "Projects" under the WORK section in the sidebar.' },
      { title: 'Click New Project', description: 'Click the "New Project" button. A creation form opens.' },
      { title: 'Enter Project Details', description: 'Fill in: Project Name, Project Key (auto-generated short code, e.g., "PROJ"), description, category (web, mobile, API), and priority.' },
      { title: 'Choose Methodology', description: 'Select your project management approach: Scrum (sprint-based), Kanban (continuous flow), Scrumban (hybrid), or Waterfall (phase-gated).' },
      { title: 'Add Team Members', description: 'Search and add team members. Set each member\'s role (Lead, Developer, Designer, QA) and allocation percentage.' },
      { title: 'Configure Budget', description: 'Optionally set the billing type (Fixed, Time & Material, Retainer) and budget amount for profitability tracking.' },
      { title: 'Create Project', description: 'Click "Create". Your project is live with a default Kanban board. You can now start creating tasks.', tip: 'Use project templates to skip setup for common project types.' },
    ],
    proTips: [
      'Project Key is used in task IDs (e.g., PROJ-001) — keep it short and meaningful.',
      'Setting budget and billing type enables the Profitability Live Ticker.',
      'You can change methodology later from Project Settings, but it\'s best to decide upfront.',
    ],
    relatedIds: ['kanban-board', 'sprint-planning', 'project-profitability'],
  },
  {
    id: 'kanban-board',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Using the Kanban Board',
    description: 'Manage tasks visually with drag-and-drop columns and swimlanes.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Open Your Project Board', description: 'Go to Projects, click on your project. The Board view is the default tab showing columns like Backlog, To Do, In Progress, In Review, Done.' },
      { title: 'Create a Task', description: 'Click "+ Add Task" in any column, or use the "Create" button at the top. Enter the task title, type (Task, Bug, Story, Epic), assignee, and priority.' },
      { title: 'Drag Tasks Between Columns', description: 'Drag and drop task cards between columns to update their status. Moving a card to "Done" marks the task as completed.' },
      { title: 'Use Swimlanes', description: 'Click the swimlane toggle to group tasks by Assignee, Priority, Type, or Epic. This helps visualize workload distribution.' },
      { title: 'Set WIP Limits', description: 'From Project Settings > Board, set Work-In-Progress limits per column. When a column exceeds its limit, it\'s highlighted in red to prevent overloading.' },
    ],
    proTips: [
      'Keep "In Progress" WIP limit to 2-3 tasks per person to maintain focus.',
      'Use the Quick Filter bar to filter by assignee, priority, or label without leaving the board.',
      'Right-click a card for quick actions: assign, set priority, add to sprint, duplicate.',
    ],
    relatedIds: ['create-project', 'sprint-planning', 'timesheets'],
  },
  {
    id: 'sprint-planning',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Sprint Planning & Execution',
    description: 'Plan sprints, track velocity, and monitor progress with burndown charts.',
    duration: 5, audience: 'manager',
    steps: [
      { title: 'Open Planning View', description: 'In your project, switch to the "Planning" tab. You\'ll see the Backlog on the left and Sprint area on the right.' },
      { title: 'Create a Sprint', description: 'Click "Create Sprint". Set a sprint name (e.g., "Sprint 14"), goal, start date, and end date (typically 2 weeks).' },
      { title: 'Add Tasks to Sprint', description: 'Drag tasks from the Backlog into the Sprint, or select tasks and click "Move to Sprint". Set story point estimates for each task.' },
      { title: 'Start the Sprint', description: 'Click "Start Sprint". The sprint is now active and the burndown chart begins tracking progress.' },
      { title: 'Monitor Progress', description: 'During the sprint, check the Sprint detail page for: burndown chart, completed vs remaining story points, and task status breakdown.' },
      { title: 'Complete the Sprint', description: 'At sprint end, click "Complete Sprint". Choose what to do with incomplete tasks: move to backlog, move to next sprint, or force-complete.' },
    ],
    proTips: [
      'Velocity (story points completed per sprint) stabilizes after 3-4 sprints — use it for future planning.',
      'Don\'t overload sprints. A good rule: total story points = average velocity.',
      'Spillover from previous sprints is tracked separately to keep metrics honest.',
    ],
    relatedIds: ['kanban-board', 'project-reports', 'timesheets'],
  },
  {
    id: 'timesheets',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Tracking Time with Timesheets',
    description: 'Log hours against tasks and projects, then submit for approval.',
    duration: 3, audience: 'employee',
    steps: [
      { title: 'Go to Timesheets', description: 'Click "Timesheets" under the WORK section in the sidebar.' },
      { title: 'Create a Timesheet', description: 'Click "New Timesheet". Select the period (weekly is default). A table shows days of the week as columns.' },
      { title: 'Log Hours', description: 'For each day, click a cell and add an entry: select the project, task, category (development, design, meeting, review, testing), enter hours, and a brief description.' },
      { title: 'Review Totals', description: 'The bottom row shows daily totals and a weekly total. Expected hours (from your work preferences) are shown for comparison.' },
      { title: 'Submit for Approval', description: 'Click "Submit" to send your timesheet to your manager. Status changes from "Draft" to "Submitted".' },
    ],
    proTips: [
      'Log time daily — it\'s much more accurate than trying to remember at the end of the week.',
      'Timesheet hours feed into Project Profitability calculations — accurate logging matters.',
      'You can save a draft and come back to it before submitting.',
    ],
    relatedIds: ['kanban-board', 'project-profitability'],
  },
  {
    id: 'project-profitability',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Project Profitability',
    description: 'Track real-time project margins, costs, and ROI with the live profitability ticker.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Open Profitability Dashboard', description: 'Click "Profitability" under the WORK section in the sidebar. This shows portfolio-wide profitability across all projects.' },
      { title: 'View Project Margins', description: 'Each project card shows: revenue (from invoices), labor cost (from timesheets × salary rates), margin percentage, and burn rate per day.' },
      { title: 'Drill Into a Project', description: 'Click any project to see the detailed breakdown: cost by team member, cost by category (development, design, QA), overhead allocation, and daily burn rate.' },
      { title: 'Monitor Health Indicators', description: 'Green (margin ≥ 20%): healthy. Yellow (10-20%): warning. Red (< 10%): critical. Take action on red projects before they become loss-makers.' },
    ],
    proTips: [
      'Profitability requires: (1) project budget/billing set up, (2) timesheets logged, (3) salary structures configured.',
      'This is Nexora\'s killer differentiator — no competitor connects payroll costs to project revenue.',
      'Review profitability weekly in team leads meetings to catch margin erosion early.',
    ],
    relatedIds: ['create-project', 'timesheets', 'salary-structures'],
  },
  {
    id: 'bench-management',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Bench Management',
    description: 'Track unbilled developers, bench costs, and match skills to project needs.',
    duration: 4, audience: 'manager',
    steps: [
      { title: 'Open Bench Dashboard', description: 'Click "Bench" under the WORK section in the sidebar. The overview shows bench count, daily/monthly bench cost, and bench percentage.' },
      { title: 'View Bench Employees', description: 'Switch to the "Bench Employees" tab to see who\'s currently on bench. Each row shows: name, department, skills, days on bench, allocation %, and daily cost.' },
      { title: 'Create a Resource Request', description: 'Go to the "Resource Requests" tab and click "New Request". Select the project, enter required skills (e.g., React, Node.js), priority, and allocation percentage.' },
      { title: 'Review Matches', description: 'The system automatically scores bench employees against your requirements. Review suggested matches, their match scores, and approve or reject each.' },
      { title: 'Monitor Trends', description: 'The "Analytics" tab shows bench trends over time, average bench duration, and department-wise bench percentage bars.' },
    ],
    proTips: [
      'Bench cost = daily salary of unallocated employees. Reducing bench days directly improves profitability.',
      'Use skill-based matching to quickly find the right person for a new project, instead of calling team leads.',
      'Take daily snapshots to build trend data for executive reporting.',
    ],
    relatedIds: ['create-project', 'project-profitability', 'employee-directory'],
  },
  {
    id: 'project-reports',
    section: 'work_projects', sectionIcon: SECTIONS.work_projects.icon, sectionColor: SECTIONS.work_projects.color,
    title: 'Roadmap & Reports',
    description: 'View portfolio roadmap, velocity charts, and project analytics.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Open Roadmap', description: 'Click "Roadmap" under the WORK section. This shows a timeline view of all projects with their epics, milestones, and release dates.' },
      { title: 'View Work Reports', description: 'Click "Reports" under the WORK section. The portfolio-wide reports page shows: task distribution, velocity by project, team workload, and project health.' },
      { title: 'Project-Level Analytics', description: 'Inside any project, click the "Analytics" tab for detailed charts: velocity trend, burndown, cumulative flow, cycle time, and workload distribution.' },
      { title: 'Filter and Export', description: 'Use the project dropdown on the Reports page to focus on a single project. Charts can be used in stakeholder presentations.' },
    ],
    proTips: [
      'Velocity trend over 4+ sprints is the most reliable way to estimate future delivery dates.',
      'Cumulative flow diagram reveals bottlenecks — a growing "In Review" band means code review is a bottleneck.',
      'Share the Reports page with leadership for data-driven standups.',
    ],
    relatedIds: ['sprint-planning', 'project-profitability'],
  },

  // ── Payroll & Finance ──
  {
    id: 'salary-structures',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Setting Up Salary Structures',
    description: 'Define CTC breakdowns with components, statutory deductions, and tax configurations.',
    duration: 5, audience: 'admin',
    steps: [
      { title: 'Navigate to Salary Structure', description: 'Click "Salary Structure" under the PAYROLL section in the sidebar.' },
      { title: 'Create a Structure', description: 'Click "Create" and select an employee. Enter their annual CTC (Cost to Company) amount.' },
      { title: 'Configure Components', description: 'The system auto-generates components: Basic (40-50% of CTC), HRA (40-50% of Basic), Conveyance, Medical, Special Allowance. Adjust percentages as needed.' },
      { title: 'Review Statutory Deductions', description: 'The system auto-calculates: PF (12% of Basic up to ₹15,000), ESI (if applicable), Professional Tax (state-specific), and TDS based on tax slab.' },
      { title: 'Submit for Approval', description: 'Click "Submit". The salary structure goes through an approval workflow. Once approved, it becomes "Active" and will be used in the next payroll run.' },
    ],
    proTips: [
      'The CTC simulator lets you try different breakdowns before submitting — use it to optimize tax savings.',
      'Old vs New tax regime is automatically calculated — employees can choose their preferred regime in Declarations.',
      'Salary revisions create a new version — the old structure is preserved for historical records.',
    ],
    relatedIds: ['payroll-run', 'investment-declarations', 'project-profitability'],
  },
  {
    id: 'payroll-run',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Running Monthly Payroll',
    description: 'Process monthly payroll from draft to payment — the complete pipeline.',
    duration: 5, audience: 'admin',
    steps: [
      { title: 'Go to Payroll Runs', description: 'Click "Payroll Runs" under the PAYROLL section. You\'ll see a list of current and past payroll runs.' },
      { title: 'Create a New Run', description: 'Click "New Payroll Run". Select the month and year. The system creates a draft payroll run.' },
      { title: 'Process the Run', description: 'Click "Process". The system auto-computes each employee\'s salary: gross earnings, attendance-based deductions (LOP), statutory deductions (PF, ESI, TDS, PT), loan EMI deductions, and reimbursements.' },
      { title: 'Review Entries', description: 'Review each employee\'s payroll entry. Check for anomalies: unusually high deductions, missing attendance data, or zero net pay. Make corrections if needed.' },
      { title: 'Approve and Finalize', description: 'Move the run from "Review" to "Approved" to "Finalized". Each step requires explicit confirmation to prevent accidental payouts.' },
      { title: 'Initiate Payout', description: 'Click "Initiate Payout" to trigger bank transfers via Razorpay (NEFT/RTGS/IMPS). The system has idempotency protection to prevent double payments.' },
      { title: 'Generate Payslips', description: 'After payout, click "Generate Payslips" to create PDF payslips for all employees. They\'ll receive notifications to view their payslips.' },
    ],
    proTips: [
      'Always review attendance data before processing payroll — LOP deductions depend on it.',
      'Run payroll by the 25th to ensure salary credit by month-end.',
      'The system blocks re-processing a finalized run — create a new run for corrections.',
    ],
    relatedIds: ['salary-structures', 'view-payslips', 'attendance-reports'],
  },
  {
    id: 'view-payslips',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Viewing Payslips',
    description: 'Access your monthly payslips with earnings, deductions, and tax details.',
    duration: 2, audience: 'employee',
    steps: [
      { title: 'Go to My Payslips', description: 'Click "My Payslips" under the PAYROLL section in the sidebar.' },
      { title: 'Select a Month', description: 'You\'ll see a list of all your payslips. Click on any month to view the detailed payslip.' },
      { title: 'Review Details', description: 'The payslip shows: gross earnings (Basic, HRA, allowances), deductions (PF, ESI, TDS, PT, loan EMIs), employer contributions, and net payable amount.' },
      { title: 'Check YTD Totals', description: 'Scroll down to see Year-To-Date totals for gross, deductions, PF, ESI, TDS, and net pay — useful for tax planning.' },
      { title: 'Download PDF', description: 'Click "Download PDF" to save a copy of your payslip for personal records or bank loan applications.' },
    ],
    proTips: [
      'YTD totals help you estimate your annual tax liability and plan investments accordingly.',
      'If you notice any discrepancy, raise it with HR before the next payroll cycle.',
      'Payslips are generated after the payroll run is finalized — check after salary credit.',
    ],
    relatedIds: ['investment-declarations', 'payroll-run'],
  },
  {
    id: 'investment-declarations',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Investment Declarations',
    description: 'Declare tax-saving investments under 80C, 80D, HRA, and other sections.',
    duration: 3, audience: 'employee',
    steps: [
      { title: 'Go to Declarations', description: 'Click "Declarations" under the PAYROLL section in the sidebar.' },
      { title: 'Start a New Declaration', description: 'Click "New Declaration" or edit your existing one. The form shows sections: 80C, 80D, 80E, 80G, 24(b), and HRA.' },
      { title: 'Add Investments', description: 'Under each section, add your planned investments. For 80C: PPF, ELSS, LIC, tuition fees (up to ₹1.5 lakh). For 80D: health insurance premiums.' },
      { title: 'Submit Proof', description: 'Upload proof documents for each declaration. HR will verify the documents and mark them as verified or request resubmission.' },
      { title: 'Submit Declaration', description: 'Click "Submit". Your TDS will be recalculated based on declared investments, potentially reducing your monthly tax deduction.' },
    ],
    proTips: [
      'Submit declarations early in the financial year (April) for maximum TDS benefit throughout the year.',
      'The system supports both Old and New tax regimes — choose the one that saves you more.',
      'Proof submission deadline is typically January — submit documents before the HR verification window closes.',
    ],
    relatedIds: ['view-payslips', 'salary-structures'],
  },
  {
    id: 'expense-claims',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Submitting Expense Claims',
    description: 'Claim reimbursements for business expenses with receipt upload and AI-powered OCR.',
    duration: 3, audience: 'employee',
    steps: [
      { title: 'Go to Expenses', description: 'Click "Expenses" under the PAYROLL section in the sidebar.' },
      { title: 'Create New Claim', description: 'Click "New Claim". Select the category: Travel, Food, Medical, Internet, Phone, Office Supplies, Training, or Client Entertainment.' },
      { title: 'Add Expense Items', description: 'For each expense, enter: description, amount, date, and upload the receipt photo/PDF.' },
      { title: 'Use AI OCR', description: 'When you upload a receipt, the AI automatically extracts the merchant name, amount, and date. Review and correct if needed.', tip: 'Take clear, well-lit photos of receipts for best OCR accuracy.' },
      { title: 'Submit for Approval', description: 'Click "Submit". The claim goes through a multi-level approval: Manager → HR → Finance. Track approval status in real-time.' },
    ],
    proTips: [
      'Claims can be paid via payroll (added to next salary) or via separate bank transfer.',
      'Keep all original receipts until the claim is fully approved and paid.',
      'The AI OCR saves ~2 minutes per receipt — a big time saver for frequent travelers.',
    ],
    relatedIds: ['view-payslips', 'payroll-run'],
  },
  {
    id: 'create-invoices',
    section: 'payroll_finance', sectionIcon: SECTIONS.payroll_finance.icon, sectionColor: SECTIONS.payroll_finance.color,
    title: 'Creating Invoices',
    description: 'Generate client invoices linked to projects with customizable templates.',
    duration: 4, audience: 'manager',
    steps: [
      { title: 'Go to Invoices', description: 'Click "Invoices" under the FINANCE section in the sidebar.' },
      { title: 'Create New Invoice', description: 'Click "Create Invoice". Select the client from your client list.' },
      { title: 'Add Line Items', description: 'Add invoice line items: description, quantity, rate, and tax. You can link items to specific projects for profitability tracking.' },
      { title: 'Set Terms', description: 'Set payment terms (Net 15, Net 30, Net 45), due date, and any notes or terms & conditions.' },
      { title: 'Preview and Send', description: 'Preview the invoice with your company branding (logo, colors, address). Click "Send" to email it to the client or download as PDF.' },
    ],
    proTips: [
      'Linking invoices to projects enables automatic revenue tracking in the Profitability dashboard.',
      'Set up invoice templates to save time on recurring billing.',
      'Use the Clients page to track payment status and outstanding amounts.',
    ],
    relatedIds: ['project-profitability', 'timesheets'],
  },

  // ── Communication ──
  {
    id: 'team-chat',
    section: 'communication', sectionIcon: SECTIONS.communication.icon, sectionColor: SECTIONS.communication.color,
    title: 'Team Chat Basics',
    description: 'Send messages, create channels, share files, and collaborate with your team.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Open Team Chat', description: 'Click "Team Chat" under the COMMUNICATION section in the sidebar. The chat interface shows channels on the left and messages on the right.' },
      { title: 'Browse Channels', description: 'Channels are organized by topic (e.g., #general, #engineering, #random). Click any channel to view its messages.' },
      { title: 'Send a Message', description: 'Type your message in the text box at the bottom and press Enter. You can @mention specific people, use emoji reactions, and format text with markdown.' },
      { title: 'Create a Channel', description: 'Click the "+" button next to Channels to create a new channel. Set a name, description, and choose Public (anyone can join) or Private (invite-only).' },
      { title: 'Direct Messages', description: 'Click the "+" next to Direct Messages to start a private conversation with one or more team members.' },
      { title: 'Share Files', description: 'Click the attachment icon to upload files (documents, images, etc.) directly in the chat. Files are stored in the media service.' },
    ],
    proTips: [
      'Use threads (click "Reply") to keep conversations organized within a channel.',
      'Pin important messages so team members can find them easily.',
      'Chat search finds messages across all channels — useful for finding decisions made in conversations.',
    ],
    relatedIds: ['make-calls'],
  },
  {
    id: 'make-calls',
    section: 'communication', sectionIcon: SECTIONS.communication.icon, sectionColor: SECTIONS.communication.color,
    title: 'Making Calls',
    description: 'Start audio or video calls with screen sharing capabilities.',
    duration: 2, audience: 'all',
    steps: [
      { title: 'Go to Calls', description: 'Click "Calls" under the COMMUNICATION section in the sidebar.' },
      { title: 'Start a Call', description: 'Click "New Call", select team members to invite, and choose audio-only or video call. Click "Call" to initiate.' },
      { title: 'Use Screen Sharing', description: 'During a call, click the "Share Screen" button to present your screen, a specific window, or a browser tab.' },
      { title: 'View Call History', description: 'The Calls page shows your call history with timestamps, duration, and participants. Click any entry to see details.' },
    ],
    proTips: [
      'Use video calls for standup meetings and screen sharing for code reviews.',
      'Call logs are automatically recorded in the system for reference.',
    ],
    relatedIds: ['team-chat'],
  },

  // ── IT Assets ──
  {
    id: 'setup-asset-categories',
    section: 'it_assets', sectionIcon: SECTIONS.it_assets.icon, sectionColor: SECTIONS.it_assets.color,
    title: 'Setting Up Asset Categories',
    description: 'Create categories for different types of IT assets your company manages.',
    duration: 2, audience: 'admin',
    steps: [
      { title: 'Go to Categories', description: 'Click "Categories" under the IT ASSETS section in the sidebar.' },
      { title: 'Create a Category', description: 'Click "Add Category". Enter the name (e.g., "Laptop", "Monitor", "Headset", "Software License"), description, depreciation method, and useful life in years.' },
      { title: 'Add Custom Fields', description: 'Optionally add category-specific custom fields. For laptops: RAM, storage, processor. For licenses: license key, seats, renewal date.' },
      { title: 'Create Common Categories', description: 'Recommended categories: Laptop, Monitor, Keyboard & Mouse, Headset, Phone, Software License, Furniture, Access Card.' },
    ],
    proTips: [
      'Set depreciation method to "Straight Line" for hardware and "None" for consumables.',
      'Custom fields help track category-specific information without cluttering the main asset form.',
      'Create categories before adding assets — every asset must belong to a category.',
    ],
    relatedIds: ['add-assign-assets', 'asset-dashboard'],
  },
  {
    id: 'add-assign-assets',
    section: 'it_assets', sectionIcon: SECTIONS.it_assets.icon, sectionColor: SECTIONS.it_assets.color,
    title: 'Adding & Assigning Assets',
    description: 'Register new assets in the system and assign them to employees.',
    duration: 4, audience: 'admin',
    steps: [
      { title: 'Go to All Assets', description: 'Click "All Assets" under the IT ASSETS section in the sidebar.' },
      { title: 'Add a New Asset', description: 'Click "Add Asset". Enter: name (e.g., "MacBook Pro 14\\" M3"), category, serial number, model, manufacturer, and purchase price.' },
      { title: 'Set Warranty Info', description: 'Enter warranty start date, end date, and provider. The system will alert you before warranty expiry.' },
      { title: 'Assign to Employee', description: 'On the asset detail page, click "Assign". Select the employee from the dropdown. The asset status changes to "Assigned" and an audit trail entry is created.' },
      { title: 'Track Assignment History', description: 'The "History" tab shows every assignment, unassignment, and transfer with timestamps and who performed each action.' },
    ],
    proTips: [
      'Asset tags (AST-00001) are auto-generated — stick physical labels on hardware for easy identification.',
      'Bulk assign multiple assets to one employee during onboarding using the bulk assign feature.',
      'When an employee leaves, the offboarding process automatically checks for unreturned assets.',
    ],
    relatedIds: ['setup-asset-categories', 'view-my-assets', 'onboard-employee'],
  },
  {
    id: 'view-my-assets',
    section: 'it_assets', sectionIcon: SECTIONS.it_assets.icon, sectionColor: SECTIONS.it_assets.color,
    title: 'Viewing My Assets',
    description: 'See all IT assets currently assigned to you.',
    duration: 2, audience: 'employee',
    steps: [
      { title: 'Go to My Assets', description: 'Click "My Assets" under the IT ASSETS section in the sidebar.' },
      { title: 'View Your Assets', description: 'You\'ll see cards for each asset assigned to you: name, asset tag, serial number, model, condition, and when it was assigned.' },
      { title: 'Report Issues', description: 'If an asset is damaged or malfunctioning, click on it to view details and contact IT support for repair or replacement.' },
    ],
    proTips: [
      'Check this page during offboarding — you\'ll need to return all listed assets.',
      'If you notice any asset missing from your list that you have, notify IT immediately.',
    ],
    relatedIds: ['add-assign-assets', 'offboard-employee'],
  },
  {
    id: 'asset-dashboard',
    section: 'it_assets', sectionIcon: SECTIONS.it_assets.icon, sectionColor: SECTIONS.it_assets.color,
    title: 'Asset Dashboard',
    description: 'View asset statistics, warranty alerts, and depreciation tracking.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Open Asset Dashboard', description: 'Click "Asset Dashboard" under the IT ASSETS section in the sidebar.' },
      { title: 'Review Summary Stats', description: 'The dashboard shows: total assets, assigned, available, in maintenance, warranty expiring (30-day and 90-day), total asset value, and book value after depreciation.' },
      { title: 'View Distribution Charts', description: 'Pie chart shows assets by status (assigned vs available). Bar chart shows assets by category (laptops, monitors, etc.).' },
      { title: 'Check Warranty Alerts', description: 'The warranty expiring table lists all assets with warranties expiring soon, sorted by urgency. Click any to view details and initiate renewal.' },
    ],
    proTips: [
      'Review warranty alerts monthly — renewing before expiry is much cheaper than post-expiry repairs.',
      'Total asset value vs book value shows how much depreciation has occurred — useful for budgeting replacements.',
      'A high "In Maintenance" count may signal a need to replace aging hardware.',
    ],
    relatedIds: ['add-assign-assets', 'setup-asset-categories'],
  },

  // ── Knowledge Base ──
  {
    id: 'create-wiki-space',
    section: 'knowledge_base', sectionIcon: SECTIONS.knowledge_base.icon, sectionColor: SECTIONS.knowledge_base.color,
    title: 'Creating Wiki Spaces',
    description: 'Set up knowledge base spaces to organize your company documentation.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Go to Wiki', description: 'Click "Wiki" under the KNOWLEDGE section in the sidebar. You\'ll see the Knowledge Base homepage.' },
      { title: 'Create a Space', description: 'Click "New Space". Enter a name (e.g., "Engineering", "HR Policies", "Onboarding Guide"), description, and choose an emoji icon.' },
      { title: 'Set Visibility', description: 'Choose Public (all employees can view) or Restricted (only specific roles, teams, or individuals can access). Most spaces should be public.' },
      { title: 'Access Your Space', description: 'Click on the space card to enter it. You\'ll see the page tree sidebar on the left and content area on the right.' },
    ],
    proTips: [
      'Recommended starter spaces: Engineering Wiki, HR Policies, Onboarding, Company Handbook, Product Documentation.',
      'Use restricted visibility for sensitive content like salary bands, investor updates, or legal documents.',
      'Each space has its own page tree — organize content hierarchically for easy navigation.',
    ],
    relatedIds: ['write-wiki-pages', 'wiki-search', 'wiki-templates'],
  },
  {
    id: 'write-wiki-pages',
    section: 'knowledge_base', sectionIcon: SECTIONS.knowledge_base.icon, sectionColor: SECTIONS.knowledge_base.color,
    title: 'Writing & Editing Pages',
    description: 'Create, edit, and version wiki pages with the rich text editor.',
    duration: 4, audience: 'all',
    steps: [
      { title: 'Enter a Space', description: 'Click on a wiki space to open it. The left sidebar shows the page tree.' },
      { title: 'Create a New Page', description: 'Click "+ New Page" in the sidebar. Enter a title and press Enter or click "Go".' },
      { title: 'Edit Content', description: 'Click the "Edit" button on the page. Write your content in the editor — it supports headings, bold, italic, links, code blocks, and more.' },
      { title: 'Save with Summary', description: 'After editing, add an optional change summary (e.g., "Added deployment steps") and click "Save". The page version is automatically incremented.' },
      { title: 'Publish the Page', description: 'New pages start as "Draft". Click "Publish" to make them visible to other users. Draft pages are only visible to the author.' },
    ],
    proTips: [
      'Every save creates a version snapshot — you can always restore a previous version from the History page.',
      'Use the page tree to create child pages for sub-topics (e.g., "Deployment" → "Staging" → "Production").',
      'Pin important pages (star icon) so they appear highlighted in the sidebar.',
    ],
    relatedIds: ['create-wiki-space', 'wiki-search', 'wiki-history'],
  },
  {
    id: 'wiki-history',
    section: 'knowledge_base', sectionIcon: SECTIONS.knowledge_base.icon, sectionColor: SECTIONS.knowledge_base.color,
    title: 'Page Version History',
    description: 'View, compare, and restore previous versions of wiki pages.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Open a Page', description: 'Navigate to any wiki page in a space.' },
      { title: 'Click History', description: 'Click the "History" button in the page toolbar to view all previous versions.' },
      { title: 'Browse Versions', description: 'The version list shows each save: version number, who edited it, when, and the change summary. Click any version to preview it.' },
      { title: 'Restore a Version', description: 'If you need to revert, click "Restore This Version". The current content is saved as a new version, and the old content is restored.' },
    ],
    proTips: [
      'Version history is permanent — you can never lose content, even if someone accidentally deletes it.',
      'Use change summaries consistently so you can quickly find when a specific change was made.',
      'Restoring a version creates a new version (it doesn\'t overwrite history).',
    ],
    relatedIds: ['write-wiki-pages'],
  },
  {
    id: 'wiki-search',
    section: 'knowledge_base', sectionIcon: SECTIONS.knowledge_base.icon, sectionColor: SECTIONS.knowledge_base.color,
    title: 'Searching the Wiki',
    description: 'Find pages using full-text search or AI-powered semantic search.',
    duration: 2, audience: 'all',
    steps: [
      { title: 'Go to Search', description: 'Click "Search" under the KNOWLEDGE section in the sidebar, or use the search bar on the wiki homepage.' },
      { title: 'Text Search', description: 'Type keywords in the search box (e.g., "deployment guide"). Results are ranked by relevance across all published pages.' },
      { title: 'AI Semantic Search', description: 'Toggle to "AI Search" mode and ask a natural language question (e.g., "How do we deploy to production?"). The AI ranks pages by relevance to your question, even if exact keywords don\'t match.' },
      { title: 'Filter by Space', description: 'Use the space dropdown to limit search to a specific space (e.g., only search "Engineering Wiki").' },
    ],
    proTips: [
      'AI search is great for questions — "What\'s our refund policy?" works better than keyword search for natural questions.',
      'Text search is faster for exact matches — use it when you know the title or specific term.',
      'Tags on pages help improve search relevance — tag your pages consistently.',
    ],
    relatedIds: ['write-wiki-pages', 'wiki-templates'],
  },
  {
    id: 'wiki-templates',
    section: 'knowledge_base', sectionIcon: SECTIONS.knowledge_base.icon, sectionColor: SECTIONS.knowledge_base.color,
    title: 'Using Page Templates',
    description: 'Create pages from pre-built templates for common document types.',
    duration: 2, audience: 'all',
    steps: [
      { title: 'Create a Page from Template', description: 'When creating a new page, look for the "Use Template" option. Select from available templates.' },
      { title: 'Choose a Template', description: 'Built-in templates include: Runbook (step-by-step procedures), ADR (Architecture Decision Record), Meeting Notes, RFC (Request for Comments), and Retrospective.' },
      { title: 'Customize Content', description: 'The template pre-fills the page with structured headings and placeholder text. Replace the placeholders with your actual content.' },
      { title: 'Save and Publish', description: 'Edit the template content, save, and publish when ready. The page is now a regular page that can be edited independently.' },
    ],
    proTips: [
      'Managers can create custom templates from Settings for team-specific document types.',
      'Templates ensure consistency — all runbooks follow the same format, making them easier to follow.',
      'ADR templates are especially useful for documenting why architectural decisions were made.',
    ],
    relatedIds: ['write-wiki-pages', 'create-wiki-space'],
  },

  // ── Performance & Engagement ──
  {
    id: 'set-goals',
    section: 'performance', sectionIcon: SECTIONS.performance.icon, sectionColor: SECTIONS.performance.color,
    title: 'Setting Goals & OKRs',
    description: 'Create personal and team goals with measurable key results and regular check-ins.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Go to Goals', description: 'Click "Goals & OKRs" under the PAYROLL section in the sidebar.' },
      { title: 'Create a Goal', description: 'Click "New Goal". Enter the objective (e.g., "Improve API response time"), goal type (individual/team), target date, and measurable key results.' },
      { title: 'Add Key Results', description: 'Each goal should have 2-5 key results with specific targets. Example: "Reduce p95 latency from 500ms to 200ms", "Achieve 99.9% uptime".' },
      { title: 'Log Check-ins', description: 'Periodically update your progress on each key result. Add a check-in note describing what you\'ve accomplished and any blockers.' },
      { title: 'Track Completion', description: 'As you update key results, the goal\'s completion percentage is auto-calculated. Completed goals are marked with a checkmark.' },
    ],
    proTips: [
      'Set quarterly goals aligned with company objectives for maximum impact.',
      'Good OKRs are ambitious but achievable — hitting 70-80% of your key results is considered healthy.',
      'Regular check-ins (weekly) keep goals top-of-mind and help identify blockers early.',
    ],
    relatedIds: ['performance-reviews', 'give-kudos'],
  },
  {
    id: 'performance-reviews',
    section: 'performance', sectionIcon: SECTIONS.performance.icon, sectionColor: SECTIONS.performance.color,
    title: 'Performance Reviews',
    description: 'Participate in 360-degree review cycles with self, peer, and manager feedback.',
    duration: 4, audience: 'all',
    steps: [
      { title: 'Access Reviews', description: 'Click "Reviews" under the PAYROLL section. You\'ll see any active review cycles you\'re part of.' },
      { title: 'Self Assessment', description: 'Start with the self-assessment: rate yourself on each competency, describe your achievements, and reflect on areas for improvement.' },
      { title: 'Peer Reviews', description: 'If selected as a peer reviewer, provide constructive feedback on your colleague\'s performance. Be specific and include examples.' },
      { title: 'Manager Review', description: 'Managers review their direct reports: assess goal completion, rate competencies, and provide overall feedback with a final rating.' },
      { title: 'Review Meeting', description: 'After all inputs are collected, schedule a 1-on-1 with your manager to discuss the consolidated feedback and set goals for the next cycle.' },
    ],
    proTips: [
      'Be honest and constructive in peer reviews — vague feedback helps nobody.',
      'Link your review to specific goals and OKRs for objective evaluation.',
      'Review cycles are configured by HR from the "Review Cycles" page (manager access).',
    ],
    relatedIds: ['set-goals', 'give-kudos'],
  },
  {
    id: 'give-kudos',
    section: 'performance', sectionIcon: SECTIONS.performance.icon, sectionColor: SECTIONS.performance.color,
    title: 'Giving Kudos',
    description: 'Recognize and appreciate your colleagues with public kudos.',
    duration: 2, audience: 'all',
    steps: [
      { title: 'Go to Kudos', description: 'Click "Kudos" under the ENGAGEMENT section in the sidebar.' },
      { title: 'Give a Kudos', description: 'Click "Give Kudos". Select the colleague you want to appreciate, choose a category (teamwork, innovation, helping hand, above & beyond), and write a personal message.' },
      { title: 'Post It', description: 'Click "Post". Your kudos appears in the feed visible to the entire organization. The recipient is notified.' },
      { title: 'View the Leaderboard', description: 'The leaderboard shows who has received the most kudos this month/quarter. It\'s a fun way to celebrate top contributors.' },
    ],
    proTips: [
      'Give kudos in real-time — the closer to the event, the more meaningful the recognition.',
      'Be specific about what they did — "Thanks for staying late to fix the deployment" is better than "Good job".',
      'Kudos data is considered in performance reviews — it\'s not just a feel-good feature.',
    ],
    relatedIds: ['performance-reviews', 'run-surveys'],
  },
  {
    id: 'run-surveys',
    section: 'performance', sectionIcon: SECTIONS.performance.icon, sectionColor: SECTIONS.performance.color,
    title: 'Running Surveys',
    description: 'Create eNPS and employee satisfaction surveys to measure engagement.',
    duration: 3, audience: 'manager',
    steps: [
      { title: 'Go to Surveys', description: 'Click "Surveys" under the ENGAGEMENT section in the sidebar.' },
      { title: 'Create a Survey', description: 'Click "Create Survey". Choose a type: eNPS (Employee Net Promoter Score), Pulse Survey, or Custom Survey.' },
      { title: 'Add Questions', description: 'For eNPS, the standard question is pre-filled: "How likely are you to recommend this company as a workplace?" (0-10 scale). Add follow-up questions as needed.' },
      { title: 'Publish and Distribute', description: 'Set the survey as anonymous (recommended for honest feedback), set a deadline, and click "Publish". All employees receive a notification to participate.' },
      { title: 'View Results', description: 'After the deadline, view aggregated results: eNPS score (-100 to +100), promoter/passive/detractor breakdown, and individual question responses.' },
    ],
    proTips: [
      'Run eNPS quarterly to track engagement trends over time.',
      'Anonymous surveys get 3x more honest responses — always enable anonymity for engagement surveys.',
      'An eNPS score above 30 is considered good, above 50 is excellent.',
    ],
    relatedIds: ['give-kudos', 'performance-reviews'],
  },
  {
    id: 'learning-courses',
    section: 'performance', sectionIcon: SECTIONS.performance.icon, sectionColor: SECTIONS.performance.color,
    title: 'Learning & Courses',
    description: 'Browse available courses, enroll, and track your learning progress.',
    duration: 3, audience: 'all',
    steps: [
      { title: 'Go to Learning', description: 'Click "Learning" under the ENGAGEMENT section in the sidebar.' },
      { title: 'Browse Courses', description: 'View available courses organized by category. Each course shows: title, description, duration, difficulty level, and enrollment count.' },
      { title: 'Enroll in a Course', description: 'Click on a course and click "Enroll". The course is added to your learning dashboard.' },
      { title: 'Complete Modules', description: 'Work through the course modules in order. Mark each module as complete as you progress.' },
      { title: 'Earn Certificates', description: 'After completing all modules, you receive a certificate that appears in your employee profile and learning history.' },
    ],
    proTips: [
      'Managers can assign mandatory courses to their team for compliance or skill development.',
      'Learning paths combine multiple courses into a structured curriculum (e.g., "New Manager Training").',
      'Completed certificates are visible in your employee profile — great for career growth discussions.',
    ],
    relatedIds: ['set-goals', 'performance-reviews'],
  },
];

// ── Section Helpers ──

export function getTutorialSections(): TutorialSection[] {
  const sectionMap = new Map<string, Tutorial[]>();

  for (const t of TUTORIALS) {
    if (!sectionMap.has(t.section)) sectionMap.set(t.section, []);
    sectionMap.get(t.section)!.push(t);
  }

  return Object.entries(SECTIONS).map(([id, meta]) => ({
    id,
    title: meta.title,
    icon: meta.icon,
    color: meta.color,
    tutorials: sectionMap.get(id) || [],
  }));
}

export function getTutorialById(id: string): Tutorial | undefined {
  return TUTORIALS.find(t => t.id === id);
}

export function getAdjacentTutorials(id: string): { prev: Tutorial | null; next: Tutorial | null } {
  const idx = TUTORIALS.findIndex(t => t.id === id);
  return {
    prev: idx > 0 ? TUTORIALS[idx - 1] : null,
    next: idx < TUTORIALS.length - 1 ? TUTORIALS[idx + 1] : null,
  };
}

// ── Progress Helpers ──

const STORAGE_KEY = 'nexora-tutorial-progress';

export function getCompletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function markComplete(id: string): string[] {
  const completed = getCompletedIds();
  if (!completed.includes(id)) completed.push(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  return completed;
}

export function markIncomplete(id: string): string[] {
  const completed = getCompletedIds().filter(c => c !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  return completed;
}

export function getSectionProgress(sectionId: string, completedIds: string[]): { completed: number; total: number; percentage: number } {
  const sectionTutorials = TUTORIALS.filter(t => t.section === sectionId);
  const completed = sectionTutorials.filter(t => completedIds.includes(t.id)).length;
  const total = sectionTutorials.length;
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function getOverallProgress(completedIds: string[]): { completed: number; total: number; percentage: number } {
  const completed = TUTORIALS.filter(t => completedIds.includes(t.id)).length;
  return { completed, total: TUTORIALS.length, percentage: Math.round((completed / TUTORIALS.length) * 100) };
}
