import type { DateString } from "./calendar";

const tokyoFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 日本時間の「今日」を "YYYY-MM-DD" で返す。
 * 日付の判定はすべてこの関数を通し、new Date() を直接使わない（設計書 9.2）。
 * now はテストで時刻を固定するための引数。
 */
export function todayInTokyo(now: Date = new Date()): DateString {
  const parts = tokyoFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
