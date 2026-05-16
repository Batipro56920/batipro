import type { InputHTMLAttributes } from "react";
import { TextInput } from "./TextInput";

export function PercentInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput type="number" inputMode="decimal" step="0.01" min="0" max="100" {...props} />;
}
