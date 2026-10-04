import {
  VerificationBadge,
  verificationMeaning,
} from "@/components/verification-badge";

// The verification box shown beside a document or dataset record.
export function VerificationSummary({
  status,
  isDemoData,
}: {
  status: string;
  isDemoData: boolean;
}) {
  const meaning = verificationMeaning(status);

  return (
    <section className="rounded-xl bg-slate-50 p-5">
      <h2 className="text-sm font-semibold text-slate-950">Verification</h2>
      <div className="mt-3">
        <VerificationBadge status={status} />
      </div>
      {meaning && <p className="mt-3 text-sm leading-6 text-slate-600">{meaning}</p>}
      {isDemoData && (
        <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600">
          This is demo data. It is not real scientific information.
        </p>
      )}
    </section>
  );
}
