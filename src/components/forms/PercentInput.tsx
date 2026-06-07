import type { InputHTMLAttributes } from "react";
import { TextInput } from "./TextInput";

export function PercentInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput inputMode="decimal" {...props} />;
}
