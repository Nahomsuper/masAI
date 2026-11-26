/** Days are represented as `YYYY-MM-DD` strings in local time. */
const MS_PER_DAY = 86_400_000;

export const todayISO = () => toISODate(new Date());

/** Formats a Date as `YYYY-MM-DD` using local calendar values. */
export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` into a local-noon Date so DST never shifts the day. */
export function parseISODate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Adds whole days to a `YYYY-MM-DD` string. */
export function addDays(value, days) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Every `YYYY-MM-DD` from `from` to `to` inclusive. */
export function dateRange(from, to) {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addDays(from, index));
}

/** Clamps a number into a range. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Rounds to a whole number safely. */
export const round = (value) => Math.round(Number.isFinite(value) ? value : 0);

/** ISO timestamp for `created_at` style columns. */
export const nowISO = () => new Date().toISOString();
