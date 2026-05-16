import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-24 w-full rounded-input border border-bt-border bg-white px-3 py-2 text-sm text-bt-text transition-colors duration-bt placeholder:text-slate-400 focus:border-bt-accent focus:ring-4 focus:ring-blue-500/10", className)} {...props} />
));
TextArea.displayName = "TextArea";
