export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-bt-danger" role="alert">{message}</p>;
}
