import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseUrl } from "./env";

/**
 * service_role で動く Supabase クライアント。RLS を通らず全世帯のデータを扱えるため、
 * 定期実行（CRON_SECRET で保護した API）からだけ使う。ブラウザには絶対に渡さない（設計書 7.2）
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
