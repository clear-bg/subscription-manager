import { describe, expect, it } from "vitest";
import { todayInTokyo } from "./today";

describe("todayInTokyo", () => {
  it("UTC 15:00 で日本時間の日付が変わる", () => {
    expect(todayInTokyo(new Date("2026-10-30T14:59:59Z"))).toBe("2026-10-30");
    expect(todayInTokyo(new Date("2026-10-30T15:00:00Z"))).toBe("2026-10-31");
  });

  it("定期実行（UTC 23:00）は日本時間の翌日8時になる", () => {
    expect(todayInTokyo(new Date("2026-10-29T23:00:00Z"))).toBe("2026-10-30");
  });

  it("年またぎ", () => {
    expect(todayInTokyo(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("うるう日", () => {
    expect(todayInTokyo(new Date("2028-02-28T15:00:00Z"))).toBe("2028-02-29");
  });
});
