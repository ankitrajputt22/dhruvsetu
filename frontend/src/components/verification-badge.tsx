import { formatStatus } from "@/lib/format";

type StatusStyle = {
  label: string;
  meaning: string;
  className: string;
  icon: React.ReactNode;
};

export const verificationStatuses: Record<string, StatusStyle> = {
  uploaded: {
    label: "Uploaded",
    meaning: "Added to the repository but not yet reviewed.",
    className: "border-slate-300 bg-slate-100 text-slate-700",
    icon: <path d="M12 15V4m0 0-4 4m4-4 4 4M4 15v4h16v-4" />,
  },
  reviewed: {
    label: "Reviewed",
    meaning: "Checked by a person.",
    className: "border-sky-200 bg-sky-50 text-sky-900",
    icon: (
      <>
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  verified: {
    label: "Verified",
    meaning: "Source details and content confirmed by a DhruvSetu admin.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  },
};

export const verificationOrder = ["uploaded", "reviewed", "verified"] as const;

export function verificationMeaning(status: string): string | null {
  return verificationStatuses[status]?.meaning ?? null;
}

export function VerificationBadge({ status }: { status: string }) {
  const style = verificationStatuses[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        style?.className ?? "border-slate-300 bg-white text-slate-700"
      }`}
      title={style?.meaning}
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
        {style?.icon ?? <circle cx="12" cy="12" r="9" />}
      </svg>
      <span className="sr-only">Verification status: </span>
      {style?.label ?? <span className="capitalize">{formatStatus(status)}</span>}
    </span>
  );
}
