import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";

export function RepositoryItem({
  type,
  title,
  href,
  icon,
  metadata,
  isDemoData,
}: {
  type: string;
  title: string;
  href: string;
  icon: IconName;
  metadata?: string;
  isDemoData: boolean;
}) {
  return (
    <li>
      <Link
        className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        href={href}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sky-800">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-sky-800">
              {type}
            </p>
            <h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-slate-950 group-hover:text-sky-800">
              {title}
            </h3>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-xs text-slate-500">{metadata ?? "View record"}</p>
          {isDemoData && <DemoLabel />}
        </div>
      </Link>
    </li>
  );
}
