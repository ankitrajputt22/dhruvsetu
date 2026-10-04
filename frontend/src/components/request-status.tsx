import { accessStatusLabels } from "@/lib/researcher";
import type { ResearcherAccessStatus } from "@/lib/types";

const styles: Record<ResearcherAccessStatus, { className: string; icon: React.ReactNode }> = {
  none: {
    className: "border-slate-300 bg-white text-slate-700",
    icon: <circle cx="12" cy="12" r="9" />,
  },
  pending: {
    className: "border-amber-300 bg-amber-50 text-amber-900",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  approved: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  },
  rejected: {
    className: "border-red-200 bg-red-50 text-red-900",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
      </>
    ),
  },
  removed: {
    className: "border-slate-300 bg-slate-100 text-slate-700",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </>
    ),
  },
};

// The state of researcher access or of one request. The words carry the
// meaning; the colour and the icon only support them.
export function RequestStatusBadge({ status }: { status: ResearcherAccessStatus }) {
  const style = styles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        {style.icon}
      </svg>
      {accessStatusLabels[status]}
    </span>
  );
}
