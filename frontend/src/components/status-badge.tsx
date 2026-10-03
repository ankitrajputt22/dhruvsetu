import { formatStatus } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium capitalize text-sky-900">
      {formatStatus(status)}
    </span>
  );
}
