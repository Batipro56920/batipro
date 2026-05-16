import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bt-muted" />
      <input className="h-9 w-full rounded-input border border-bt-border bg-white pl-9 pr-3 text-sm focus:border-bt-accent focus:ring-4 focus:ring-blue-500/10" {...props} />
    </div>
  );
}
