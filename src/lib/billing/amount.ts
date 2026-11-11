// 月額・年額換算と合計（設計書 3.3）

import type { BillingRule } from "./billing-date";
import type { Database } from "@/lib/supabase/database.types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

/** 1年あたりの請求回数 */
function chargesPerYear(rule: BillingRule): number {
  switch (rule.cycle) {
    case "monthly":
      return 12;
    case "yearly":
      return 1;
    case "weekly":
      return 52;
    case "other":
      return 12 / rule.intervalMonths;
  }
}

/** 年額換算（丸めない） */
export function yearlyEquivalent(amount: number, rule: BillingRule): number {
  return amount * chargesPerYear(rule);
}

/** 月額換算（丸めない）。年額 → ÷12、週額 → ×52÷12 */
export function monthlyEquivalent(amount: number, rule: BillingRule): number {
  return yearlyEquivalent(amount, rule) / 12;
}

/**
 * 合計に算入する状態（設計書 3.9）。
 * 解約手続き済みは次回請求が発生しないものとして扱い、一時停止中・解約済みも算入しない
 */
export function countsTowardTotal(status: SubscriptionStatus): boolean {
  return status === "active" || status === "considering";
}

export type TotalInput = { amount: number; currency: string; rule: BillingRule; status: SubscriptionStatus };

export type CurrencyTotal = { currency: string; monthly: number; yearly: number };

/**
 * 通貨ごとの月額・年額合計。按分した値を足してから最後に丸める。
 * 円は1円未満を四捨五入、外貨は小数第2位まで
 */
export function totalsByCurrency(items: TotalInput[]): CurrencyTotal[] {
  const sums = new Map<string, { monthly: number; yearly: number }>();
  for (const item of items) {
    if (!countsTowardTotal(item.status)) continue;
    const sum = sums.get(item.currency) ?? { monthly: 0, yearly: 0 };
    sum.monthly += monthlyEquivalent(item.amount, item.rule);
    sum.yearly += yearlyEquivalent(item.amount, item.rule);
    sums.set(item.currency, sum);
  }
  return [...sums.entries()]
    .map(([currency, sum]) => ({
      currency,
      monthly: roundForCurrency(sum.monthly, currency),
      yearly: roundForCurrency(sum.yearly, currency),
    }))
    .sort((a, b) => (a.currency === "JPY" ? -1 : b.currency === "JPY" ? 1 : a.currency.localeCompare(b.currency)));
}

export function roundForCurrency(value: number, currency: string): number {
  if (currency === "JPY") return Math.round(value);
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number, currency: string): string {
  if (currency === "JPY") return `${Math.round(value).toLocaleString("ja-JP")}円`;
  return `${currency} ${value.toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
