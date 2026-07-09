import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  usersTable,
  permissionsTable,
  rolePermissionsTable,
  auditLogTable,
  accessRequestsTable,
  invitationsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  GetPermissionMatrixResponse,
  UpdateRolePermissionsBody,
  UpdateRolePermissionsResponse,
  ListAuditLogResponse,
  CreateAccessRequestBody,
  ListAccessRequestsResponse,
  ListAccessRequestsResponseItem,
  ApproveAccessRequestResponse,
  DenyAccessRequestResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  invalidatePermissionCache,
  getRolePermissionMap,
  displayNameFor,
  maySetRole,
  hasPermission,
} from "../lib/permissions";
import {
  ROLES,
  PERMISSION_CATALOG,
  isRole,
  isPermissionKey,
  type Role,
  type PermissionKey,
} from "../lib/permissionCatalog";
import { writeAudit } from "../lib/audit";

const router: IRouter = Router();

type AccessRequestRow = typeof accessRequestsTable.$inferSelect;

// --- Lightweight in-memory rate limiter for the public request endpoint -----
// Prevents abuse of the unauthenticated /access-requests submission. Keyed by
// client IP; allows a small burst per rolling window.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (hits.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

// --- Permission catalog & role mapping -------------------------------------

router.get(
  "/permissions",
  requireAuth,
  requirePermission("manage_permissions"),
  async (_req: Request, res: Response) => {
    const catalogRows = await db.select().from(permissionsTable);
    const catalog =
      catalogRows.length > 0
        ? catalogRows
            .map((p) => ({
              key: p.key,
              label: p.label,
              description: p.description,
              category: p.category,
              sortOrder: p.sortOrder,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : PERMISSION_CATALOG.slice();

    const map = await getRolePermissionMap();
    const roles = ROLES.map((role) => ({
      role,
      permissions: Array.from(map.get(role) ?? new Set<PermissionKey>()),
    }));

    res.json(GetPermissionMatrixResponse.parse({ catalog, roles }));
  },
);

router.put(
  "/roles/:role/permissions",
  requireAuth,
  requirePermission("manage_permissions"),
  async (req: Request, res: Response) => {
    const role = String(req.params.role);
    if (!isRole(role)) {
      res.status(400).json({ error: "Unknown role" });
      return;
    }
    const parsed = UpdateRolePermissionsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const keys = Array.from(new Set(parsed.data.permissions)).filter(
      (k): k is PermissionKey => isPermissionKey(k),
    );

    // `impersonate_users` is exclusive to super_admin. Reject any attempt to
    // grant it to another role, and reject any edit to the super_admin mapping
    // by a non-super-admin (which could strip or alter the top-tier role).
    if (role !== "super_admin" && keys.includes("impersonate_users")) {
      res.status(403).json({
        error: "The impersonate_users permission is exclusive to the super admin role",
      });
      return;
    }
    if (role === "super_admin" && !hasPermission(req.appUser, "impersonate_users")) {
      res.status(403).json({
        error: "Only a super admin may edit the super admin role's permissions",
      });
      return;
    }

    const map = await getRolePermissionMap();
    const before = Array.from(map.get(role as Role) ?? new Set<PermissionKey>());

    await db.transaction(async (tx) => {
      await tx
        .delete(rolePermissionsTable)
        .where(eq(rolePermissionsTable.role, role));
      if (keys.length > 0) {
        await tx
          .insert(rolePermissionsTable)
          .values(keys.map((permissionKey) => ({ role, permissionKey })));
      }
    });
    invalidatePermissionCache();

    await writeAudit({
      actor: req.appUser,
      action: "permissions.updated",
      targetType: "role",
      targetId: role,
      targetLabel: role,
      before: { permissions: before },
      after: { permissions: keys },
    });

    res.json(
      UpdateRolePermissionsResponse.parse({ role, permissions: keys }),
    );
  },
);

// --- Audit log -------------------------------------------------------------

router.get(
  "/audit-log",
  requireAuth,
  requirePermission("view_audit_log"),
  async (req: Request, res: Response) => {
    const conds = [];
    if (typeof req.query.action === "string" && req.query.action) {
      conds.push(eq(auditLogTable.action, req.query.action));
    }
    if (typeof req.query.actorId === "string" && req.query.actorId) {
      conds.push(eq(auditLogTable.actorId, req.query.actorId));
    }
    if (typeof req.query.targetType === "string" && req.query.targetType) {
      conds.push(eq(auditLogTable.targetType, req.query.targetType));
    }
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 200, 1),
      500,
    );

    const rows = await db
      .select()
      .from(auditLogTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit);

    res.json(ListAuditLogResponse.parse(rows));
  },
);

// --- Access / account requests ---------------------------------------------

function serializeRequest(
  r: AccessRequestRow,
  decidedByName?: string | null,
) {
  return {
    id: r.id,
    kind: r.kind,
    requesterUserId: r.requesterUserId,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    requestedRole: r.requestedRole,
    reason: r.reason,
    status: r.status,
    decidedById: r.decidedById,
    decidedByName: decidedByName ?? null,
    decidedAt: r.decidedAt,
    resultInvitationId: r.resultInvitationId,
    createdAt: r.createdAt,
  };
}

router.post(
  // PUBLIC endpoint: a person WITHOUT an account must be able to request one.
  // No requireAuth here. Authenticated members may also submit "access"
  // (elevation) requests; we attach their identity when present.
  "/access-requests",
  async (req: Request, res: Response) => {
    // Resolve the optional authenticated user without forcing auth.
    let actor:
      | { id: string; name: string; email: string | null }
      | null = null;
    if (req.isAuthenticated() && req.user?.id) {
      const [row] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, req.user.id));
      if (row && row.isActive !== false) {
        actor = {
          id: row.id,
          name: displayNameFor(row),
          email: row.email,
        };
      }
    }

    // Rate-limit unauthenticated submissions to deter abuse.
    if (!actor) {
      const ip =
        (typeof req.ip === "string" && req.ip) ||
        req.socket.remoteAddress ||
        "unknown";
      if (!checkRateLimit(ip)) {
        res
          .status(429)
          .json({ error: "Too many requests. Please try again later." });
        return;
      }
    }

    const parsed = CreateAccessRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { kind, name, email, requestedRole, reason } = parsed.data;
    if (kind !== "account" && kind !== "access") {
      res.status(400).json({ error: "Invalid request kind" });
      return;
    }
    // super_admin is never self-requestable; it is granted only by an existing
    // super admin via direct role assignment or invite.
    if (requestedRole === "super_admin") {
      res.status(403).json({ error: "The super admin role cannot be requested" });
      return;
    }
    // Access (elevation) requests require an existing, signed-in account.
    if (kind === "access" && !actor) {
      res
        .status(401)
        .json({ error: "Sign in to request additional access." });
      return;
    }
    // Account requests must carry a name (and an email so admins can follow up).
    if (kind === "account") {
      if (!name || !name.trim()) {
        res
          .status(400)
          .json({ error: "Name is required for account requests" });
        return;
      }
      if (!actor && (!email || !email.trim())) {
        res
          .status(400)
          .json({ error: "Email is required for account requests" });
        return;
      }
    }

    const values =
      kind === "access"
        ? {
            kind,
            requesterUserId: actor!.id,
            requesterName: actor!.name,
            requesterEmail: actor!.email,
            requestedRole: requestedRole ?? "lead",
            reason: reason ?? null,
            status: "pending" as const,
          }
        : {
            kind,
            requesterUserId: actor ? actor.id : null,
            requesterName: name!.trim(),
            requesterEmail: email ?? actor?.email ?? null,
            requestedRole: requestedRole ?? "member",
            reason: reason ?? null,
            status: "pending" as const,
          };

    const [row] = await db
      .insert(accessRequestsTable)
      .values(values)
      .returning();

    await writeAudit({
      actorId: actor ? actor.id : null,
      actorName: actor ? actor.name : row!.requesterName,
      action: "access_request.submitted",
      targetType: "access_request",
      targetId: row!.id,
      targetLabel: row!.requesterName,
      after: { kind, requestedRole: row!.requestedRole },
    });

    res.status(201).json(ListAccessRequestsResponseItem.parse(serializeRequest(row!)));
  },
);

