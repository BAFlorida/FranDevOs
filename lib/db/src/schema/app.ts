import { integer, pgTable, serial, text, timestamp, varchar, date, index, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const focusAreasTable = pgTable("focus_areas", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const focusAreaTargetsTable = pgTable("focus_area_targets", {
  id: serial("id").primaryKey(),
  focusAreaId: integer("focus_area_id")
    .notNull()
    .references(() => focusAreasTable.id, { onDelete: "cascade" })
    .unique(),
  goalText: text("goal_text").notNull().default(""),
  targetNumeric: integer("target_numeric"),
  currentNumeric: integer("current_numeric").notNull().default(0),
  unitLabel: varchar("unit_label", { length: 64 }).notNull().default(""),
  updatedById: varchar("updated_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projectsTable = pgTable("projects", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  focusAreaId: integer("focus_area_id")
    .notNull()
    .references(() => focusAreasTable.id),
  executiveOwnerId: varchar("executive_owner_id").references(() => usersTable.id),
  strategicGoal: text("strategic_goal").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull().default(""),
  createdById: varchar("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembersTable = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groupsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_group_members_group").on(t.groupId), index("idx_group_members_user").on(t.userId)],
);

export const tasksTable = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    projectId: varchar("project_id", { length: 32 })
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    assigneeId: varchar("assignee_id")
      .notNull()
      .references(() => usersTable.id),
    role: varchar("role", { length: 32 }).notNull().default("Owner"),
    description: text("description").notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("Medium"),
    status: varchar("status", { length: 32 }).notNull().default("Not Started"),
    percentComplete: integer("percent_complete").notNull().default(0),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    dependency: text("dependency"),
    roadblock: text("roadblock"),
    lastUpdate: text("last_update"),
    nextStep: text("next_step"),
    blockedById: varchar("blocked_by_id").references(() => usersTable.id),
    blockNotes: text("block_notes"),
    // Upward roadblock escalation. An active escalation has escalatedAt set and
    // escalationResolvedAt null. Routing flows up to a higher-up only; members
    // can never pick a peer as the target.
    escalatedToId: varchar("escalated_to_id").references(() => usersTable.id),
    escalatedById: varchar("escalated_by_id").references(() => usersTable.id),
    escalationOriginalAssigneeId: varchar("escalation_original_assignee_id").references(() => usersTable.id),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalationResolvedById: varchar("escalation_resolved_by_id").references(() => usersTable.id),
    escalationResolvedAt: timestamp("escalation_resolved_at", { withTimezone: true }),
    escalationResolutionNote: text("escalation_resolution_note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Parent task & group for bulk assign
    parentTaskId: integer("parent_task_id"),
    groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "set null" }),
    isGroupParent: boolean("is_group_parent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_tasks_project").on(table.projectId),
    index("idx_tasks_assignee").on(table.assigneeId),
    index("idx_tasks_parent").on(table.parentTaskId),
  ],
);

export const taskAttachmentsTable = pgTable(
  "task_attachments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 256 }).notNull(),
    url: text("url").notNull(),
    addedById: varchar("added_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_task_attachments_task").on(t.taskId)],
);

export const recurringMetricsTable = pgTable("recurring_metrics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull().default(""),
  targetCount: integer("target_count").notNull().default(10),
  cadence: varchar("cadence", { length: 16 }).notNull().default("weekly"),
  appliesTo: varchar("applies_to", { length: 32 }).notNull().default("developers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricEntriesTable = pgTable(
  "metric_entries",
  {
    id: serial("id").primaryKey(),
    metricId: integer("metric_id")
      .notNull()
      .references(() => recurringMetricsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    count: integer("count").notNull().default(0),
    note: text("note"),
    // SF-ready: 'manual' or 'salesforce'
    source: varchar("source", { length: 16 }).notNull().default("manual"),
    lastEvidenceNote: text("last_evidence_note"),
    lastEvidenceUrl: text("last_evidence_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_metric_entries_metric").on(table.metricId),
    index("idx_metric_entries_user_period").on(table.userId, table.periodStart),
  ],
);

export const kpiAuditEntriesTable = pgTable(
  "kpi_audit_entries",
  {
    id: serial("id").primaryKey(),
    metricId: integer("metric_id")
      .notNull()
      .references(() => recurringMetricsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    oldCount: integer("old_count").notNull(),
    newCount: integer("new_count").notNull(),
    source: varchar("source", { length: 16 }).notNull().default("manual"),
    evidenceNote: text("evidence_note"),
    evidenceUrl: text("evidence_url"),
    changedById: varchar("changed_by_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_kpi_audit_metric_user").on(t.metricId, t.userId, t.periodStart),
  ],
);

export const weekLockOverridesTable = pgTable("week_lock_overrides", {
  id: serial("id").primaryKey(),
  periodStart: date("period_start").notNull().unique(),
  unlockedById: varchar("unlocked_by_id")
    .notNull()
    .references(() => usersTable.id),
  reason: text("reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FocusArea = typeof focusAreasTable.$inferSelect;
export type FocusAreaTarget = typeof focusAreaTargetsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
export type InsertTask = typeof tasksTable.$inferInsert;
export type RecurringMetric = typeof recurringMetricsTable.$inferSelect;
export type MetricEntry = typeof metricEntriesTable.$inferSelect;
export type Group = typeof groupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
export type KpiAuditEntry = typeof kpiAuditEntriesTable.$inferSelect;
export type WeekLockOverride = typeof weekLockOverridesTable.$inferSelect;
export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;
