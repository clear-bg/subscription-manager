import { describe, expect, it } from "vitest";
import { formatMoney, monthlyEquivalent, totalsByCurrency, yearlyEquivalent } from "./amount";
import type { BillingRule } from "./billing-date";

const monthly: BillingRule = { cycle: "monthly", day: 1 };
const yearly: BillingRule = { cycle: "yearly", month: 4, day: 1 };
const weekly: BillingRule = { cycle: "weekly", weekday: 1 };
const quarterly: BillingRule = { cycle: "other", intervalMonths: 3, anchorDate: "2026-01-31" };

describe("月額・年額換算", () => {
  it("月額はそのまま、年額は ÷12、週額は ×52÷12、3か月ごとは ÷3", () => {
    expect(monthlyEquivalent(1490, monthly)).toBe(1490);
    expect(monthlyEquivalent(5900, yearly)).toBeCloseTo(491.667, 3);
    expect(monthlyEquivalent(120, weekly)).toBe(520);
    expect(monthlyEquivalent(3300, quarterly)).toBe(1100);
  });

  it("年額換算", () => {
    expect(yearlyEquivalent(1490, monthly)).toBe(17880);
    expect(yearlyEquivalent(5900, yearly)).toBe(5900);
    expect(yearlyEquivalent(120, weekly)).toBe(6240);
    expect(yearlyEquivalent(3300, quarterly)).toBe(13200);
  });
});

describe("totalsByCurrency", () => {
  it("按分した値を足してから最後に四捨五入する", () => {
    // 5900/12 = 491.67 が2件 → 983.33 → 983（1件ずつ丸めると 984 になる）
    const totals = totalsByCurrency([
      { amount: 5900, currency: "JPY", rule: yearly, status: "active" },
      { amount: 5900, currency: "JPY", rule: yearly, status: "active" },
    ]);
    expect(totals).toEqual([{ currency: "JPY", monthly: 983, yearly: 11800 }]);
  });

  it("利用中と解約検討中だけを算入する", () => {
    const totals = totalsByCurrency([
      { amount: 1000, currency: "JPY", rule: monthly, status: "active" },
      { amount: 200, currency: "JPY", rule: monthly, status: "considering" },
      { amount: 3000, currency: "JPY", rule: monthly, status: "cancel_scheduled" },
      { amount: 4000, currency: "JPY", rule: monthly, status: "paused" },
      { amount: 5000, currency: "JPY", rule: monthly, status: "cancelled" },
    ]);
    expect(totals).toEqual([{ currency: "JPY", monthly: 1200, yearly: 14400 }]);
  });

  it("通貨ごとに分け、円を先頭にする", () => {
    const totals = totalsByCurrency([
      { amount: 20, currency: "USD", rule: monthly, status: "active" },
      { amount: 99.99, currency: "USD", rule: yearly, status: "active" },
      { amount: 1000, currency: "JPY", rule: monthly, status: "active" },
    ]);
    expect(totals).toEqual([
      { currency: "JPY", monthly: 1000, yearly: 12000 },
      { currency: "USD", monthly: 28.33, yearly: 339.99 },
    ]);
  });

  it("対象がなければ空", () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});

describe("formatMoney", () => {
  it("円は整数で桁区切り、外貨は小数第2位まで", () => {
    expect(formatMoney(12345, "JPY")).toBe("12,345円");
    expect(formatMoney(491.67, "JPY")).toBe("492円");
    expect(formatMoney(20, "USD")).toBe("USD 20.00");
  });
});
