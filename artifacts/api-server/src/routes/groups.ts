import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  groupsTable,
  groupMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { requireAuth, requirePermission, displayNameFor } from "../lib/permissions";

const router: IRouter = Router();

async function loadGroupWithMembers(id: number) {
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) return null;
  const members = await db
    .select({
      userId: usersTable.id,
      displayName: usersTable.displayName,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      avatarColor: usersTable.avatarColor,
      role: usersTable.role,
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, id));
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    members: members
      .map((m) => ({
        userId: m.userId,
        name: displayNameFor({ id: m.userId, displayName: m.displayName, firstName: m.firstName, lastName: m.lastName, email: m.email }),
        avatarColor: m.avatarColor,
        role: m.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

router.get("/groups", requireAuth, async (_req: Request, res: Response) => {
  const groups = await db.select().from(groupsTable).orderBy(groupsTable.name);
  const counts = await db
    .select({
      groupId: groupMembersTable.groupId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(groupMembersTable)
    .groupBy(groupMembersTable.groupId);
  const countMap = new Map(counts.map((c) => [c.groupId, Number(c.count)]));
  res.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: countMap.get(g.id) ?? 0,
      createdAt: g.createdAt,
    })),
  );
});

router.get("/groups/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const out = await loadGroupWithMembers(id);
  if (!out) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(out);
});

router.post(
  "/groups",
  requireAuth,
  requirePermission("manage_groups"),
  async (req: Request, res: Response) => {
    const { name, description } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const [row] = await db
      .insert(groupsTable)
      .values({
        name: name.trim(),
        description: typeof description === "string" ? description : "",
        createdById: req.appUser!.id,
      })
      .returning();
    const out = await loadGroupWithMembers(row!.id);
    res.status(201).json(out);
  },
);

router.patch(
  "/groups/:id",
  requireAuth,
  requirePermission("manage_groups"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, description } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof name === "string") patch.name = name.trim();
    if (typeof description === "string") patch.description = description;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "no changes" });
      return;
    }
    await db.update(groupsTable).set(patch).where(eq(groupsTable.id, id));
    const out = await loadGroupWithMembers(id);
    if (!out) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    res.json(out);
  },
);

router.delete(
  "/groups/:id",
  requireAuth,
  requirePermission("manage_groups"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await db.delete(groupsTable).where(eq(groupsTable.id, id));
    res.status(204).end();
  },
);

router.put(
  "/groups/:id/members",
  requireAuth,
  requirePermission("manage_groups"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { userIds } = req.body ?? {};
    if (!Array.isArray(userIds) || !userIds.every((u) => typeof u === "string")) {
      res.status(400).json({ error: "userIds must be string[]" });
      return;
    }
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    // Validate users exist
    if (userIds.length > 0) {
      const valid = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds));
      if (valid.length !== userIds.length) {
        res.status(400).json({ error: "One or more userIds invalid" });
        return;
      }
    }
    await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, id));
    if (userIds.length > 0) {
      await db
        .insert(groupMembersTable)
        .values(userIds.map((u: string) => ({ groupId: id, userId: u })));
    }
    const out = await loadGroupWithMembers(id);
    res.json(out);
  },
);

export default router;
