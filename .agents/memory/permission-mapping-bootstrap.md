---
name: Permission mapping bootstrap
description: Why the permission catalog + default role_permissions must be seeded deterministically on startup
---

The role→permission mapping is read from `role_permissions` and falls back to the
built-in `DEFAULT_ROLE_PERMISSIONS` **only when that table is completely empty**.

**Rule:** On a fresh DB you must (1) upsert the whole permission catalog into
`permissions`, and (2) seed `role_permissions` for *every* role. Both run from
`ensurePermissionBootstrap()` on server start (idempotent).

**Why:**
- `role_permissions.permission_key` FKs `permissions.key`; without the catalog
  seeded, the admin "edit role permissions" write (`PUT /roles/:role/permissions`)
  FK-violates.
- The fallback is all-or-nothing: the first admin edit to *any* role makes the
  table non-empty, which flips the source from defaults to DB rows. Any role
  never inserted then reads as having ZERO permissions — silently locking people
  out. Seeding all roles up front prevents this.

**How to apply:** If you add new permission keys or roles, they flow from
`PERMISSION_CATALOG` / `DEFAULT_ROLE_PERMISSIONS`; the catalog upsert keeps
`permissions` current, but default mapping rows are only seeded when the table is
empty, so changing defaults won't retro-apply to a DB that already has rows.
