// Central catalog of named, feature-level permissions and the default
// role -> permission mapping that reproduces the app's historical behaviour.
//
// This is the source of truth for *what permissions exist*. The editable
// role -> permission mapping lives in the `role_permissions` table; admins can
// change which permissions a role has from the admin screen without code edits.

export const ROLES = [
  "member",
  "lead",
  "admin",
  "vp",
  "super_admin",
  "observer",
] as const;
export type Role = (typeof ROLES)[number];

// Roles that may see everything they have permission for but may never write.
// Enforced as a hard, method-based block in requireAuth (independent of the
// permission set) so that even routes guarded by only requireAuth — e.g. task
// create/edit/delete and KPI metric entry — cannot be mutated by these roles.
export const READ_ONLY_ROLES: readonly Role[] = ["observer"];

export function isReadOnlyRole(role: Role): boolean {
  return READ_ONLY_ROLES.includes(role);
}

export const PERMISSION_KEYS = [
  "impersonate_users",
  "manage_users",
  "manage_permissions",
  "view_audit_log",
  "manage_access_requests",
  "manage_invitations",
  "manage_groups",
  "assign_tasks",
  "approve_completion",
  "edit_initiatives",
  "delete_initiatives",
  "manage_targets",
  "view_reports",
  "run_reports",
  "manage_metrics",
  "manage_integrations",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  category: string;
  sortOrder: number;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  {
    key: "impersonate_users",
    label: "Impersonate users",
    description:
      "Act as another user ('act as') to see and operate the app as them.",
    category: "Administration",
    sortOrder: 5,
  },
  {
    key: "manage_users",
    label: "Manage users",
    description: "Create, edit, deactivate users and change their roles.",
    category: "Administration",
    sortOrder: 10,
  },
  {
    key: "manage_permissions",
    label: "Manage permissions",
    description: "Edit which permissions each role is granted.",
    category: "Administration",
    sortOrder: 20,
  },
  {
    key: "view_audit_log",
    label: "View audit log",
    description: "Read the access-change audit trail.",
    category: "Administration",
    sortOrder: 30,
  },
  {
    key: "manage_access_requests",
    label: "Manage access requests",
    description: "Review, approve, and deny account & access requests.",
    category: "Administration",
    sortOrder: 40,
  },
  {
    key: "manage_invitations",
    label: "Manage invitations",
    description: "Create, regenerate, and revoke login invite links.",
    category: "Administration",
    sortOrder: 50,
  },
  {
    key: "manage_groups",
    label: "Manage groups",
    description: "Create and edit groups and their membership.",
    category: "Administration",
    sortOrder: 60,
  },
  {
    key: "assign_tasks",
    label: "Assign tasks",
    description: "Assign and bulk-assign tasks to other people.",
    category: "Work",
    sortOrder: 110,
  },
  {
    key: "approve_completion",
    label: "Approve completion",
    description: "Mark tasks complete / approve completion requests.",
    category: "Work",
    sortOrder: 120,
  },
  {
    key: "edit_initiatives",
    label: "Edit initiatives",
    description: "Create and edit focus areas and tactics (projects).",
    category: "Work",
    sortOrder: 130,
  },
  {
    key: "delete_initiatives",
    label: "Delete initiatives",
    description: "Delete tactics (projects).",
    category: "Work",
    sortOrder: 140,
  },
  {
    key: "manage_targets",
    label: "Manage targets",
    description: "Set focus-area KPI targets.",
    category: "Reporting",
    sortOrder: 210,
  },
  {
    key: "view_reports",
    label: "View reports",
    description: "View the report tree and CRM reporting views.",
    category: "Reporting",
    sortOrder: 220,
  },
  {
    key: "run_reports",
    label: "Run reports",
    description: "Run executive reports, exports, and board briefs.",
    category: "Reporting",
    sortOrder: 230,
  },
  {
    key: "manage_metrics",
    label: "Manage metrics",
    description: "Unlock past weeks for KPI metric editing.",
    category: "Reporting",
    sortOrder: 240,
  },
  {
    key: "manage_integrations",
    label: "Manage integrations",
    description: "Refresh and manage CRM integration connections.",
    category: "Reporting",
    sortOrder: 250,
  },
];

// Every permission, including the super-admin-only impersonation grant.
const ALL_PERMISSIONS = PERMISSION_KEYS.slice() as PermissionKey[];

// Everything except impersonate_users — the ceiling for admin/vp. Only
// super_admin may impersonate.
const ALL_EXCEPT_IMPERSONATE = ALL_PERMISSIONS.filter(
  (p) => p !== "impersonate_users",
);

// Default mapping reproducing today's behaviour:
//  - member: no elevated permissions
//  - lead: edit initiatives, assign tasks, approve completion, view reports, integrations
//  - admin / vp: everything except impersonation
//  - super_admin: everything, including impersonation
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  member: [],
  lead: [
    "edit_initiatives",
    "assign_tasks",
    "approve_completion",
    "view_reports",
    "manage_integrations",
  ],
  admin: ALL_EXCEPT_IMPERSONATE,
  vp: ALL_EXCEPT_IMPERSONATE,
  super_admin: ALL_PERMISSIONS,
  // Read-only oversight (e.g. private-equity viewers): may see reports, run/
  // export them, and read the audit log, but every write is hard-blocked by
  // READ_ONLY_ROLES regardless of which permissions are granted.
  observer: ["view_reports", "run_reports", "view_audit_log"],
};

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