router.get(
  "/access-requests",
  requireAuth,
  requirePermission("manage_access_requests"),
  async (req: Request, res: Response) => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db
      .select()
      .from(accessRequestsTable)
      .where(status ? eq(accessRequestsTable.status, status) : undefined)
      .orderBy(desc(accessRequestsTable.createdAt));

    const deciderIds = Array.from(
      new Set(rows.map((r) => r.decidedById).filter((v): v is string => !!v)),
    );
    const deciders = deciderIds.length
      ? await db.select().from(usersTable)
      : [];
    const byId = new Map(deciders.map((u) => [u.id, displayNameFor(u)]));

    res.json(
      ListAccessRequestsResponse.parse(
        rows.map((r) =>
          serializeRequest(r, r.decidedById ? byId.get(r.decidedById) : null),
        ),
      ),
    );
  },
);

router.post(
  "/access-requests/:id/approve",
  requireAuth,
  requirePermission("manage_access_requests"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [reqRow] = await db
      .select()
      .from(accessRequestsTable)
      .where(eq(accessRequestsTable.id, id));
    if (!reqRow) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (reqRow.status !== "pending") {
      res.status(400).json({ error: "Request already decided" });
      return;
    }

    // Only a super admin may approve a request that grants the super_admin role
    // (whether by elevating an existing member or issuing an invite).
    if (!maySetRole(req.appUser, reqRow.requestedRole)) {
      res.status(403).json({ error: "Only a super admin may grant the super admin role" });
      return;
    }

    let resultInvitationId: number | null = null;

    if (reqRow.kind === "access") {
      // Elevate the existing member to the requested role.
      if (reqRow.requesterUserId) {
        await db
          .update(usersTable)
          .set({ role: reqRow.requestedRole })
          .where(eq(usersTable.id, reqRow.requesterUserId));
      }
    } else {
      // Account request: issue an invite for the new teammate to claim.
      const token = crypto.randomBytes(32).toString("hex");
      const [inv] = await db
        .insert(invitationsTable)
        .values({
          token,
          role: reqRow.requestedRole,
          newMemberName: reqRow.requesterName ?? "New member",
          newMemberEmail: reqRow.requesterEmail ?? null,
          status: "pending",
          createdById: req.appUser!.id,
        })
        .returning();
      resultInvitationId = inv!.id;
    }

    const [updated] = await db
      .update(accessRequestsTable)
      .set({
        status: "approved",
        decidedById: req.appUser!.id,
        decidedAt: new Date(),
        resultInvitationId,
      })
      .where(eq(accessRequestsTable.id, id))
      .returning();

    await writeAudit({
      actor: req.appUser,
      action: "access_request.approved",
      targetType: "access_request",
      targetId: updated!.id,
      targetLabel: updated!.requesterName,
      after: { kind: updated!.kind, requestedRole: updated!.requestedRole },
    });

    res.json(
      ApproveAccessRequestResponse.parse(
        serializeRequest(updated!, req.appUser!.name),
      ),
    );
  },
);

router.post(
  "/access-requests/:id/deny",
  requireAuth,
  requirePermission("manage_access_requests"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [reqRow] = await db
      .select()
      .from(accessRequestsTable)
      .where(eq(accessRequestsTable.id, id));
    if (!reqRow) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (reqRow.status !== "pending") {
      res.status(400).json({ error: "Request already decided" });
      return;
    }
    const [updated] = await db
      .update(accessRequestsTable)
      .set({
        status: "denied",
        decidedById: req.appUser!.id,
        decidedAt: new Date(),
      })
      .where(eq(accessRequestsTable.id, id))
      .returning();

    await writeAudit({
      actor: req.appUser,
      action: "access_request.denied",
      targetType: "access_request",
      targetId: updated!.id,
      targetLabel: updated!.requesterName,
    });

    res.json(
      DenyAccessRequestResponse.parse(
        serializeRequest(updated!, req.appUser!.name),
      ),
    );
  },
);

export default router;
