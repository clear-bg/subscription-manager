import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/auth";
import { runDailyJob } from "@/lib/jobs/daily";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 毎朝8時（日本時間）の定期実行。
 * vercel.json の crons で "0 23 * * *"（UTC の前日23時 ＝ 日本時間 8時）に呼ばれる（設計書 9.2）。
 * JSON にはコメントを書けないため、時刻の説明はここに残す。
 * ログイン状態の確認（proxy）の対象外で、CRON_SECRET で保護する
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDailyJob({
    supabase: createAdminClient(),
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
