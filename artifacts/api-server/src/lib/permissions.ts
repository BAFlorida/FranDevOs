import { type Request, type Response, type NextFunction } from "express";
import {
  db,
  usersTable,
  rolePermissionsTable,
  permissionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ROLES,
  type Role,
  type PermissionKey,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
  isReadOnlyRole,
} from "./permissionCatalog";

export type { Role, PermissionKey };

// --- Legacy role helpers (kept for backwards compatibility) -----------------
// New code should prefer permission checks (requirePermission / hasPermission).

export function isPrivileged(role: Role): boolean {
  return (
    role === "admin" || role === "vp" || role === "lead" || role === "super_admin"
  );
}

export function isExecutive(role: Role): boolean {
  return role === "admin" || role === "vp" || role === "super_admin";
}

export interface ActingIdentity {
  id: string;
  name: string;
  avatarColor: string;
  role: Role;
  profileImageUrl: string | null;
}

export interface AppUserCtx {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  avatarColor: string;
  profileImageUrl: string | null;
  hasLogin: boolean;
  isActive: boolean;
  permissions: PermissionKey[];
  // True when the request is being made by a super admin acting as this user.
  impersonating: boolean;
  // The real super admin behind an impersonated session (null otherwise).
  realUser: ActingIdentity | null;
}

type UserRow = typeof usersTable.$inferSelect;

/**
 * Build the request-scoped app user context for a member row, resolving their
 * role permissions. When `impersonating` is set, `realRow` is the real super
 * admin driving the session and is exposed as `realUser`.
 */
export async function buildAppUser(
  row: UserRow,
  opts?: { impersonating?: boolean; realRow?: UserRow },
): Promise<AppUserCtx> {
  const permissions = await permissionsForRole(row.role as Role);
  const impersonating = !!(opts?.impersonating && opts.realRow);
  const realUser: ActingIdentity | null =
    impersonating && opts!.realRow
      ? {
          id: opts!.realRow.id,
          name: displayNameFor(opts!.realRow),
          avatarColor: opts!.realRow.avatarColor,
          role: opts!.realRow.role as Role,
          profileImageUrl: opts!.realRow.profileImageUrl,
        }
      : null;
  return {
    id: row.id,
    name: displayNameFor(row),
    email: row.email,
    role: row.role as Role,
    avatarColor: row.avatarColor,
    profileImageUrl: row.profileImageUrl,
    hasLogin: row.passwordHash != null,
    isActive: row.isActive,
    permissions,
    impersonating,
    realUser,
  };
}

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUserCtx;
    }
  }
}

export function displayNameFor(u: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  id: string;
}): string {
  if (u.displayName) return u.displayName;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (u.email) return u.email.split("@")[0]!;
  return u.id.slice(0, 8);
}

// --- Role -> permission mapping (cached, DB-backed) -------------------------

let mappingCache: Map<Role, Set<PermissionKey>> | null = null;

function defaultsToMap(): Map<Role, Set<PermissionKey>> {
  const m = new Map<Role, Set<PermissionKey>>();
  for (const r of ROLES) {
    m.set(r, new Set(DEFAULT_ROLE_PERMISSIONS[r]));
  }
  return m;
}

/**
 * Load the role -> permission mapping. Reads from the `role_permissions` table
 * and caches the result in memory. If the table has not been seeded yet, falls
 * back to the built-in defaults so existing routes never regress.
 */
export async function getRolePermissionMap(): Promise<
  Map<Role, Set<PermissionKey>>
> {
  if (mappingCache) return mappingCache;
  const rows = await db.select().from(rolePermissionsTable);
  if (rows.length === 0) {
    mappingCache = defaultsToMap();
    return mappingCache;
  }
  const m = new Map<Role, Set<PermissionKey>>();
  for (const r of ROLES) m.set(r, new Set<PermissionKey>());
  for (const row of rows) {
    const set = m.get(row.role as Role);
    if (set) set.add(row.permissionKey as PermissionKey);
  }
  mappingCache = m;
  return mappingCache;
}

