import {
  boolean,
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
