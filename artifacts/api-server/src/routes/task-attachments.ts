import { Router, type IRouter, type Request, type Response } from "express";
import { db, tasksTable, taskAttachmentsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { CreateTaskAttachmentBody, ListTaskAttachmentsResponse } from "@workspace/api-zod";
import { requireAuth, hasPermission, type AppUserCtx } from "../lib/permissions";
import { loadUserLookup, serializeAttachment } from "../lib/enrich";

const router: IRouter = Router();

async function canViewTask(taskId: number, me: AppUserCtx) {
  const [row] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!row) return { ok: false as const, status: 404 };
  // Users without task-assignment scope can only see tasks they own or are
  // blocking; broader visibility comes from the assign_tasks permission.
  if (
    !hasPermission(me, "assign_tasks") &&
    row.assigneeId !== me.id &&
    row.blockedById !== me.id
  ) {
    return { ok: false as const, status: 404 };
  }
  return { ok: true as const, task: row };
}

function canMutateTask(task: { assigneeId: string }, me: AppUserCtx) {
  return hasPermission(me, "assign_tasks") || task.assigneeId === me.id;
}

router.get(
  "/tasks/:id/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid task id" });
      return;
    }
    const me = req.appUser!;
    const access = await canViewTask(id, me);
    if (!access.ok) {
      res.status(access.status).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select()
      .from(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.taskId, id))
      .orderBy(asc(taskAttachmentsTable.createdAt));
    const users = await loadUserLookup();
    res.json(ListTaskAttachmentsResponse.parse(rows.map((r) => serializeAttachment(r, users))));
  },
);

router.post(
  "/tasks/:id/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid task id" });
      return;
    }
    const me = req.appUser!;
    const access = await canViewTask(id, me);
    if (!access.ok) {
      res.status(access.status).json({ error: "Not found" });
      return;
    }
    if (!canMutateTask(access.task, me)) {
      res.status(403).json({ error: "Not allowed to attach files to this task" });
      return;
    }
    const parsed = CreateTaskAttachmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }
    const url = parsed.data.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: "URL must start with http:// or https://" });
      return;
    }
    const [row] = await db
      .insert(taskAttachmentsTable)
      .values({
        taskId: id,
        label: parsed.data.label.trim(),
        url,
        addedById: me.id,
      })
      .returning();
    const users = await loadUserLookup();
    req.log.info({ taskId: id, attachmentId: row!.id }, "task attachment created");
    res.status(201).json(serializeAttachment(row!, users));
  },
);

router.delete(
  "/tasks/:id/attachments/:attachmentId",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const attId = Number(req.params.attachmentId);
    if (!Number.isFinite(id) || !Number.isFinite(attId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const me = req.appUser!;
    const access = await canViewTask(id, me);
    if (!access.ok) {
      res.status(access.status).json({ error: "Not found" });
      return;
    }
    if (!canMutateTask(access.task, me)) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    await db
      .delete(taskAttachmentsTable)
      .where(and(eq(taskAttachmentsTable.id, attId), eq(taskAttachmentsTable.taskId, id)));
    res.status(204).end();
  },
);

export default router;
