"use client";

import { useState, useTransition } from "react";
import { deleteSubscription } from "../../actions";

/**
 * 削除ボタン。誤操作を防ぐため、押すと確認の表示に切り替わる（設計書 7.7）。
 * ブラウザの確認ダイアログ（confirm）は使わず、画面内で確認する
 */
export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 underline dark:text-red-400">
        削除する
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-800 dark:text-red-200">「{name}」を削除します。元に戻せません。よろしいですか？</p>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteSubscription(id);
              if (result) setError(result.error);
            })
          }
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "削除中…" : "削除する"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
