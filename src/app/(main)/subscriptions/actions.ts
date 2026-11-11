"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentHouseholdId } from "@/lib/subscriptions/queries";
import { fieldErrors, formDataToValues, subscriptionFormSchema } from "@/lib/subscriptions/schema";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionFormState = { errors: Record<string, string> } | undefined;

const SAVE_FAILED = "保存に失敗しました。時間をおいてもう一度お試しください。";

export async function createSubscription(
  _prev: SubscriptionFormState,
  formData: FormData,
): Promise<SubscriptionFormState> {
  // 画面と同じ定義でサーバー側でもチェックする（設計書 7.5）
  const parsed = subscriptionFormSchema.safeParse(formDataToValues(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId(supabase);
  if (!householdId) return { errors: { form: SAVE_FAILED } };

  const { error } = await supabase.from("subscriptions").insert({ ...parsed.data, household_id: householdId });
  if (error) {
    console.error("サブスクの登録に失敗しました", error.code);
    return { errors: { form: SAVE_FAILED } };
  }

  // 一覧と編集画面の両方を作り直す
  revalidatePath("/subscriptions", "layout");
  redirect("/subscriptions");
}

export async function updateSubscription(
  id: string,
  _prev: SubscriptionFormState,
  formData: FormData,
): Promise<SubscriptionFormState> {
  if (!z.uuid().safeParse(id).success) return { errors: { form: SAVE_FAILED } };

  const parsed = subscriptionFormSchema.safeParse(formDataToValues(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // 他の世帯の行は RLS で更新できない（0件になる）
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").update(parsed.data).eq("id", id).select("id");
  if (error || data.length === 0) {
    if (error) console.error("サブスクの更新に失敗しました", error.code);
    return { errors: { form: SAVE_FAILED } };
  }

  // 一覧と編集画面の両方を作り直す
  revalidatePath("/subscriptions", "layout");
  redirect("/subscriptions");
}

export async function deleteSubscription(id: string): Promise<{ error: string } | undefined> {
  if (!z.uuid().safeParse(id).success) return { error: "削除に失敗しました。" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").delete().eq("id", id).select("id");
  if (error || data.length === 0) {
    if (error) console.error("サブスクの削除に失敗しました", error.code);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください。" };
  }

  // 一覧と編集画面の両方を作り直す
  revalidatePath("/subscriptions", "layout");
  redirect("/subscriptions");
}
