import { db, weekLockOverridesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

export function priorMonday(weeks: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return mondayOf(d);
}

/**
 * Prior week becomes locked at this week's Monday 9:00am UTC.
 * Returns the timestamp at which the lock is/was effective.
 */
export function lockEffectiveAt(): Date {
  const now = new Date();
  const monday = mondayOf(now);
  return new Date(`${monday}T09:00:00Z`);
}

export function isWeekLocked(periodStart: string): boolean {
  const now = new Date();
  const currentWeek = mondayOf(now);
  if (periodStart >= currentWeek) return false;
  const effective = lockEffectiveAt();
  return now >= effective;
}

export async function hasUnlockOverride(periodStart: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(weekLockOverridesTable)
    .where(eq(weekLockOverridesTable.periodStart, periodStart));
  return !!row;
}

export async function canEditWeek(periodStart: string): Promise<boolean> {
  if (!isWeekLocked(periodStart)) return true;
  return await hasUnlockOverride(periodStart);
}
