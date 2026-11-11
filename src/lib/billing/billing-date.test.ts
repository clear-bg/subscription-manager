import { describe, expect, it } from "vitest";
import {
  followingBillingDate,
  nextBillingDateOnOrAfter,
  rollForwardBillingDate,
  type BillingRule,
} from "./billing-date";

describe("毎月◯日", () => {
  const day31: BillingRule = { cycle: "monthly", day: 31 };

  it("当日は請求日に含む", () => {
    expect(nextBillingDateOnOrAfter(day31, "2026-03-31")).toBe("2026-03-31");
  });

  it("31日請求は、31日がない月は月末", () => {
    expect(nextBillingDateOnOrAfter(day31, "2026-01-15")).toBe("2026-01-31");
    expect(nextBillingDateOnOrAfter(day31, "2026-02-01")).toBe("2026-02-28");
    expect(nextBillingDateOnOrAfter(day31, "2028-02-01")).toBe("2028-02-29");
    expect(nextBillingDateOnOrAfter(day31, "2026-04-01")).toBe("2026-04-30");
  });

  it("月末に寄せた翌月は31日に戻る", () => {
    expect(followingBillingDate(day31, "2026-02-28")).toBe("2026-03-31");
    expect(followingBillingDate(day31, "2026-04-30")).toBe("2026-05-31");
  });

  it("年をまたぐ", () => {
    expect(followingBillingDate(day31, "2026-12-31")).toBe("2027-01-31");
    expect(nextBillingDateOnOrAfter({ cycle: "monthly", day: 1 }, "2026-12-02")).toBe("2027-01-01");
  });

  it("29日・30日請求の2月", () => {
    expect(nextBillingDateOnOrAfter({ cycle: "monthly", day: 29 }, "2026-02-01")).toBe("2026-02-28");
    expect(nextBillingDateOnOrAfter({ cycle: "monthly", day: 29 }, "2028-02-01")).toBe("2028-02-29");
    expect(nextBillingDateOnOrAfter({ cycle: "monthly", day: 30 }, "2026-02-01")).toBe("2026-02-28");
  });
});

describe("毎年◯月◯日", () => {
  const leapDay: BillingRule = { cycle: "yearly", month: 2, day: 29 };

  it("2月29日は、うるう年以外は2月28日", () => {
    expect(nextBillingDateOnOrAfter(leapDay, "2026-03-01")).toBe("2027-02-28");
    expect(nextBillingDateOnOrAfter(leapDay, "2027-03-01")).toBe("2028-02-29");
    expect(followingBillingDate(leapDay, "2028-02-29")).toBe("2029-02-28");
    expect(followingBillingDate(leapDay, "2027-02-28")).toBe("2028-02-29");
  });

  it("今年の請求日を過ぎていたら来年", () => {
    const april1: BillingRule = { cycle: "yearly", month: 4, day: 1 };
    expect(nextBillingDateOnOrAfter(april1, "2026-04-01")).toBe("2026-04-01");
    expect(nextBillingDateOnOrAfter(april1, "2026-04-02")).toBe("2027-04-01");
  });
});

describe("毎週◯曜日", () => {
  const monday: BillingRule = { cycle: "weekly", weekday: 1 };

  it("次の月曜日", () => {
    expect(nextBillingDateOnOrAfter(monday, "2026-10-30")).toBe("2026-11-02"); // 金曜から
    expect(nextBillingDateOnOrAfter(monday, "2026-11-02")).toBe("2026-11-02"); // 当日
    expect(followingBillingDate(monday, "2026-11-02")).toBe("2026-11-09");
  });

  it("年をまたぐ", () => {
    expect(nextBillingDateOnOrAfter(monday, "2026-12-29")).toBe("2027-01-04");
  });
});

describe("◯か月ごと", () => {
  const quarterly: BillingRule = { cycle: "other", intervalMonths: 3, anchorDate: "2026-01-31" };

  it("基準日より前なら基準日", () => {
    expect(nextBillingDateOnOrAfter(quarterly, "2025-12-01")).toBe("2026-01-31");
    expect(nextBillingDateOnOrAfter(quarterly, "2026-01-31")).toBe("2026-01-31");
  });

  it("基準日の日が該当しない月は月末", () => {
    expect(nextBillingDateOnOrAfter(quarterly, "2026-02-01")).toBe("2026-04-30");
    expect(followingBillingDate(quarterly, "2026-04-30")).toBe("2026-07-31");
  });

  it("年をまたぐ", () => {
    expect(nextBillingDateOnOrAfter(quarterly, "2026-11-01")).toBe("2027-01-31");
  });

  it("2か月ごと・2月を通る", () => {
    const bimonthly: BillingRule = { cycle: "other", intervalMonths: 2, anchorDate: "2027-12-30" };
    expect(followingBillingDate(bimonthly, "2027-12-30")).toBe("2028-02-29");
    expect(followingBillingDate(bimonthly, "2028-02-29")).toBe("2028-04-30");
  });
});

describe("rollForwardBillingDate（段階1の定期実行）", () => {
  const day31: BillingRule = { cycle: "monthly", day: 31 };

  it("請求日が今日以降なら進めない", () => {
    expect(rollForwardBillingDate(day31, "2026-03-31", "2026-03-31")).toBe("2026-03-31");
    expect(rollForwardBillingDate(day31, "2026-03-31", "2026-03-01")).toBe("2026-03-31");
  });

  it("過ぎていたら今日以降の請求日まで進める", () => {
    expect(rollForwardBillingDate(day31, "2026-01-31", "2026-02-01")).toBe("2026-02-28");
    // 定期実行が止まって何か月も過ぎていても、一度で今日以降に進む
    expect(rollForwardBillingDate(day31, "2026-01-31", "2026-05-05")).toBe("2026-05-31");
  });

  it("手動で上書きした日付が過ぎたら、ルールの日付に戻る", () => {
    expect(rollForwardBillingDate(day31, "2026-02-10", "2026-02-11")).toBe("2026-02-28");
  });
});

describe("ルールの検証", () => {
  it.each<BillingRule>([
    { cycle: "monthly", day: 0 },
    { cycle: "monthly", day: 32 },
    { cycle: "monthly", day: 1.5 },
    { cycle: "yearly", month: 13, day: 1 },
    { cycle: "weekly", weekday: 7 },
    { cycle: "other", intervalMonths: 0, anchorDate: "2026-01-01" },
    { cycle: "other", intervalMonths: 3, anchorDate: "2026-02-30" },
  ])("不正なルール %j はエラー", (rule) => {
    expect(() => nextBillingDateOnOrAfter(rule, "2026-01-01")).toThrow();
  });
});
