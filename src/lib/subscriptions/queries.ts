// サブスク関連のデータ取得（ログイン中のユーザーの権限で実行。RLS で世帯が絞られる）
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** ログイン中のユーザーの世帯ID（当面は1ユーザー1世帯） */
export async function getCurrentHouseholdId(supabase: Client): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.household_id ?? null;
}

export async function listCategories(supabase: Client) {
  const { data, error } = await supabase.from("categories").select("id, name, color").order("sort_order");
  if (error) throw new Error("カテゴリの取得に失敗しました");
  return data;
}

export async function listSubscriptions(supabase: Client) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, category:categories(name, color)")
    .order("next_billing_date")
    .order("name");
  if (error) throw new Error("サブスクの取得に失敗しました");
  return data;
}

export async function getSubscription(supabase: Client, id: string) {
  const { data, error } = await supabase.from("subscriptions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("サブスクの取得に失敗しました");
  return data;
}
