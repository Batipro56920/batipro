import { useState } from "react";

export function useCrmActions(onSuccess: () => Promise<void>, onError: (message: string | null) => void) {
  const [saving, setSaving] = useState(false);

  async function submitSafely(action: () => Promise<unknown>) {
    setSaving(true);
    onError(null);
    try {
      await action();
      await onSuccess();
    } catch (err: any) {
      onError(err?.message ?? "Action CRM impossible.");
    } finally {
      setSaving(false);
    }
  }

  return { saving, submitSafely };
}