// Call after mutating the role_permissions table so the next request re-reads.
export function invalidatePermissionCache(): void {
  mappingCache = null;
}

/**
 * Deterministically bootstrap the permission catalog and the default
 * role -> permission mapping on a fresh database. Idempotent: safe to run on
 * every server start.
 *
 *  - Upserts every permission in PERMISSION_CATALOG into the `permissions`
 *    table so that `role_permissions.permission_key` FK targets always exist
 *    (otherwise the admin "edit role permissions" write would FK-violate).
 *  - If `role_permissions` is completely empty, seeds DEFAULT_ROLE_PERMISSIONS
 *    for every role. This is required because the first admin edit to any role
 *    flips the mapping source from built-in defaults to DB rows; without seeded
 *    rows for the other roles they would silently lose all permissions.
 */
export async function ensurePermissionBootstrap(): Promise<void> {
  for (const def of PERMISSION_CATALOG) {
    await db
      .insert(permissionsTable)
      .values({
        key: def.key,
        label: def.label,
        description: def.description,
        category: def.category,
        sortOrder: def.sortOrder,
      })
      .onConflictDoUpdate({
        target: permissionsTable.key,
        set: {
          label: def.label,
          description: def.description,
          category: def.category,
          sortOrder: def.sortOrder,
        },
      });
  }

  const existing = await db
    .select({ id: rolePermissionsTable.id })
    .from(rolePermissionsTable)
    .limit(1);
  if (existing.length === 0) {
    const rows: { role: Role; permissionKey: PermissionKey }[] = [];
    for (const role of ROLES) {
      for (const permissionKey of DEFAULT_ROLE_PERMISSIONS[role]) {
        rows.push({ role, permissionKey });
      }
    }
    if (rows.length > 0) {
      await db
        .insert(rolePermissionsTable)
        .values(rows)
        .onConflictDoNothing();
    }
  }

  // The super_admin role is newer than the original seed. On a database whose
  // role_permissions table was populated before super_admin existed, the
  // empty-table seed above is skipped, so idempotently ensure the full
  // super_admin mapping (including impersonate_users) is present.
  const superAdminRows = DEFAULT_ROLE_PERMISSIONS.super_admin.map(
    (permissionKey) => ({ role: "super_admin" as Role, permissionKey }),
  );
  if (superAdminRows.length > 0) {
    await db
      .insert(rolePermissionsTable)
      .values(superAdminRows)
      .onConflictDoNothing();
  }

  // The observer (read-only) role is newer than the original seed, so the
  // empty-table seed above is skipped on databases populated before it existed.
  // Idempotently ensure its default read permissions are present.
  const observerRows = DEFAULT_ROLE_PERMISSIONS.observer.map((permissionKey) => ({
    role: "observer" as Role,
    permissionKey,
  }));
  if (observerRows.length > 0) {
    await db
      .insert(rolePermissionsTable)
      .values(observerRows)
      .onConflictDoNothing();
  }

  invalidatePermissionCache();
}

export async function permissionsForRole(
  role: Role,
): Promise<PermissionKey[]> {
  const map = await getRolePermissionMap();
  return Array.from(map.get(role) ?? new Set<PermissionKey>());
}

// The permission that defines a "higher-up" for roadblock escalation: the same
// managerial approval permission that gates the /roadblocks queue UI. A user who
// holds it may be an escalation target and may resolve/reassign escalations.
export const ESCALATION_MANAGER_PERMISSION: PermissionKey = "approve_completion";

export async function roleHasPermission(
  role: Role,
  perm: PermissionKey,
): Promise<boolean> {
  const map = await getRolePermissionMap();
  return map.get(role)?.has(perm) ?? false;
}

/**
 * Whether the given user id is eligible to receive/resolve escalations: the
 * account must be active and its role must hold ESCALATION_MANAGER_PERMISSION.
 * Used to keep escalation routing strictly upward — never sideways to a peer.
 */
