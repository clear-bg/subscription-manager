// Discord Webhook への送信（設計書 3.4、9.4）
// Webhook URL は秘密情報のため、ログやエラーメッセージに含めない

/** Discord の1メッセージの上限は2000文字。余裕を持たせて区切る */
const MESSAGE_LIMIT = 1900;

/** 行の配列を、上限を超えないメッセージに分ける（行の途中では区切らない） */
export function splitIntoMessages(lines: string[], limit = MESSAGE_LIMIT): string[] {
  const messages: string[] = [];
  let current = "";
  for (const rawLine of lines) {
    const line = rawLine.length > limit ? `${rawLine.slice(0, limit - 1)}…` : rawLine;
    const next = current === "" ? line : `${current}\n${line}`;
    if (next.length > limit) {
      messages.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current !== "") messages.push(current);
  return messages;
}

type SendOptions = {
  fetchFn?: typeof fetch;
  /** 失敗したときの再送回数（設計書 9.4：最大3回） */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 1件のメッセージを送る。失敗したら間隔を空けて再送し、最後まで失敗したら false */
export async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
  { fetchFn = fetch, retries = 3, sleep = defaultSleep }: SendOptions = {},
): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const response = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // @everyone などのメンションを無効にする
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return true;
      console.error("Discord への送信に失敗しました", { status: response.status, attempt });
    } catch (error) {
      console.error("Discord への送信に失敗しました", { name: (error as Error).name, attempt });
    }
  }
  return false;
}
