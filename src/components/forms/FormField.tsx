import type { ReactNode } from "react";
import { InlineError } from "../feedback";

export function FormField({ label, required, helper, error, children }: { label: string; required?: boolean; helper?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-bt-text">
        {label}
        {required ? <span className="ml-1 text-bt-danger">*</span> : null}
      </span>
      {children}
      {helper && !error ? <p className="mt-1 text-xs text-bt-muted">{helper}</p> : null}
      <InlineError message={error} />
    </label>
  );
}
