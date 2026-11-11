import { describe, expect, it } from "vitest";
import { billingRuleSchema, fieldErrors, subscriptionFormSchema, type SubscriptionFormValues } from "./schema";

const valid: SubscriptionFormValues = {
  name: "  Netflix  ",
  categoryId: "",
  currency: "JPY",
  amount: "1590",
  isVariable: false,
  isManualPurchase: false,
  cycle: "monthly",
  day: "31",
  month: "",
  weekday: "",
  intervalMonths: "",
  anchorDate: "",
  nextBillingDate: "2026-10-31",
  notifyDaysBefore: "3",
  trialEndDate: "",
  url: "",
  memo: "",
};

function errorsOf(values: Partial<SubscriptionFormValues>) {
  const result = subscriptionFormSchema.safeParse({ ...valid, ...values });
  expect(result.success).toBe(false);
  return result.success ? {} : fieldErrors(result.error);
}

describe("subscriptionFormSchema", () => {
  it("正しい入力をデータベースの形に変換する", () => {
    const result = subscriptionFormSchema.parse(valid);
    expect(result).toEqual({
      name: "Netflix",
      category_id: null,
      currency: "JPY",
      amount: 1590,
      is_variable: false,
      is_manual_purchase: false,
      billing_cycle: "monthly",
      billing_rule: { cycle: "monthly", day: 31 },
      next_billing_date: "2026-10-31",
      notify_days_before: 3,
      trial_end_date: null,
      url: null,
      memo: null,
    });
  });

  it("必須項目：サービス名・金額・次回請求日", () => {
    expect(errorsOf({ name: "  " }).name).toBe("サービス名を入力してください");
    expect(errorsOf({ amount: "" }).amount).toBe("金額を入力してください");
    expect(errorsOf({ nextBillingDate: "" }).nextBillingDate).toBe("正しい日付を入力してください");
  });

  it("円は整数、外貨は小数2桁まで", () => {
    expect(errorsOf({ amount: "100.5" }).amount).toBe("円の金額は整数で入力してください");
    expect(errorsOf({ amount: "-100" }).amount).toBeDefined();
    expect(errorsOf({ amount: "1,000" }).amount).toBeDefined();
    expect(errorsOf({ currency: "USD", amount: "20.001" }).amount).toBeDefined();
    expect(subscriptionFormSchema.parse({ ...valid, currency: "USD", amount: "20.99" }).amount).toBe(20.99);
  });

  it("サイクルごとに請求日のルールを組み立てる", () => {
    expect(
      subscriptionFormSchema.parse({ ...valid, cycle: "yearly", month: "2", day: "29" }).billing_rule,
    ).toEqual({ cycle: "yearly", month: 2, day: 29 });
    expect(subscriptionFormSchema.parse({ ...valid, cycle: "weekly", weekday: "0" }).billing_rule).toEqual({
      cycle: "weekly",
      weekday: 0,
    });
    expect(
      subscriptionFormSchema.parse({ ...valid, cycle: "other", intervalMonths: "3", anchorDate: "2026-01-31" })
        .billing_rule,
    ).toEqual({ cycle: "other", intervalMonths: 3, anchorDate: "2026-01-31" });
  });

  it("請求日のルールの誤りは該当する欄のエラーにする", () => {
    expect(errorsOf({ day: "" }).day).toBe("日を選んでください");
    expect(errorsOf({ day: "32" }).day).toBe("日を選んでください");
    expect(errorsOf({ cycle: "yearly", month: "4", day: "31" }).day).toBe("4月に31日はありません");
    expect(errorsOf({ cycle: "weekly", weekday: "" }).weekday).toBe("曜日を選んでください");
    expect(errorsOf({ cycle: "other", intervalMonths: "0", anchorDate: "2026-01-01" }).intervalMonths).toBe(
      "1〜120の整数で入力してください",
    );
    expect(errorsOf({ cycle: "other", intervalMonths: "3", anchorDate: "2026-02-30" }).anchorDate).toBe(
      "正しい日付を入力してください",
    );
  });

  it("URL は http:// と https:// だけ", () => {
    expect(errorsOf({ url: "javascript:alert(1)" }).url).toBeDefined();
    expect(errorsOf({ url: "ftp://example.com" }).url).toBeDefined();
    expect(subscriptionFormSchema.parse({ ...valid, url: "https://example.com/cancel" }).url).toBe(
      "https://example.com/cancel",
    );
  });

  it("自分で購入するものは金額が変動する扱いにする", () => {
    const result = subscriptionFormSchema.parse({ ...valid, isManualPurchase: true });
    expect(result.is_variable).toBe(true);
    expect(result.is_manual_purchase).toBe(true);
  });

  it("通知日数は0〜60", () => {
    expect(errorsOf({ notifyDaysBefore: "61" }).notifyDaysBefore).toBe("0〜60の整数で入力してください");
    expect(errorsOf({ notifyDaysBefore: "" }).notifyDaysBefore).toBe("0〜60の整数で入力してください");
  });
});

describe("billingRuleSchema", () => {
  it("データベースの json を読み込める", () => {
    expect(billingRuleSchema.parse({ cycle: "monthly", day: 31 })).toEqual({ cycle: "monthly", day: 31 });
    expect(billingRuleSchema.safeParse({ cycle: "monthly" }).success).toBe(false);
    expect(billingRuleSchema.safeParse({ cycle: "daily", day: 1 }).success).toBe(false);
  });
});
