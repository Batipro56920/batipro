import type { InputHTMLAttributes } from "react";
import { TextInput } from "./TextInput";

export function CurrencyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput inputMode="decimal" {...props} />;
}
