import { sql } from "drizzle-orm"
import {
  boolean,
  uniqueIndex,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const snapshots = pgTable("snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleId: text("cycle_id").notNull(),
  teamKey: text("team_key").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
  contentHash: text("content_hash").notNull(),
})

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  snapshotId: uuid("snapshot_id")
    .notNull()
    .references(() => snapshots.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  model: text("model").notNull(),
  payload: jsonb("payload").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
})

export const syncLog = pgTable("sync_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source", { enum: ["webhook", "poll", "manual"] }).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  changed: boolean("changed").notNull(),
  error: text("error"),
})

export const allowedUsers = pgTable("allowed_users", {
  email: text("email").primaryKey(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
})

export const planningStages = pgTable("planning_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamKey: text("team_key").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  archived: boolean("archived").notNull().default(false),
  createdBy: text("created_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const planningItems = pgTable(
  "planning_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => planningStages.id, { onDelete: "cascade" }),
    issueId: text("issue_id").notNull(),
    identifier: text("identifier").notNull(),
    included: boolean("included").notNull().default(true),
    token: uuid("token").notNull().defaultRandom(),
  },
  (table) => [
    uniqueIndex("planning_item_membership").on(table.stageId, table.issueId),
  ]
)

export const planningTransfers = pgTable("planning_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => planningStages.id),
  cycleId: text("cycle_id").notNull(),
  cycleName: text("cycle_name").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const planningTransferItems = pgTable(
  "planning_transfer_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => planningTransfers.id),
    issueId: text("issue_id").notNull(),
    identifier: text("identifier").notNull(),
    beforeCycleId: text("before_cycle_id"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    attempted: boolean("attempted").notNull().default(false),
    lockToken: uuid("lock_token"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("planning_transfer_issue").on(table.transferId, table.issueId),
    uniqueIndex("planning_issue_in_flight")
      .on(table.issueId)
      .where(sql`${table.status} in ('applying', 'undoing')`),
  ]
)
