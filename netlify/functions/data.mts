// Cloud sync for Primpaii's Way. Every request is tied to the logged-in Netlify Identity user, and every query is
// scoped by that user's id, so one account (store) can never read or change another account's data.
//   POST /api/sync    { since, changes:[order | {id, deleted:true, updatedAt}] } → { now, orders, options }
//   POST /api/options { action:'add'|'rename'|'delete', kind, id, name }        → { options }
import type { Config } from "@netlify/functions";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, customOptions } from "../../db/schema.js";

const KINDS = ["app", "plan", "users"];
const UNITS = ["days", "weeks", "months", "years"];
const STATUSES = ["active", "completed", "cancelled"];
const MAX_BATCH = 500;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => Math.max(0, Math.min(2_000_000_000, Math.round(Number(v) || 0)));

function cleanOrder(o: any, userId: string) {
  const id = str(o?.id, 80);
  if (!id) return null;
  const updatedAt = str(o.updatedAt, 40) || new Date().toISOString();
  if (o.deleted) return { userId, id, updatedAt, deleted: 1 };
  return {
    userId, id, updatedAt, deleted: 0,
    customer: str(o.customer, 200), app: str(o.app, 120), plan: str(o.plan, 120), users: str(o.users, 60),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "",
    duration: int(o.duration), unit: UNITS.includes(o.unit) ? o.unit : "days",
    account: str(o.account, 200), fh: str(o.fh, 200),
    income: int(o.income), expense: int(o.expense), discount: int(o.discount),
    status: STATUSES.includes(o.status) ? o.status : "active", notes: str(o.notes, 2000),
  };
}
const toClient = (r: typeof orders.$inferSelect) => r.deleted ? { id: r.id, deleted: true } : {
  id: r.id, customer: r.customer, app: r.app, plan: r.plan, users: r.users, date: r.date, duration: r.duration, unit: r.unit,
  account: r.account, fh: r.fh, income: r.income, expense: r.expense, discount: r.discount, status: r.status, notes: r.notes, updatedAt: r.updatedAt,
};
const listOptions = (userId: string) =>
  db.select({ id: customOptions.id, kind: customOptions.kind, name: customOptions.name }).from(customOptions)
    .where(eq(customOptions.userId, userId)).orderBy(customOptions.createdAt);

async function sync(body: any, userId: string) {
  const changes = (Array.isArray(body.changes) ? body.changes : []).slice(0, MAX_BATCH).map((o: any) => cleanOrder(o, userId)).filter(Boolean);
  const stamp = new Date();
  for (const row of changes) {
    // Last write wins by the client's updatedAt, so a late retry of an old edit can't overwrite a newer one.
    await db.insert(orders).values({ ...row, syncedAt: stamp }).onConflictDoUpdate({
      target: [orders.userId, orders.id],
      set: { ...Object.fromEntries(Object.keys(row).filter((k) => k !== "userId" && k !== "id").map((k) => [k, (row as any)[k]])), syncedAt: stamp },
      setWhere: sql`excluded.updated_at >= ${orders.updatedAt}`,
    });
  }
  const since = Date.parse(body.since);
  // A small overlap window catches rows committed by a concurrent request; the client merges idempotently by id.
  const rows = Number.isFinite(since)
    ? await db.select().from(orders).where(and(eq(orders.userId, userId), gt(orders.syncedAt, new Date(since - 10_000))))
    : await db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.deleted, 0)));
  return { now: stamp.toISOString(), full: !Number.isFinite(since), orders: rows.map(toClient), options: await listOptions(userId) };
}

async function options(body: any, userId: string) {
  const kind = String(body.kind), id = str(body.id, 80), name = str(body.name, 60);
  if (!KINDS.includes(kind)) return json({ error: "Unknown option type" }, 400);
  if (body.action === "delete") {
    await db.delete(customOptions).where(and(eq(customOptions.userId, userId), eq(customOptions.id, id)));
  } else if (body.action === "add" || body.action === "rename") {
    if (!name) return json({ error: "Name is required" }, 400);
    const clash = await db.select({ id: customOptions.id }).from(customOptions)
      .where(and(eq(customOptions.userId, userId), eq(customOptions.kind, kind), sql`lower(${customOptions.name}) = lower(${name})`));
    if (clash.some((c) => c.id !== id)) return json({ error: "duplicate" }, 409);
    try {
      if (body.action === "add") await db.insert(customOptions).values({ id: id || crypto.randomUUID(), userId, kind, name }).onConflictDoNothing();
      else await db.update(customOptions).set({ name, updatedAt: new Date() }).where(and(eq(customOptions.userId, userId), eq(customOptions.id, id)));
    } catch {
      return json({ error: "duplicate" }, 409);
    }
  } else return json({ error: "Unknown action" }, 400);
  return json({ options: await listOptions(userId) });
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try { verifyRequestOrigin(req); } catch { return json({ error: "Forbidden" }, 403); }
  const user = await getUser();
  if (!user?.id) return json({ error: "Unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  try {
    return new URL(req.url).pathname === "/api/options" ? await options(body, user.id) : json(await sync(body, user.id));
  } catch (err) {
    console.error("data api error", err);
    return json({ error: "Server error" }, 500);
  }
};

export const config: Config = { path: ["/api/sync", "/api/options"] };
