import { Suspense } from "react";
import { listCategories } from "@/lib/subscriptions/queries";
import { createClient } from "@/lib/supabase/server";
import { createSubscription } from "../actions";
import { SubscriptionForm } from "../subscription-form";

async function NewSubscriptionForm() {
  const supabase = await createClient();
  const categories = await listCategories(supabase);
  return (
    <SubscriptionForm
      categories={categories}
      initialValues={{
        name: "",
        categoryId: "",
        currency: "JPY",
        amount: "",
        isVariable: false,
        isManualPurchase: false,
        cycle: "monthly",
        day: "",
        month: "",
        weekday: "",
        intervalMonths: "",
        anchorDate: "",
        nextBillingDate: "",
        notifyDaysBefore: "3",
        trialEndDate: "",
        url: "",
        memo: "",
      }}
      autoNextBillingDate
      action={createSubscription}
      submitLabel="登録する"
    />
  );
}

export default function NewSubscriptionPage() {
  return (
    <>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">サブスク・固定費を登録</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}>
        <NewSubscriptionForm />
      </Suspense>
    </>
  );
}