export async function isEscalationManagerUserId(
  userId: string,
): Promise<boolean> {
  const [u] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!u || u.isActive === false) return false;
  return roleHasPermission(u.role as Role, ESCALATION_MANAGER_PERMISSION);
}

// --- Auth + permission middleware ------------------------------------------

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // The real, signed-in user (the super admin themselves when impersonating).
  const [realRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));
  if (!realRow) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Deactivated users cannot authenticate or act.
  if (realRow.isActive === false) {
    res.status(403).json({ error: "Account deactivated" });
    return;
  }

  // If this is the first user ever, promote them to admin so the app is usable.
  if ((realRow.role as Role) === "member") {
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    const realCount = allUsers.length;
    // Auto-promote single real user OR if no admin/super_admin exists yet.
    const admins = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable);
    const hasAdmin = admins.some(
      (u) => u.role === "admin" || u.role === "super_admin",
    );
    if (!hasAdmin && realCount > 0) {
      await db
        .update(usersTable)
        .set({ role: "admin" })
        .where(eq(usersTable.id, realRow.id));
      realRow.role = "admin";
    }
  }

  // Resolve the acting user. A super admin with `impersonate_users` may act as
  // another active user; the request then resolves permissions to that user.
  let actingRow = realRow;
  let impersonating = false;
  const impId = req.impersonatedUserId;
  if (impId && impId !== realRow.id) {
    const canImpersonate = await roleHasPermission(
      realRow.role as Role,
      "impersonate_users",
    );
    if (canImpersonate) {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, impId));
      if (target && target.isActive !== false) {
        actingRow = target;
        impersonating = true;
      }
    }
  }

  req.appUser = await buildAppUser(actingRow, { impersonating, realRow });

  // Hard read-only enforcement. Read-only roles (e.g. observer) may never write,
  // regardless of which permissions their role mapping grants. This is a global
  // method-based block — not a per-route permission check — because several
  // mutating routes are guarded by only requireAuth (task create/edit/delete,
  // KPI metric entry, report definitions), so an empty permission set alone
  // would not stop them. The acting role is what matters, so a super admin
  // impersonating an observer is also blocked from writing.
  if (isReadOnlyRole(actingRow.role as Role) && isMutatingRequest(req)) {
    res.status(403).json({ error: "This account is read-only." });
    return;
  }

  next();
}

// Methods that mutate state. Read-only roles are blocked from all of these.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Mutating requests a read-only user is still allowed to make:
//  - managing their own credentials (change-password). Logout is not guarded by
//    requireAuth, so it always works.
//  - stopping impersonation: when a super admin acts as an observer, the acting
//    role is observer, so without this exception they could never exit back to
//    their real identity via the intended endpoint.
const READ_ONLY_WRITE_ALLOWLIST = [
  "/auth/change-password",
  "/impersonate/stop",
];

function isMutatingRequest(req: Request): boolean {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) return false;
  const path = req.path;
  return !READ_ONLY_WRITE_ALLOWLIST.some(
    (allowed) => path === allowed || path.endsWith(allowed),
  );
}

export function hasPermission(
  user: AppUserCtx | undefined,
  perm: PermissionKey,
): boolean {
  return !!user && user.permissions.includes(perm);
}

/**
 * Guard requiring the authenticated user to hold at least one of the listed
 * permissions. Must run after requireAuth (which populates req.appUser).
 */
export function requirePermission(...perms: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.appUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const ok = perms.some((p) => req.appUser!.permissions.includes(p));
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Centralized authorization invariant for granting the top-tier `super_admin`
 * role. Only an actor who is already a super admin (holder of the exclusive
 * `impersonate_users` permission) may create, approve, or otherwise produce a
 * grant of `super_admin`. Any other targetRole is always permitted here.
 *
 * Must run after requireAuth (which populates req.appUser). Returns true when
 * the role assignment is allowed for this actor.
 */
export function maySetRole(
  user: AppUserCtx | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (targetRole !== "super_admin") return true;
  return hasPermission(user, "impersonate_users");
}

// Legacy role guard, retained for any callers not yet migrated.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.appUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.appUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
