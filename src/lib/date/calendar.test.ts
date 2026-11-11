import { describe, expect, it } from "vitest";
import {
  addDays,
  clampedDate,
  dayOfWeek,
  daysBetween,
  daysInMonth,
  isLeapYear,
  parseDate,
} from "./calendar";

describe("isLeapYear", () => {
  it.each([
    [2024, true],
    [2026, false],
    [2028, true],
    [1900, false],
    [2000, true],
    [2100, false],
  ])("%i 年 → %s", (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });
});

describe("daysInMonth", () => {
  it("月ごとの日数", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("parseDate", () => {
  it("正しい日付を分解する", () => {
    expect(parseDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-1", ""])(
    "不正な日付 %s はエラー",
    (value) => {
      expect(() => parseDate(value)).toThrow();
    },
  );
});

describe("addDays", () => {
  it("月末・年末をまたぐ", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("うるう日をまたぐ", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("通知日（請求日の3日前）を求める", () => {
    expect(addDays("2026-03-02", -3)).toBe("2026-02-27");
  });
});

describe("daysBetween", () => {
  it("日数の差", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-11-02", "2026-10-30")).toBe(-3);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-01-01", "2029-01-01")).toBe(366);
  });
});

describe("dayOfWeek", () => {
  it("曜日（0＝日曜）", () => {
    expect(dayOfWeek("2026-10-30")).toBe(5); // 金曜
    expect(dayOfWeek("2026-11-01")).toBe(0); // 日曜
  });
});

describe("clampedDate", () => {
  it("該当日がない月は月末にする", () => {
    expect(clampedDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampedDate(2028, 2, 31)).toBe("2028-02-29");
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
    expect(clampedDate(2026, 3, 31)).toBe("2026-03-31");
  });

  it("月の繰り上げ・繰り下げで年をまたぐ", () => {
    expect(clampedDate(2026, 13, 15)).toBe("2027-01-15");
    expect(clampedDate(2026, 14, 31)).toBe("2027-02-28");
    expect(clampedDate(2026, 0, 31)).toBe("2025-12-31");
  });
});
