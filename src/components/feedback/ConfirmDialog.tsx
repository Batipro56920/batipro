import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <AlertDialog.Content className="bt-dialog-enter fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-dialog border border-bt-border bg-bt-surface p-5 shadow-dialog">
          <AlertDialog.Title className="bt-card-title">{title}</AlertDialog.Title>
          {description ? <AlertDialog.Description className="mt-2 text-sm text-bt-muted">{description}</AlertDialog.Description> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className="h-9 rounded-input border border-bt-border bg-white px-3 text-sm">{cancelLabel}</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm} className="h-9 rounded-input bg-bt-danger px-3 text-sm font-medium text-white">{confirmLabel}</AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
