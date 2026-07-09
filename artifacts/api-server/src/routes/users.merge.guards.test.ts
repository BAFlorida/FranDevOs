import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type Express } from "express";
import { db, usersTable, auditLogTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

import usersRouter from "./users";
import { ensurePermissionBootstrap } from "../lib/permissions";

/**
 * End-to-end test of the merge endpoint's route-level safety guards
 * (POST /api/users/:id/merge). These guards live in the route, not in the
 * `mergeUsers` library, so the library test never exercises them. They protect
 * an admin from stranding their own login or escalating a merge incorrectly:
 *
 *   - a self-merge (source === target) is refused
 *   - merging away the account you are signed in as is refused
 *   - a merge that names a missing account is refused
 *   - merging into/out of a Super Admin requires super-admin rights
 *
 * The test mounts the real users router behind a tiny auth shim that sets the
 * request's signed-in identity (`req.user`) the same way the production
 * `authMiddleware` does, then drives requests over HTTP so the real
 * `requireAuth` + `requirePermission("manage_users")` middleware and the route
 * handler run exactly as in production. Seeded rows are committed and torn down
 * in `after()` so the database is left clean even if an assertion fails.
 */
describe("POST /users/:id/merge guards", () => {
  let server: Server;
  let baseUrl: string;

  // The signed-in identity the auth shim reports for the next request.
  let actingUserId: string | null = null;

  let adminId: string;
  let memberAId: string;
  let memberBId: string;
  let superAdminAccountId: string;

  // Dedicated rows for the positive "super admin may merge a Super Admin" case.
  let superAdminActorId: string;
  let superSourceId: string;
  let plainTargetId: string;

  const MISSING_ID = "00000000-0000-0000-0000-000000000000";

  async function seedUser(values: {
    displayName: string;
    role: string;
    withLogin?: boolean;
  }): Promise<string> {
    const [row] = await db
      .insert(usersTable)
      .values({
        displayName: values.displayName,
        role: values.role,
        isActive: true,
        ...(values.withLogin
          ? {
              email: `${values.displayName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.test`,
              passwordHash: "scrypt$fake$hash",
              passwordSetAt: new Date(),
            }
          : {}),
      })
      .returning();
    return row!.id;
  }

  // POST a merge as `actingUserId`, returning the status + parsed JSON body.
  async function postMerge(
    targetId: string,
    sourceUserId: string,
  ): Promise<{ status: number; body: { error?: string; id?: string } }> {
    const res = await fetch(`${baseUrl}/api/users/${targetId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceUserId }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };
    return { status: res.status, body };
  }

  before(async () => {
    // The merge route is gated by requireAuth + requirePermission("manage_users")
    // which resolve role -> permission from the DB; make sure it is seeded.
    await ensurePermissionBootstrap();

    adminId = await seedUser({ displayName: "Merge Guard Admin", role: "admin" });
    memberAId = await seedUser({
      displayName: "Merge Guard Member A",
      role: "member",
    });
    memberBId = await seedUser({
      displayName: "Merge Guard Member B",
      role: "member",
    });
    superAdminAccountId = await seedUser({
      displayName: "Merge Guard SuperAdmin",
      role: "super_admin",
    });

    superAdminActorId = await seedUser({
      displayName: "Merge Guard SuperAdmin Actor",
      role: "super_admin",
    });
    superSourceId = await seedUser({
      displayName: "Merge Guard Super Source",
      role: "super_admin",
      withLogin: true,
    });
    plainTargetId = await seedUser({
      displayName: "Merge Guard Plain Target",
      role: "member",
    });

    // Real router behind an auth shim mirroring production authMiddleware: it
    // only populates the signed-in identity; requireAuth still resolves the app
    // user + permissions from the database on every request.
    const app: Express = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.isAuthenticated = function (this: typeof req) {
        return this.user != null;
      } as typeof req.isAuthenticated;
      if (actingUserId) {
        req.user = {
          id: actingUserId,
          email: null,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        };
        req.impersonatedUserId = undefined;
      }
      next();
    });
    app.use("/api", usersRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server ? server.close((e) => (e ? reject(e) : resolve())) : resolve(),
    );
    const ids = [
      adminId,
      memberAId,
      memberBId,
      superAdminAccountId,
      superAdminActorId,
      superSourceId,
      plainTargetId,
    ].filter(Boolean);
    // Audit rows reference the actor with onDelete:set null, so the user delete
    // below would not fail, but clean up the merge audit trail this test wrote.
    if (ids.length) {
      await db
        .delete(auditLogTable)
        .where(inArray(auditLogTable.targetId, ids));
    }
    if (ids.length) {
      await db.delete(usersTable).where(inArray(usersTable.id, ids));
    }
  });

  it("refuses merging an account into itself", async () => {
    actingUserId = adminId;
    const { status, body } = await postMerge(memberAId, memberAId);
    assert.equal(status, 400);
    assert.match(body.error ?? "", /into itself/i);
  });

  it("refuses retiring the account you are currently signed in as", async () => {
    actingUserId = adminId;
    // Source is the signed-in admin itself; target is someone else.
    const { status, body } = await postMerge(memberAId, adminId);
    assert.equal(status, 400);
    assert.match(body.error ?? "", /your own account/i);
  });

  it("refuses when the source account does not exist", async () => {
    actingUserId = adminId;
    const { status, body } = await postMerge(memberAId, MISSING_ID);
    assert.equal(status, 404);
    assert.match(body.error ?? "", /not found/i);
  });

  it("refuses when the target account does not exist", async () => {
    actingUserId = adminId;
    const { status, body } = await postMerge(MISSING_ID, memberAId);
    assert.equal(status, 404);
    assert.match(body.error ?? "", /not found/i);
  });

  it("refuses a non-super-admin merging a Super Admin source", async () => {
    actingUserId = adminId;
    const { status, body } = await postMerge(memberAId, superAdminAccountId);
    assert.equal(status, 403);
    assert.match(body.error ?? "", /super admin/i);
  });

  it("refuses a non-super-admin merging into a Super Admin target", async () => {
    actingUserId = adminId;
    const { status, body } = await postMerge(superAdminAccountId, memberBId);
    assert.equal(status, 403);
    assert.match(body.error ?? "", /super admin/i);
  });

  it("allows a super admin to merge a Super Admin account", async () => {
    actingUserId = superAdminActorId;
    const { status, body } = await postMerge(plainTargetId, superSourceId);
    assert.equal(status, 200);
    assert.equal(body.id, plainTargetId, "the named target is the survivor");

    // The guard let it through and the merge actually ran: the source is retired.
    const [retired] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, superSourceId));
    assert.equal(retired!.isActive, false, "merged-away source is deactivated");
  });
});
