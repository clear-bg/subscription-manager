import Link from "next/link";
import { Suspense } from "react";
import { formatMoney, monthlyEquivalent, totalsByCurrency } from "@/lib/billing/amount";
import { formatDateJa, ruleLabel, STATUS_LABELS } from "@/lib/subscriptions/labels";
import { listSubscriptions } from "@/lib/subscriptions/queries";
import { billingRuleSchema } from "@/lib/subscriptions/schema";
import { createClient } from "@/lib/supabase/server";

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  considering: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  cancel_scheduled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  paused: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  cancelled: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

async function SubscriptionList() {
  const supabase = await createClient();
  const rows = await listSubscriptions(supabase);
  const items = rows.map((row) => ({ ...row, rule: billingRuleSchema.parse(row.billing_rule) }));
  const totals = totalsByCurrency(items);
  const jpy = totals.find((total) => total.currency === "JPY");
  const foreign = totals.filter((total) => total.currency !== "JPY");

  return (
    <>
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">サブスク月額合計</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatMoney(jpy?.monthly ?? 0, "JPY")}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">年額合計</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatMoney(jpy?.yearly ?? 0, "JPY")}</p>
        </div>
        <p className="col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
          利用中・解約検討中が対象。年額・週額などは月額に按分しています。金額が変わるものは目安額で計算しています。
          {foreign.length > 0 && (
            <>
              {" "}
              外貨建ては円の合計に含めていません（
              {foreign.map((total) => `${formatMoney(total.monthly, total.currency)}/月`).join("、")}
              ）。
            </>
          )}
        </p>
      </section>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">まだ登録がありません。「＋ 登録」から追加してください。</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => {
            const inactive = item.status === "cancelled" || item.status === "paused";
            const estimated = item.is_variable || item.is_manual_purchase;
            return (
              <li key={item.id}>
                <Link
                  href={`/subscriptions/${item.id}/edit`}
                  className={`flex flex-col gap-1.5 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${inactive ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.name}</span>
                    <span className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {estimated && <span className="mr-1 text-xs font-normal text-zinc-500">目安</span>}
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className={`rounded px-1.5 py-0.5 ${STATUS_BADGE_CLASS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                    <span>{ruleLabel(item.rule)}</span>
                    {item.rule.cycle !== "monthly" && (
                      <span>月額換算 {formatMoney(monthlyEquivalent(item.amount, item.rule), item.currency)}</span>
                    )}
                    <span>
                      {item.is_manual_purchase ? "次回購入予定" : "次回"} {formatDateJa(item.next_billing_date)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.category ? <Tag>{item.category.name}</Tag> : <Tag>カテゴリ未設定</Tag>}
                    {item.is_manual_purchase && <Tag>自分で購入</Tag>}
                    {item.is_variable && !item.is_manual_purchase && <Tag>金額が変動</Tag>}
                    {item.trial_end_date && <Tag>トライアル〜{formatDateJa(item.trial_end_date)}</Tag>}
                    {item.end_date && item.status === "cancel_scheduled" && <Tag>利用終了 {formatDateJa(item.end_date)}</Tag>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">サブスク・固定費</h1>
        <Link
          href="/subscriptions/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          ＋ 登録
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}>
        <SubscriptionList />
      </Suspense>
    </>
  );
}
