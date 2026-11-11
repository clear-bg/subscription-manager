// 請求日のルール（設計書 3.11）と次回請求日の計算。
// subscriptions.billing_rule（json）にはこの BillingRule の形で保存する。

import {
  addDays,
  clampedDate,
  dayOfWeek,
  parseDate,
  type DateString,
} from "@/lib/date/calendar";

export type BillingRule =
  /** 毎月◯日（1〜31）。該当日がない月は月末 */
  | { cycle: "monthly"; day: number }
  /** 毎年◯月◯日。2月29日はうるう年以外は2月28日 */
  | { cycle: "yearly"; month: number; day: number }
  /** 毎週◯曜日（0＝日曜〜6＝土曜） */
  | { cycle: "weekly"; weekday: number }
  /** 基準日から◯か月ごと。日は基準日と同じで、該当日がない月は月末 */
  | { cycle: "other"; intervalMonths: number; anchorDate: DateString };

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function assertValidRule(rule: BillingRule): void {
  const valid = (() => {
    switch (rule.cycle) {
      case "monthly":
        return isIntegerInRange(rule.day, 1, 31);
      case "yearly":
        return isIntegerInRange(rule.month, 1, 12) && isIntegerInRange(rule.day, 1, 31);
      case "weekly":
        return isIntegerInRange(rule.weekday, 0, 6);
      case "other":
        parseDate(rule.anchorDate);
        return isIntegerInRange(rule.intervalMonths, 1, 120);
    }
  })();
  if (!valid) throw new Error(`請求日のルールが正しくありません: ${JSON.stringify(rule)}`);
}

/** from 以降（from 当日を含む）で最初の請求日 */
export function nextBillingDateOnOrAfter(rule: BillingRule, from: DateString): DateString {
  assertValidRule(rule);
  const { year, month } = parseDate(from);

  switch (rule.cycle) {
    case "monthly": {
      const thisMonth = clampedDate(year, month, rule.day);
      return thisMonth >= from ? thisMonth : clampedDate(year, month + 1, rule.day);
    }
    case "yearly": {
      const thisYear = clampedDate(year, rule.month, rule.day);
      return thisYear >= from ? thisYear : clampedDate(year + 1, rule.month, rule.day);
    }
    case "weekly": {
      const daysAhead = (rule.weekday - dayOfWeek(from) + 7) % 7;
      return addDays(from, daysAhead);
    }
    case "other": {
      // 基準日より前の請求はない
      if (from <= rule.anchorDate) return rule.anchorDate;
      const anchor = parseDate(rule.anchorDate);
      const monthsSinceAnchor = (year - anchor.year) * 12 + (month - anchor.month);
      let count = Math.floor(monthsSinceAnchor / rule.intervalMonths);
      let candidate = clampedDate(anchor.year, anchor.month + count * rule.intervalMonths, anchor.day);
      while (candidate < from) {
        count += 1;
        candidate = clampedDate(anchor.year, anchor.month + count * rule.intervalMonths, anchor.day);
      }
      return candidate;
    }
  }
}

/** current の次の請求日（current 当日は含まない） */
export function followingBillingDate(rule: BillingRule, current: DateString): DateString {
  return nextBillingDateOnOrAfter(rule, addDays(current, 1));
}

/**
 * 次回請求日を過ぎていたら、今日以降の請求日まで進める（段階1の定期実行用。設計書 9.1）。
 * 請求日が今日なら進めない。手動で上書きした日付が過ぎた場合も、ルールに沿った日付に戻る。
 */
export function rollForwardBillingDate(
  rule: BillingRule,
  current: DateString,
  today: DateString,
): DateString {
  if (current >= today) return current;
  return nextBillingDateOnOrAfter(rule, today);
}
