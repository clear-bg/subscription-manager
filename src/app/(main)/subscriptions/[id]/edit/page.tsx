import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { STATUS_LABELS } from "@/lib/subscriptions/labels";
import { getSubscription, listCategories } from "@/lib/subscriptions/queries";
import { billingRuleSchema, type SubscriptionFormValues } from "@/lib/subscriptions/schema";
import { createClient } from "@/lib/supabase/server";
import { updateSubscription } from "../../actions";
import { SubscriptionForm } from "../../subscription-form";
import { DeleteButton } from "./delete-button";

async function EditSubscriptionForm({ params }: { params: PageProps<"/subscriptions/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [subscription, categories] = await Promise.all([getSubscription(supabase, id), listCategories(supabase)]);
  if (!subscription) notFound();

  const rule = billingRuleSchema.parse(subscription.billing_rule);
  const initialValues: SubscriptionFormValues = {
    name: subscription.name,
    categoryId: subscription.category_id ?? "",
    currency: subscription.currency,
    amount: String(subscription.amount),
    isVariable: subscription.is_variable,
    isManualPurchase: subscription.is_manual_purchase,
    cycle: rule.cycle,
    day: "day" in rule ? String(rule.day) : "",
    month: rule.cycle === "yearly" ? String(rule.month) : "",
    weekday: rule.cycle === "weekly" ? String(rule.weekday) : "",
    intervalMonths: rule.cycle === "other" ? String(rule.intervalMonths) : "",
    anchorDate: rule.cycle === "other" ? rule.anchorDate : "",
    nextBillingDate: subscription.next_billing_date,
    notifyDaysBefore: String(subscription.notify_days_before),
    trialEndDate: subscription.trial_end_date ?? "",
    url: subscription.url ?? "",
    memo: subscription.memo ?? "",
  };

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        状態：{STATUS_LABELS[subscription.status]}
        <span className="ml-2 text-xs text-zinc-500">（状態の変更は段階2で対応します）</span>
      </p>
      <SubscriptionForm
        // 保存後に戻ってきたとき、前回の入力状態ではなく最新のデータで表示し直す
        key={subscription.updated_at}
        categories={categories}
        initialValues={initialValues}
        autoNextBillingDate={false}
        action={updateSubscription.bind(null, subscription.id)}
        submitLabel="保存する"
      />
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <DeleteButton id={subscription.id} name={subscription.name} />
      </div>
    </>
  );
}

export default function EditSubscriptionPage({ params }: PageProps<"/subscriptions/[id]/edit">) {
  return (
    <>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">サブスク・固定費を編集</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}>
        <EditSubscriptionForm params={params} />
      </Suspense>
    </>
  );
}
