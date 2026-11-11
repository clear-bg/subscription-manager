import { describe, expect, it, vi } from "vitest";
import { sendDiscordMessage, splitIntoMessages } from "./discord";

const noSleep = async () => {};

describe("splitIntoMessages", () => {
  it("上限を超えないように行単位で分ける", () => {
    expect(splitIntoMessages(["aaaa", "bbbb", "cccc"], 9)).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("1行が上限を超える場合は切り詰める", () => {
    expect(splitIntoMessages(["x".repeat(20)], 10)).toEqual([`${"x".repeat(9)}…`]);
  });

  it("空なら送るメッセージはない", () => {
    expect(splitIntoMessages([])).toEqual([]);
  });
});

describe("sendDiscordMessage", () => {
  it("成功したら1回で終わる。メンションは無効にする", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await sendDiscordMessage("https://discord.example/webhook", "hello", { fetchFn, sleep: noSleep })).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual({ content: "hello", allowed_mentions: { parse: [] } });
  });

  it("失敗したら最大3回再送し、途中で成功すれば true", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await sendDiscordMessage("https://discord.example/webhook", "hello", { fetchFn, sleep: noSleep })).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("4回（初回＋再送3回）失敗したら false", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>(noSleep);
    expect(await sendDiscordMessage("https://discord.example/webhook", "hello", { fetchFn, sleep })).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it("エラーのログに Webhook URL を出さない", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = vi.fn().mockRejectedValue(new Error("failed to fetch https://discord.example/secret"));
    await sendDiscordMessage("https://discord.example/secret", "hello", { fetchFn, sleep: noSleep, retries: 0 });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("secret");
    errors.mockRestore();
  });
});
