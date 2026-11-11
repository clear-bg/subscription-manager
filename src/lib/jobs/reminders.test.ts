import { describe, expect, it } from "vitest";
import {
  buildMessageLines,
  carryOverUnsent,
  dueReminders,
  reminderText,
  rollForwardAll,
  type ReminderSubscription,
} from "./reminders";

function sub(overrides: Partial<ReminderSubscription>): ReminderSubscription {
  return {
    id: "id-1",
    name: "Netflix",
    amount: 1590,
    currency: "JPY",
    is_variable: false,
    is_manual_purchase: false,
    status: "active",
    next_billing_date: "2026-11-02",
    notify_days_before: 3,
    rule: { cycle: "monthly", day: 31 },
    ...overrides,
  };
}

describe("reminderText", () => {
  it("通常の請求", () => {
    expect(reminderText(sub({}), "2026-10-30")).toBe("3日後（2026/11/2（月））にNetflix 1,590円の請求があります");
  });

  it("今日・明日", () => {
    expect(reminderText(sub({ next_billing_date: "2026-10-30" }), "2026-10-30")).toMatch(/^今日（/);
    expect(reminderText(sub({ next_billing_date: "2026-10-31" }), "2026-10-30")).toMatch(/^明日（/);
  });

  it("金額が変動するものは目安", () => {
    expect(reminderText(sub({ name: "電気代", amount: 8000, is_variable: true }), "2026-10-30")).toBe(
      "3日後（2026/11/2（月））に電気代の請求があります（目安：8,000円）",
    );
  });

  it("自分で購入するものは購入予定日", () => {
    expect(
      reminderText(sub({ name: "コンタクトレンズ", amount: 3000, is_variable: true, is_manual_purchase: true }), "2026-10-30"),
    ).toBe("3日後（2026/11/2（月））はコンタクトレンズの購入予定日です（目安：3,000円）");
  });

  it("外貨建て", () => {
    expect(reminderText(sub({ name: "ChatGPT Plus", amount: 20, currency: "USD" }), "2026-10-30")).toBe(
      "3日後（2026/11/2（月））にChatGPT Plus USD 20.00の請求があります",
    );
  });
});

describe("dueReminders", () => {
  it("次回請求日の N 日前だけ通知する", () => {
    const subs = [
      sub({ id: "a", next_billing_date: "2026-11-02", notify_days_before: 3 }),
      sub({ id: "b", next_billing_date: "2026-11-03", notify_days_before: 3 }),
      sub({ id: "c", next_billing_date: "2026-10-30", notify_days_before: 0 }),
    ];
    expect(dueReminders(subs, "2026-10-30").map((reminder) => reminder.subscriptionId)).toEqual(["c", "a"]);
  });

  it("請求が発生しない状態には通知しない", () => {
    const subs = [
      sub({ id: "considering", status: "considering" }),
      sub({ id: "cancel_scheduled", status: "cancel_scheduled" }),
      sub({ id: "paused", status: "paused" }),
      sub({ id: "cancelled", status: "cancelled" }),
    ];
    expect(dueReminders(subs, "2026-10-30").map((reminder) => reminder.subscriptionId)).toEqual(["considering"]);
  });

  it("月またぎ・年またぎ", () => {
    expect(dueReminders([sub({ next_billing_date: "2027-01-01" })], "2026-12-29")).toHaveLength(1);
  });
});

describe("rollForwardAll", () => {
  it("過ぎた次回請求日だけ今日以降に進める", () => {
    const subs = [
      sub({ id: "past", next_billing_date: "2026-09-30" }),
      sub({ id: "today", next_billing_date: "2026-10-30" }),
      sub({ id: "future", next_billing_date: "2026-11-30" }),
      sub({ id: "paused", next_billing_date: "2026-09-30", status: "paused" }),
    ];
    expect(rollForwardAll(subs, "2026-10-30")).toEqual([{ id: "past", nextBillingDate: "2026-10-31" }]);
  });

  it("31日請求は月末に寄せる", () => {
    expect(rollForwardAll([sub({ next_billing_date: "2027-01-31" })], "2027-02-01")).toEqual([
      { id: "id-1", nextBillingDate: "2027-02-28" },
    ]);
  });
});

describe("carryOverUnsent", () => {
  it("請求日前のものは今日の日付で文面を作り直して再送し、過ぎたものは件数だけ", () => {
    const subs = [sub({ id: "a", next_billing_date: "2026-11-02" })];
    const result = carryOverUnsent(
      [
        { subscriptionId: "a", billingDate: "2026-11-02" },
        { subscriptionId: "b", billingDate: "2026-10-30" },
      ],
      subs,
      "2026-10-31",
    );
    expect(result.resend).toEqual([
      { subscriptionId: "a", billingDate: "2026-11-02", text: "2日後（2026/11/2（月））にNetflix 1,590円の請求があります" },
    ]);
    expect(result.expiredCount).toBe(1);
  });

  it("削除・解約された、または請求日が変わったものは送らない", () => {
    const subs = [sub({ id: "moved", next_billing_date: "2026-11-05" }), sub({ id: "paused", status: "paused" })];
    const result = carryOverUnsent(
      [
        { subscriptionId: "deleted", billingDate: "2026-11-02" },
        { subscriptionId: "moved", billingDate: "2026-11-02" },
        { subscriptionId: "paused", billingDate: "2026-11-02" },
      ],
      subs,
      "2026-10-31",
    );
    expect(result).toEqual({ resend: [], expiredCount: 0 });
  });
});

describe("buildMessageLines", () => {
  it("何もなければ空（Discord には送らない）", () => {
    expect(buildMessageLines("2026-10-30", [], { resend: [], expiredCount: 0 })).toEqual([]);
  });

  it("今日の通知・前日分・送れなかった件数をまとめる", () => {
    const lines = buildMessageLines(
      "2026-10-30",
      [{ subscriptionId: "a", billingDate: "2026-11-02", text: "A" }],
      { resend: [{ subscriptionId: "b", billingDate: "2026-11-01", text: "B" }], expiredCount: 2 },
    );
    expect(lines).toEqual([
      "**請求日のお知らせ**（2026/10/30（金））",
      "・A",
      "**前日に送れなかった通知**",
      "・B",
      "※ 2件の通知を送れませんでした（請求日を過ぎたため省略）",
    ]);
  });
});
