import type { ReactNode } from "react";

export function portalCardClass(tone: "default" | "muted" | "accent" = "default"): string {
  if (tone === "accent") {
    return "rounded-[1.1rem] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
  }
  if (tone === "muted") {
    return "rounded-[1.1rem] border border-slate-200 bg-slate-50/85 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]";
  }
  return "rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
}

export function PortalCard({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "accent";
}) {
  return <section className={[portalCardClass(tone), className].join(" ")}>{children}</section>;
}

export function PortalSectionHeading({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{eyebrow}</div> : null}
        <div className="mt-1 text-lg font-semibold text-slate-950">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function PortalPillButton({
  active = false,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={[
        "rounded-full px-4 py-2.5 text-sm font-medium transition",
        active
          ? "border border-blue-700 bg-blue-700 text-white shadow-[0_8px_18px_rgba(30,64,175,0.22)]"
          : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function PortalPrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(30,64,175,0.22)] transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function PortalSecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function PortalField({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={["space-y-1.5", className].join(" ")}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-slate-500">{hint}</div> : null}
    </label>
  );
}

export function portalInputClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
}

export function PortalEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
      {children}
    </div>
  );
}

export function PortalBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : tone === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", toneClass].join(" ")}>{children}</span>;
}

export function PortalActionTile({
  title,
  description,
  tone = "blue",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  tone?: "blue" | "white";
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-[1rem] border p-4",
        tone === "blue"
          ? "border-blue-200 bg-gradient-to-br from-blue-700 to-blue-600 text-white shadow-[0_12px_28px_rgba(30,64,175,0.24)]"
          : "border-slate-200 bg-white text-slate-900",
      ].join(" ")}
    >
      <div className="text-base font-semibold">{title}</div>
      {description ? <div className={["mt-1 text-sm", tone === "blue" ? "text-blue-100" : "text-slate-500"].join(" ")}>{description}</div> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
