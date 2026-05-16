import type { InputHTMLAttributes } from "react";
import { TextInput } from "./TextInput";

export function NumberInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput type="number" inputMode="decimal" {...props} />;
}
