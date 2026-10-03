import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";

export function ResourceLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <Link
      className="group flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
      href={href}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="mt-5 flex items-center justify-between gap-3 font-semibold text-slate-950">
        {title}
        <span aria-hidden="true" className="text-sky-700 transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
      <span className="mt-2 text-sm leading-5 text-slate-600">{description}</span>
    </Link>
  );
}
