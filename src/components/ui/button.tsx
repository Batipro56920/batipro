import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "secondary" | "ghost" | "danger" | "primary" | "success";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  default: "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
  primary: "bg-blue-600 text-white shadow-sm shadow-blue-600/15 hover:bg-blue-700",
  secondary: "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15 hover:bg-emerald-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-2.5 text-xs",
  md: "h-9 rounded-xl px-3 text-sm",
  lg: "h-10 rounded-xl px-4 text-sm",
};

export function Button({ variant = "default", size = "md", className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
