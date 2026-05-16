import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-9 w-full rounded-input border border-bt-border bg-white px-3 text-sm text-bt-text transition-colors duration-bt placeholder:text-slate-400 focus:border-bt-accent focus:ring-4 focus:ring-blue-500/10", className)} {...props} />
));
TextInput.displayName = "TextInput";
