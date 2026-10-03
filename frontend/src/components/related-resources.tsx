import Link from "next/link";

import type { RelatedDocumentResource } from "@/lib/types";

const labels: Record<string, string> = {
  expedition: "Related expedition",
  publication: "Related publication",
  report: "Related report",
};

export function RelatedResources({
  resources,
}: {
  resources: RelatedDocumentResource[];
}) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1 text-sm">
      {resources.map((resource) => (
        <li key={`${resource.type}-${resource.id}`} className="break-words">
          <span className="text-slate-500">
            {labels[resource.type] ?? "Related record"}:{" "}
          </span>
          {resource.href?.includes("#") ? (
            // A full page load so the linked record is highlighted on arrival.
            <a className="font-medium text-sky-800 hover:underline" href={resource.href}>
              {resource.title}
            </a>
          ) : resource.href ? (
            <Link className="font-medium text-sky-800 hover:underline" href={resource.href}>
              {resource.title}
            </Link>
          ) : (
            <span className="font-medium text-slate-800">{resource.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
