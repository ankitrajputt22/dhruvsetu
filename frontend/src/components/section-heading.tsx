import Link from "next/link";

export function SectionHeading({
  id,
  title,
  description,
  href,
  linkLabel = "View all",
}: {
  id?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link className="text-sm font-semibold text-sky-800 hover:underline" href={href}>
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
