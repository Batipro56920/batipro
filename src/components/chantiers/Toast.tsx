export type ToastState = { type: "ok" | "error"; msg: string } | null;

export default function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  return (
    <div
      className={[
        "fixed right-6 bottom-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg",
        toast.type === "ok"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-red-50 text-red-800 border-red-200",
      ].join(" ")}
    >
      {toast.msg}
    </div>
  );
}
