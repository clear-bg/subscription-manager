"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { formatMoney, monthlyEquivalent } from "@/lib/billing/amount";
import { nextBillingDateOnOrAfter } from "@/lib/billing/billing-date";
import { todayInTokyo } from "@/lib/date/today";
import { WEEKDAY_LABELS } from "@/lib/subscriptions/labels";
import {
  billingRuleSchema,
  CURRENCIES,
  fieldErrors,
  formDataToValues,
  ruleFromFields,
  subscriptionFormSchema,
  type SubscriptionFormValues,
} from "@/lib/subscriptions/schema";
import type { SubscriptionFormState } from "./actions";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  initialValues: SubscriptionFormValues;
  /** true なら次回請求日をルールから自動で計算する（新規登録時） */
  autoNextBillingDate: boolean;
  action: (state: SubscriptionFormState, formData: FormData) => Promise<SubscriptionFormState>;
  submitLabel: string;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

export function SubscriptionForm({ categories, initialValues, autoNextBillingDate, action, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [values, setValues] = useState(initialValues);
  const [autoNext, setAutoNext] = useState(autoNextBillingDate);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  // 前回の送信のあとに変更した欄。変更した欄のエラーは消す
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());

  const set = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    // 請求日のルールを変えると次回請求日も計算し直されるため、あわせてエラーを消す
    const related = RULE_KEYS.includes(key) ? [key, "nextBillingDate"] : [key];
    setEdited((current) => new Set([...current, ...related]));
  };

  // 請求日のルールが正しく入力されていれば、次回請求日と月額換算をその場で計算する（設計書 3.11、S3）
  const rule = billingRuleSchema.safeParse(ruleFromFields(values));
  const computedNext = rule.success ? nextBillingDateOnOrAfter(rule.data, todayInTokyo()) : null;
  const nextBillingDate = autoNext ? (computedNext ?? "") : values.nextBillingDate;
  const amount = Number(values.amount);
  const monthlyPreview =
    rule.success && values.amount !== "" && Number.isFinite(amount) && rule.data.cycle !== "monthly"
      ? formatMoney(monthlyEquivalent(amount, rule.data), values.currency)
      : null;

  // サーバーのエラーは、送信後に入力し直すまで表示する
  const errors = Object.fromEntries(
    Object.entries({ ...state?.errors, ...clientErrors }).filter(([key]) => !edited.has(key)),
  );

  // 送信前に画面側でもチェックし、エラーがあればサーバーに送らない
  function submit(formData: FormData) {
    const result = subscriptionFormSchema.safeParse(formDataToValues(formData));
    if (!result.success) {
      setClientErrors(fieldErrors(result.error));
      setEdited(new Set());
      return;
    }
    setClientErrors({});
    setEdited(new Set());
    formAction(formData);
  }

  return (
    <form action={submit} noValidate className="flex flex-col gap-5">
      {errors.form && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {errors.form}
        </p>
      )}

      <Field label="サービス名（必須）" error={errors.name}>
        <input name="name" value={values.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field label="通貨" error={errors.currency}>
          <select name="currency" value={values.currency} onChange={(e) => set("currency", e.target.value)} className={inputClass}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency === "JPY" ? "円" : currency}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={values.isVariable || values.isManualPurchase ? "金額（必須・目安額）" : "金額（必須）"}
          error={errors.amount}
          hint={monthlyPreview && `月額換算：${monthlyPreview}`}
        >
          <input
            name="amount"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            name="isManualPurchase"
            checked={values.isManualPurchase}
            onChange={(e) => set("isManualPurchase", e.target.checked)}
          />
          自分で購入する（自動引き落としではない。請求日は目安日として扱う）
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            name="isVariable"
            checked={values.isVariable || values.isManualPurchase}
            disabled={values.isManualPurchase}
            onChange={(e) => set("isVariable", e.target.checked)}
          />
          金額が毎月変わる（光熱費など。金額は目安額を入れる）
        </label>
      </div>

      <Field label="支払いサイクル（必須）" error={errors.cycle}>
        <select name="cycle" value={values.cycle} onChange={(e) => set("cycle", e.target.value)} className={inputClass}>
          <option value="monthly">月額（毎月◯日）</option>
          <option value="yearly">年額（毎年◯月◯日）</option>
          <option value="weekly">週額（毎週◯曜日）</option>
          <option value="other">◯か月ごと</option>
        </select>
      </Field>

      {values.cycle === "monthly" && (
        <Field label="請求日" error={errors.day} hint="その月に該当日がない場合（31日の2月など）は月末になります">
          <select name="day" value={values.day} onChange={(e) => set("day", e.target.value)} className={inputClass}>
            <option value="">選んでください</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                毎月{day}日
              </option>
            ))}
          </select>
        </Field>
      )}

      {values.cycle === "yearly" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="請求月" error={errors.month}>
            <select name="month" value={values.month} onChange={(e) => set("month", e.target.value)} className={inputClass}>
              <option value="">選んでください</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}月
                </option>
              ))}
            </select>
          </Field>
          <Field label="請求日" error={errors.day} hint="2月29日はうるう年以外は2月28日になります">
            <select name="day" value={values.day} onChange={(e) => set("day", e.target.value)} className={inputClass}>
              <option value="">選んでください</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}日
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {values.cycle === "weekly" && (
        <Field label="請求曜日" error={errors.weekday}>
          <select name="weekday" value={values.weekday} onChange={(e) => set("weekday", e.target.value)} className={inputClass}>
            <option value="">選んでください</option>
            {WEEKDAY_LABELS.map((label, weekday) => (
              <option key={weekday} value={weekday}>
                毎週{label}曜日
              </option>
            ))}
          </select>
        </Field>
      )}

      {values.cycle === "other" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="何か月ごと" error={errors.intervalMonths}>
            <input
              name="intervalMonths"
              inputMode="numeric"
              value={values.intervalMonths}
              onChange={(e) => set("intervalMonths", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="基準日（請求のあった日）" error={errors.anchorDate}>
            <input
              type="date"
              name="anchorDate"
              value={values.anchorDate}
              onChange={(e) => set("anchorDate", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <Field
        label={values.isManualPurchase ? "次回の購入予定日（必須）" : "次回請求日（必須）"}
        error={errors.nextBillingDate}
        hint={
          autoNext ? (
            "請求日のルールから自動で計算しています。変更すると手動の指定になります"
          ) : computedNext && computedNext !== nextBillingDate ? (
            <>
              手動で指定しています（ルールでは {computedNext}）。{" "}
              <button type="button" onClick={() => setAutoNext(true)} className="underline">
                ルールの日付に戻す
              </button>
            </>
          ) : undefined
        }
      >
        <input
          type="date"
          name="nextBillingDate"
          value={nextBillingDate}
          onChange={(e) => {
            setAutoNext(false);
            set("nextBillingDate", e.target.value);
          }}
          className={inputClass}
        />
      </Field>

      <details className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800" open={hasOptionalErrors(errors)}>
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
          詳細（任意。後から入力できます）
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <Field label="カテゴリ" error={errors.categoryId}>
            <select name="categoryId" value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
              <option value="">未設定</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="何日前に通知するか" error={errors.notifyDaysBefore}>
            <input
              name="notifyDaysBefore"
              inputMode="numeric"
              value={values.notifyDaysBefore}
              onChange={(e) => set("notifyDaysBefore", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="無料トライアルの終了日" error={errors.trialEndDate}>
            <input
              type="date"
              name="trialEndDate"
              value={values.trialEndDate}
              onChange={(e) => set("trialEndDate", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="解約ページなどのURL" error={errors.url}>
            <input
              type="url"
              name="url"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
          <Field label="メモ" error={errors.memo}>
            <textarea name="memo" rows={3} value={values.memo} onChange={(e) => set("memo", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "保存中…" : submitLabel}
        </button>
        <Link href="/subscriptions" className="text-sm text-zinc-600 underline dark:text-zinc-300">
          キャンセル
        </Link>
      </div>
    </form>
  );
}

const RULE_KEYS: string[] = ["cycle", "day", "month", "weekday", "intervalMonths", "anchorDate"];

function hasOptionalErrors(errors: Record<string, string>): boolean {
  return ["categoryId", "notifyDaysBefore", "trialEndDate", "url", "memo"].some((key) => key in errors);
}
