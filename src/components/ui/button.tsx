import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "secondary" | "ghost" | "danger" | "primary" | "success";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

/* Tokens semantiques uniquement : ces variantes suivent automatiquement le theme. */
const variants: Record<ButtonVariant, string> = {
  default: "bg-ink text-surface hover:opacity-90",
  primary: "bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active active:translate-y-[0.5px]",
  secondary: "border border-strong bg-surface text-ink hover:bg-interactive",
  ghost: "text-ink-secondary hover:bg-interactive hover:text-ink",
  danger: "border border-danger/40 bg-danger-soft text-danger-on hover:border-danger/60",
  success: "bg-success-strong text-success-contrast hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "bt-tap rounded-field px-2.5 text-[13px]",
  md: "h-9 rounded-field px-3 text-sm",
  lg: "h-10 rounded-field px-4 text-sm",
};

export function Button({ variant = "default", size = "md", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
