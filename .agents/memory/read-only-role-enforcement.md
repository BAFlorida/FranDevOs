---
name: Read-only role enforcement
description: Why read-only roles need a hard method block, not just an empty permission set
---

Read-only roles (e.g. `observer`) cannot be enforced by giving the role an empty/limited permission set.

**Why:** Many mutating routes are guarded by only `requireAuth` with NO `requirePermission` (e.g. task POST/PATCH/DELETE, `POST /metric-entries`, `POST /reports/definitions`). Any authenticated user — including a permission-less role — can therefore write through them. Adding `requirePermission` to those routes would instead change existing roles' behavior (e.g. members currently can create tasks), which is out of scope for "add a read-only role".

**How to apply:** Enforce read-only as a hard, method-based block inside `requireAuth` (in `permissions.ts`), keyed on the **acting** role (`READ_ONLY_ROLES`/`isReadOnlyRole`): if the acting role is read-only and the method is POST/PUT/PATCH/DELETE, return 403 before route logic. Keyed on the acting role so a super admin impersonating an observer is also blocked. Maintain a small allowlist of mutating paths the read-only user must still reach: `/auth/change-password` (own creds) and `/impersonate/stop` (or a super admin acting as observer can never exit). Logout is unguarded by `requireAuth`, so it always works.

**Known gap (accepted):** Public/auth-optional write endpoints (e.g. `POST /access-requests`, mounted without `requireAuth`) are not covered by the guard — an authenticated observer could still submit one. It writes no business data and is public by design; left as-is.

The `role` column is `varchar(16)`, not a pg enum, so adding a role needs NO DB migration — only `permissionCatalog.ts` (ROLES + DEFAULT_ROLE_PERMISSIONS), an idempotent bootstrap seed block in `ensurePermissionBootstrap`, the OpenAPI `UserRole` enum + codegen, and the admin.tsx role picker/labels.

**Frontend gating (mirror, not source of truth):** The UI hides/disables write controls via a `useReadOnly()` hook (`artifacts/franchise-dev-os/src/lib/use-read-only.ts`) that checks the acting role from `/me` against a frontend copy of `READ_ONLY_ROLES`. It is role-based, NOT permission-based: most write controls are already hidden because the role lacks the write permission, but several entry points are gated by NO permission key (task create on My Tasks / tactic detail / person detail, task-table row click-to-edit, CRM "Create follow-up task" in sales/marketing, the shared TaskFormDialog + CrmLinkedTaskDialog submit). Those need an explicit read-only check. The server block is the real guard; the UI is just UX so observers don't see controls that would 403.
