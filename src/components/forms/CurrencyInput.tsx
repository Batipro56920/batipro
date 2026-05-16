import type { InputHTMLAttributes } from "react";
import { TextInput } from "./TextInput";

export function CurrencyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput type="number" inputMode="decimal" step="0.01" {...props} />;
}
