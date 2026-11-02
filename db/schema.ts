import { pgTable, text, integer, timestamp, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// One row per order, scoped to the Netlify Identity user (the "store"). `id` is the client-generated
// order ID (same as in localStorage / Google Sheet), so re-sending an order never duplicates it.
export const orders = pgTable("orders", {
  userId: text("user_id").notNull(),
  id: text().notNull(),
  customer: text().notNull().default(""),
  app: text().notNull().default(""),
  plan: text().notNull().default(""),
  users: text().notNull().default(""),
  date: text().notNull().default(""),
  duration: integer().notNull().default(0),
  unit: text().notNull().default("days"),
  account: text().notNull().default(""),
  fh: text().notNull().default(""),
  income: integer().notNull().default(0),
  expense: integer().notNull().default(0),
  discount: integer().notNull().default(0),
  status: text().notNull().default("active"),
  notes: text().notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  deleted: integer().notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] }), index("orders_user_synced_idx").on(t.userId, t.syncedAt)]);

// Custom dropdown choices (kind: app | plan | users). Names are unique per user + kind, case-insensitive.
export const customOptions = pgTable("custom_options", {
  id: text().primaryKey(),
  userId: text("user_id").notNull(),
  kind: text().notNull(),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("custom_options_unique_name").on(t.userId, t.kind, sql`lower(${t.name})`)]);
