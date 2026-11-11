// 画面に出す表示名
import type { BillingRule } from "@/lib/billing/billing-date";
import { dayOfWeek, parseDate, type DateString } from "@/lib/date/calendar";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const CYCLE_LABELS: Record<Enums["billing_cycle"], string> = {
  monthly: "月額",
  yearly: "年額",
  weekly: "週額",
  other: "◯か月ごと",
};

export const STATUS_LABELS: Record<Enums["subscription_status"], string> = {
  active: "利用中",
  considering: "解約検討中",
  cancel_scheduled: "解約手続き済み",
  paused: "一時停止中",
  cancelled: "解約済み",
};

export function ruleLabel(rule: BillingRule): string {
  switch (rule.cycle) {
    case "monthly":
      return `毎月${rule.day}日`;
    case "yearly":
      return `毎年${rule.month}月${rule.day}日`;
    case "weekly":
      return `毎週${WEEKDAY_LABELS[rule.weekday]}曜日`;
    case "other":
      return `${rule.intervalMonths}か月ごと`;
  }
}

/** "2026-10-31" → "2026/10/31（土）" */
export function formatDateJa(value: DateString): string {
  const { year, month, day } = parseDate(value);
  return `${year}/${month}/${day}（${WEEKDAY_LABELS[dayOfWeek(value)]}）`;
}
