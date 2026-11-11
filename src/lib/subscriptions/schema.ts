// サブスクの入力チェック（設計書 7.5）。画面とサーバーで同じ定義を使う
import { z } from "zod";
import type { BillingRule } from "@/lib/billing/billing-date";
import { daysInMonth, parseDate } from "@/lib/date/calendar";

export const CURRENCIES = ["JPY", "USD", "EUR"] as const;

function isValidDate(value: string): boolean {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

const dateString = z.string().refine(isValidDate, "正しい日付を入力してください");

/** min〜max の整数。未入力（NaN）や範囲外はすべて同じメッセージにする */
const intIn = (min: number, max: number, message: string) =>
  z.number(message).int(message).min(min, message).max(max, message);

/** 請求日のルール。subscriptions.billing_rule（json）の読み書きにも使う */
export const billingRuleSchema = z
  .discriminatedUnion("cycle", [
    z.object({
      cycle: z.literal("monthly"),
      day: intIn(1, 31, "日を選んでください"),
    }),
    z.object({
      cycle: z.literal("yearly"),
      month: intIn(1, 12, "月を選んでください"),
      day: intIn(1, 31, "日を選んでください"),
    }),
    z.object({
      cycle: z.literal("weekly"),
      weekday: intIn(0, 6, "曜日を選んでください"),
    }),
    z.object({
      cycle: z.literal("other"),
      intervalMonths: intIn(1, 120, "1〜120の整数で入力してください"),
      anchorDate: dateString,
    }),
  ])
  .superRefine((rule, ctx) => {
    // 毎年◯月◯日は、うるう年を含めて存在する日付だけ（2月29日は可、4月31日は不可）
    if (rule.cycle === "yearly" && rule.month >= 1 && rule.month <= 12 && rule.day > daysInMonth(2028, rule.month)) {
      ctx.addIssue({ code: "custom", path: ["day"], message: `${rule.month}月に${rule.day}日はありません` });
    }
  }) satisfies z.ZodType<BillingRule>;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

/** 数字だけの文字列を整数にする（空欄は NaN にして範囲チェックで落とす） */
const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

/** フォームの値（すべて文字列とチェックボックスの真偽値） */
export const subscriptionFormSchema = z
  .object({
    name: z.string().trim().min(1, "サービス名を入力してください").max(100, "100文字以内で入力してください"),
    categoryId: z.union([z.literal(""), z.uuid("カテゴリを選び直してください")]),
    currency: z.enum(CURRENCIES, "通貨を選んでください"),
    amount: z
      .string()
      .trim()
      .min(1, "金額を入力してください")
      .regex(/^\d{1,10}(\.\d{1,2})?$/, "金額は数字で入力してください（小数は2桁まで）"),
    isVariable: z.boolean(),
    isManualPurchase: z.boolean(),
    cycle: z.enum(["monthly", "yearly", "weekly", "other"], "支払いサイクルを選んでください"),
    day: z.string(),
    month: z.string(),
    weekday: z.string(),
    intervalMonths: z.string(),
    anchorDate: z.string(),
    nextBillingDate: dateString,
    notifyDaysBefore: z
      .string()
      .transform(toInt)
      .pipe(intIn(0, 60, "0〜60の整数で入力してください")),
    trialEndDate: z.union([z.literal(""), dateString]),
    url: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(2000, "URLが長すぎます")
        .regex(/^https?:\/\/\S+$/i, "URLは http:// か https:// で始まるものだけ入力できます"),
    ]),
    memo: optionalText(2000, "メモは2000文字以内で入力してください"),
  })
  .transform((form, ctx) => {
    const rule = billingRuleSchema.safeParse(ruleFromFields(form));
    if (!rule.success) {
      for (const issue of rule.error.issues) {
        ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
      }
      return z.NEVER;
    }

    const amount = Number(form.amount);
    if (form.currency === "JPY" && !Number.isInteger(amount)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "円の金額は整数で入力してください" });
      return z.NEVER;
    }

    return {
      name: form.name,
      category_id: form.categoryId || null,
      currency: form.currency,
      amount,
      // 自分で購入するものは金額が変動する扱い（設計書 3.14）
      is_variable: form.isVariable || form.isManualPurchase,
      is_manual_purchase: form.isManualPurchase,
      billing_cycle: rule.data.cycle,
      billing_rule: rule.data,
      next_billing_date: form.nextBillingDate,
      notify_days_before: form.notifyDaysBefore,
      trial_end_date: form.trialEndDate || null,
      url: form.url || null,
      memo: form.memo,
    };
  });

type FormKeys = keyof z.input<typeof subscriptionFormSchema>;
type CheckboxKeys = "isVariable" | "isManualPurchase";
/** フォームの値。入力欄はすべて文字列（選択肢も含む）、チェックボックスは真偽値 */
export type SubscriptionFormValues = Record<Exclude<FormKeys, CheckboxKeys>, string> & Record<CheckboxKeys, boolean>;
export type SubscriptionInput = z.output<typeof subscriptionFormSchema>;

/** フォームの欄から請求日のルールを組み立てる（未入力の数値は NaN になり、チェックで落ちる） */
export function ruleFromFields(form: Pick<SubscriptionFormValues, "cycle" | "day" | "month" | "weekday" | "intervalMonths" | "anchorDate">): unknown {
  switch (form.cycle) {
    case "monthly":
      return { cycle: "monthly", day: toInt(form.day) };
    case "yearly":
      return { cycle: "yearly", month: toInt(form.month), day: toInt(form.day) };
    case "weekly":
      return { cycle: "weekly", weekday: toInt(form.weekday) };
    case "other":
      return { cycle: "other", intervalMonths: toInt(form.intervalMonths), anchorDate: form.anchorDate };
    default:
      return { cycle: form.cycle };
  }
}

/** FormData をフォームの値に変換する（Server Action 用） */
export function formDataToValues(formData: FormData): SubscriptionFormValues {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    categoryId: text("categoryId"),
    currency: text("currency"),
    amount: text("amount"),
    isVariable: formData.get("isVariable") === "on",
    isManualPurchase: formData.get("isManualPurchase") === "on",
    cycle: text("cycle"),
    day: text("day"),
    month: text("month"),
    weekday: text("weekday"),
    intervalMonths: text("intervalMonths"),
    anchorDate: text("anchorDate"),
    nextBillingDate: text("nextBillingDate"),
    notifyDaysBefore: text("notifyDaysBefore"),
    trialEndDate: text("trialEndDate"),
    url: text("url"),
    memo: text("memo"),
  };
}

/** エラーを「欄の名前 → 最初のメッセージ」にまとめる */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
