import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // App-specific fields
  displayName: varchar("display_name"),
  role: varchar("role", { length: 16 }).notNull().default("member"),
  avatarColor: varchar("avatar_color", { length: 16 }).notNull().default("#7c8fa3"),
  // Deactivated users cannot log in or act; blocked at the auth boundary.
  isActive: boolean("is_active").notNull().default(true),
  // Legacy OIDC subject column, retained so historical rows/foreign keys are
  // preserved. No longer used for authentication (in-app password login now).
  authSubject: varchar("auth_subject").unique(),
  // scrypt password hash for in-app email/password login. Nullable: seeded and
  // invited members have no password until they claim a one-time invite link.
  // "Has a login" is defined as passwordHash != null.
  passwordHash: varchar("password_hash"),
  // When the password was last set (via invite acceptance, self-change, or admin
  // reset). Null until a password is first set.
  passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const invitationsTable = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    // Long random unguessable token used in the invite link.
    token: varchar("token", { length: 64 }).notNull().unique(),
    // Existing member this invite claims, or null when creating a new member.
    targetUserId: varchar("target_user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    // Details for the new member created on accept (when targetUserId is null).
    newMemberName: varchar("new_member_name", { length: 256 }),
    newMemberEmail: varchar("new_member_email", { length: 256 }),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    // pending | accepted | revoked
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdById: varchar("created_by_id").references(() => usersTable.id),
    acceptedByUserId: varchar("accepted_by_user_id").references(() => usersTable.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    // Invite links auto-expire ~7 days after creation; expired invites are
    // treated the same as revoked everywhere (accept screen + claim flow).
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("idx_invitations_status").on(t.status), index("idx_invitations_target").on(t.targetUserId)],
);

// Catalog of named, feature-level permissions. The canonical list lives in the
// API server (PERMISSION_CATALOG); this table mirrors it so the admin UI can
// render labels/descriptions and the role mapping can FK against a stable key.
export const permissionsTable = pgTable("permissions", {
  key: varchar("key", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  description: varchar("description", { length: 512 }).notNull().default(""),
  category: varchar("category", { length: 64 }).notNull().default("General"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Editable role -> permission mapping. One row per (role, permissionKey) that is
// granted. Absence of a row means the role lacks that permission.
export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    role: varchar("role", { length: 16 }).notNull(),
    permissionKey: varchar("permission_key", { length: 64 })
      .notNull()
      .references(() => permissionsTable.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_role_permission").on(t.role, t.permissionKey),
    index("idx_role_permissions_role").on(t.role),
  ],
);

// Append-only audit trail of every access-relevant change.
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    // Who performed the action (null for unauthenticated self-service requests).
    actorId: varchar("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    actorName: varchar("actor_name", { length: 256 }),
    // e.g. user.created, user.role_changed, permissions.updated, invite.created.
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: varchar("target_id", { length: 256 }),
    targetLabel: varchar("target_label", { length: 256 }),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_audit_action").on(t.action),
    index("idx_audit_actor").on(t.actorId),
    index("idx_audit_created").on(t.createdAt),
  ],
);

// Self-service account/access requests feeding the admin approval queue.
export const accessRequestsTable = pgTable(
  "access_requests",
  {
    id: serial("id").primaryKey(),
    // account = provision a brand-new user; access = elevate an existing member.
    kind: varchar("kind", { length: 16 }).notNull(),
    // Existing member making an access request (null for account requests).
    requesterUserId: varchar("requester_user_id").references(
      () => usersTable.id,
      { onDelete: "cascade" },
    ),
    requesterName: varchar("requester_name", { length: 256 }),
    requesterEmail: varchar("requester_email", { length: 256 }),
    requestedRole: varchar("requested_role", { length: 16 })
      .notNull()
      .default("member"),
    reason: varchar("reason", { length: 1024 }),
    // pending | approved | denied
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    decidedById: varchar("decided_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // Invitation created when an account request is approved (if any).
    resultInvitationId: integer("result_invitation_id").references(
      () => invitationsTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_access_requests_status").on(t.status),
    index("idx_access_requests_requester").on(t.requesterUserId),
  ],
);

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type Invitation = typeof invitationsTable.$inferSelect;
export type InsertInvitation = typeof invitationsTable.$inferInsert;
export type Permission = typeof permissionsTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type AuditLogEntry = typeof auditLogTable.$inferSelect;
export type InsertAuditLogEntry = typeof auditLogTable.$inferInsert;
export type AccessRequest = typeof accessRequestsTable.$inferSelect;
export type InsertAccessRequest = typeof accessRequestsTable.$inferInsert;
