import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Tabs({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) {
  return <TabsPrimitive.Root value={value} onValueChange={onValueChange}>{children}</TabsPrimitive.Root>;
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <TabsPrimitive.List className={cn("flex gap-1 rounded-card border border-bt-border bg-white p-1", className)}>{children}</TabsPrimitive.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Trigger value={value} className="rounded-input px-3 py-2 text-sm font-medium text-bt-muted data-[state=active]:bg-bt-primary data-[state=active]:text-white">{children}</TabsPrimitive.Trigger>;
}

export const TabsContent = TabsPrimitive.Content;
