import type { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prismaDB";

/**
 * Raw-SQL helpers on the shared, pgbouncer-aware pooled Prisma client.
 *
 * Why this exists: the driver-tracking API routes used to each create their own
 * unbounded `new (require('pg').Pool)({ connectionString: DATABASE_URL })` at
 * module scope. In Vercel serverless that spins up a separate, uncapped pool per
 * route/instance, all competing with Prisma for the ~20-slot Supabase pooler.
 * Under 20-30 concurrent drivers (each POSTing location every few seconds) those
 * pools exhaust the pooler and unrelated routes (e.g. the history Server
 * Component) start returning 500s. Routing every tracking query through the one
 * tuned singleton fixes that.
 *
 * Every call is wrapped in a transaction that first sets a hard Postgres
 * `statement_timeout`, so a slow query is killed by the database (releasing its
 * pooled connection) instead of hanging up to the socket timeout and starving
 * concurrent drivers. `SET LOCAL` is scoped to the transaction, which is safe
 * under pgbouncer transaction-mode pooling.
 *
 * Placeholders use Postgres `$1, $2, …` exactly like the previous `pg` calls, so
 * call sites only change `pool.query(sql, [a, b]).rows` → `rawQuery(sql, [a, b])`.
 */

/** Default per-statement timeout (ms) for tracking DB work. */
export const TRACKING_STATEMENT_TIMEOUT_MS = 8000;

/** An error carrying an HTTP status + JSON body, thrown from inside a tx so the
 *  route can translate it into the right response (e.g. 403/404) after rollback. */
export class DbHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === "string" ? body.error : "db-http-error");
    this.name = "DbHttpError";
  }
}

/** Run `fn` in one transaction with a hard `statement_timeout`. */
export async function withRawTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  timeoutMs: number = TRACKING_STATEMENT_TIMEOUT_MS,
): Promise<T> {
  const ms = Math.max(1000, Math.trunc(timeoutMs));
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${ms}`);
      return fn(tx);
    },
    { timeout: ms + 2000, maxWait: 4000 },
  );
}

/** Parameterized read returning rows (statement-timeout bounded). */
export function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  timeoutMs?: number,
): Promise<T[]> {
  return withRawTx((tx) => tx.$queryRawUnsafe<T[]>(sql, ...params), timeoutMs);
}

/** Parameterized write with no result set (statement-timeout bounded). Returns
 *  the affected row count. */
export function rawExec(
  sql: string,
  params: unknown[] = [],
  timeoutMs?: number,
): Promise<number> {
  return withRawTx((tx) => tx.$executeRawUnsafe(sql, ...params), timeoutMs);
}
