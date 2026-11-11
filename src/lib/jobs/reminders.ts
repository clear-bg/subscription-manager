// 請求日前の通知と、次回請求日の更新（設計書 3.4、9.1 段階1）。データベースに依存しない計算だけを置く

import { formatMoney } from "@/lib/billing/amount";
import { rollForwardBillingDate, type BillingRule } from "@/lib/billing/billing-date";
import { daysBetween, type DateString } from "@/lib/date/calendar";
import { formatDateJa } from "@/lib/subscriptions/labels";
import type { Database } from "@/lib/supabase/database.types";

export type ReminderSubscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  is_variable: boolean;
  is_manual_purchase: boolean;
  status: Database["public"]["Enums"]["subscription_status"];
  next_billing_date: DateString;
  notify_days_before: number;
  rule: BillingRule;
};

export type Reminder = { subscriptionId: string; billingDate: DateString; text: string };

/** 請求が発生する状態（設計書 3.9）。解約手続き済み・一時停止中・解約済みには通知しない */
function isBilled(subscription: ReminderSubscription): boolean {
  return subscription.status === "active" || subscription.status === "considering";
}

/** 次回請求日を過ぎたものを、今日以降の請求日に進める。変わったものだけ返す */
export function rollForwardAll(
  subscriptions: ReminderSubscription[],
  today: DateString,
): { id: string; nextBillingDate: DateString }[] {
  return subscriptions
    .filter(isBilled)
    .map((subscription) => ({
      id: subscription.id,
      nextBillingDate: rollForwardBillingDate(subscription.rule, subscription.next_billing_date, today),
      current: subscription.next_billing_date,
    }))
    .filter((change) => change.nextBillingDate !== change.current)
    .map(({ id, nextBillingDate }) => ({ id, nextBillingDate }));
}

function daysLabel(days: number): string {
  if (days === 0) return "今日";
  if (days === 1) return "明日";
  return `${days}日後`;
}

/** 通知の文面。通知にはサービス名・金額・日付だけを含める（設計書 7.4） */
export function reminderText(subscription: ReminderSubscription, today: DateString): string {
  const days = daysBetween(today, subscription.next_billing_date);
  const when = `${daysLabel(days)}（${formatDateJa(subscription.next_billing_date)}）`;
  const money = formatMoney(subscription.amount, subscription.currency);

  if (subscription.is_manual_purchase) {
    return `${when}は${subscription.name}の購入予定日です（目安：${money}）`;
  }
  if (subscription.is_variable) {
    return `${when}に${subscription.name}の請求があります（目安：${money}）`;
  }
  return `${when}に${subscription.name} ${money}の請求があります`;
}

/** 今日が「次回請求日の N 日前」にあたるものの通知（次回請求日は更新済みのものを渡す） */
export function dueReminders(subscriptions: ReminderSubscription[], today: DateString): Reminder[] {
  return subscriptions
    .filter(isBilled)
    .filter((subscription) => daysBetween(today, subscription.next_billing_date) === subscription.notify_days_before)
    .sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date) || a.name.localeCompare(b.name, "ja"))
    .map((subscription) => ({
      subscriptionId: subscription.id,
      billingDate: subscription.next_billing_date,
      text: reminderText(subscription, today),
    }));
}

/** 送れなかった通知の記録（定期実行ログに保存し、翌日に再送する） */
export type UnsentReminder = { subscriptionId: string; billingDate: DateString };

/**
 * 前回送れなかった通知の扱い（設計書 9.4）。
 * 請求日がまだ来ておらず、請求日が変わっていないものは今日の日付で文面を作り直して再送する。
 * 請求日を過ぎたものは件数だけ伝える
 */
export function carryOverUnsent(
  unsent: UnsentReminder[],
  subscriptions: ReminderSubscription[],
  today: DateString,
): { resend: Reminder[]; expiredCount: number } {
  const byId = new Map(subscriptions.filter(isBilled).map((subscription) => [subscription.id, subscription]));
  const resend: Reminder[] = [];
  let expiredCount = 0;
  for (const item of unsent) {
    if (item.billingDate < today) {
      expiredCount += 1;
      continue;
    }
    const subscription = byId.get(item.subscriptionId);
    // 削除・解約された、または請求日が変わったものは送らない
    if (!subscription || subscription.next_billing_date !== item.billingDate) continue;
    resend.push({ subscriptionId: item.subscriptionId, billingDate: item.billingDate, text: reminderText(subscription, today) });
  }
  return { resend, expiredCount };
}

/** Discord に送る行を組み立てる */
export function buildMessageLines(
  today: DateString,
  reminders: Reminder[],
  carried: { resend: Reminder[]; expiredCount: number },
): string[] {
  const lines: string[] = [];
  if (reminders.length > 0) {
    lines.push(`**請求日のお知らせ**（${formatDateJa(today)}）`);
    lines.push(...reminders.map((reminder) => `・${reminder.text}`));
  }
  if (carried.resend.length > 0) {
    lines.push("**前日に送れなかった通知**");
    lines.push(...carried.resend.map((reminder) => `・${reminder.text}`));
  }
  if (carried.expiredCount > 0) {
    lines.push(`※ ${carried.expiredCount}件の通知を送れませんでした（請求日を過ぎたため省略）`);
  }
  return lines;
}
