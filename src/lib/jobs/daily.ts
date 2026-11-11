// 毎朝の定期実行（設計書 3.4、3.8、7.3、9.4）
// 1. 過ぎた次回請求日を進める  2. 請求日前の通知を Discord に送る  3. 定期実行ログを書く（停止対策を兼ねる）

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addDays, type DateString } from "@/lib/date/calendar";
import { todayInTokyo } from "@/lib/date/today";
import { sendDiscordMessage, splitIntoMessages } from "@/lib/notify/discord";
import { billingRuleSchema } from "@/lib/subscriptions/schema";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildMessageLines,
  carryOverUnsent,
  dueReminders,
  rollForwardAll,
  type ReminderSubscription,
  type UnsentReminder,
} from "./reminders";

const JOB_NAME = "daily";
/** 定期実行ログを残す日数（設計書 5. job_runs） */
const LOG_RETENTION_DAYS = 90;

type Client = SupabaseClient<Database>;

const detailSchema = z.object({
  unsent: z.array(z.object({ subscriptionId: z.string(), billingDate: z.string() })).default([]),
});

export type DailyJobResult = {
  status: "success" | "failed" | "skipped";
  reminders: number;
  rolledForward: number;
};

type Options = {
  supabase: Client;
  /** 未設定なら通知を送らず失敗として記録する */
  webhookUrl: string | undefined;
  now?: Date;
  send?: (webhookUrl: string, content: string) => Promise<boolean>;
};

/** 日本時間の日付の 0時を UTC の ISO 文字列にする */
function startOfDayInTokyo(date: DateString): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export async function runDailyJob({ supabase, webhookUrl, now = new Date(), send = sendDiscordMessage }: Options): Promise<DailyJobResult> {
  const startedAt = now.toISOString();
  const today = todayInTokyo(now);

  const writeLog = async (status: "success" | "failed", detail: Record<string, unknown>) => {
    const { error } = await supabase.from("job_runs").insert({
      job: JOB_NAME,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status,
      detail: JSON.stringify(detail),
    });
    if (error) console.error("定期実行ログの書き込みに失敗しました", error.code);
  };

  try {
    // 同じ日に何度呼ばれても通知を重複させない（設計書 7.3）。ログだけは毎回書く（停止対策）
    const { data: doneToday, error: doneError } = await supabase
      .from("job_runs")
      .select("id")
      .eq("job", JOB_NAME)
      .eq("status", "success")
      .gte("started_at", startOfDayInTokyo(today))
      .limit(1);
    if (doneError) throw new Error(`実行済みの確認に失敗しました（${doneError.code}）`);
    if (doneToday.length > 0) {
      await writeLog("success", { skipped: "本日分は実行済み" });
      return { status: "skipped", reminders: 0, rolledForward: 0 };
    }

    // 前回の実行で送れなかった通知（設計書 9.4）
    const { data: lastRun } = await supabase
      .from("job_runs")
      .select("status, detail")
      .eq("job", JOB_NAME)
      .lt("started_at", startedAt)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const unsentBefore: UnsentReminder[] =
      lastRun?.status === "failed" ? parseUnsent(lastRun.detail) : [];

    // 対象のサブスク（全世帯。service_role で実行）
    const { data: rows, error: rowsError } = await supabase
      .from("subscriptions")
      .select("id, name, amount, currency, is_variable, is_manual_purchase, status, next_billing_date, notify_days_before, billing_rule")
      .in("status", ["active", "considering"]);
    if (rowsError) throw new Error(`サブスクの取得に失敗しました（${rowsError.code}）`);

    const subscriptions: ReminderSubscription[] = rows.map((row) => ({
      ...row,
      rule: billingRuleSchema.parse(row.billing_rule),
    }));

    // 1. 過ぎた次回請求日を進める（段階1。支出記録の作成は段階2）
    const changes = rollForwardAll(subscriptions, today);
    for (const change of changes) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ next_billing_date: change.nextBillingDate })
        .eq("id", change.id);
      if (error) throw new Error(`次回請求日の更新に失敗しました（${error.code}）`);
    }
    const nextDates = new Map(changes.map((change) => [change.id, change.nextBillingDate]));
    const updated = subscriptions.map((subscription) => ({
      ...subscription,
      next_billing_date: nextDates.get(subscription.id) ?? subscription.next_billing_date,
    }));

    // 2. 通知
    const reminders = dueReminders(updated, today);
    const carried = carryOverUnsent(unsentBefore, updated, today);
    const lines = buildMessageLines(today, reminders, carried);

    let sent = true;
    if (lines.length > 0) {
      if (!webhookUrl) {
        console.error("DISCORD_WEBHOOK_URL が設定されていないため、通知を送れませんでした");
        sent = false;
      } else {
        for (const message of splitIntoMessages(lines)) {
          if (!(await send(webhookUrl, message))) sent = false;
        }
      }
    }

    // 古いログを消す
    await supabase
      .from("job_runs")
      .delete()
      .lt("started_at", startOfDayInTokyo(addDays(today, -LOG_RETENTION_DAYS)));

    const unsent: UnsentReminder[] = sent
      ? []
      : [...reminders, ...carried.resend].map(({ subscriptionId, billingDate }) => ({ subscriptionId, billingDate }));
    await writeLog(sent ? "success" : "failed", {
      reminders: reminders.length,
      resent: carried.resend.length,
      expired: carried.expiredCount,
      rolledForward: changes.length,
      unsent,
    });

    return { status: sent ? "success" : "failed", reminders: reminders.length, rolledForward: changes.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("定期実行でエラーが発生しました", message);
    await writeLog("failed", { error: message });
    // 定期実行の異常の通知（設計書 3.4）。中身は書かない
    if (webhookUrl) await send(webhookUrl, "⚠ 定期処理でエラーが発生しました。アプリの定期実行ログを確認してください。");
    return { status: "failed", reminders: 0, rolledForward: 0 };
  }
}

function parseUnsent(detail: string | null): UnsentReminder[] {
  if (!detail) return [];
  try {
    const parsed = detailSchema.safeParse(JSON.parse(detail));
    return parsed.success ? parsed.data.unsent : [];
  } catch {
    return [];
  }
}
