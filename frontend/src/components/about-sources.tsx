import {
  VerificationBadge,
  verificationOrder,
  verificationStatuses,
} from "@/components/verification-badge";

export function AboutSources() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-950">About sources</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        DhruvSetu shows source and verification information so users can check
        where repository information comes from.
      </p>
      <dl className="mt-4 space-y-3">
        {verificationOrder.map((status) => (
          <div key={status}>
            <dt>
              <VerificationBadge status={status} />
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-slate-600">
              {verificationStatuses[status].meaning}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        The Demo Data label marks prototype content. It is separate from the
        verification status.
      </p>
    </section>
  );
}
