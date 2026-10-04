import Link from "next/link";

import { DataMessage } from "@/components/page-heading";

const sections = [
  { key: "verification", href: "/admin", label: "Verification" },
  { key: "users", href: "/admin/users", label: "Users" },
] as const;

export function AdminShell({
  current,
  children,
}: {
  current: (typeof sections)[number]["key"];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Admin</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.025em] text-slate-950">
        Repository administration
      </h1>
      <nav aria-label="Admin sections" className="mt-6 border-b border-slate-200">
        <ul className="flex gap-6 text-sm font-semibold">
          {sections.map((section) => (
            <li key={section.key}>
              <Link
                aria-current={section.key === current ? "page" : undefined}
                className={`-mb-px block border-b-2 pb-3 ${
                  section.key === current
                    ? "border-sky-800 text-sky-900"
                    : "border-transparent text-slate-600 hover:text-slate-950"
                }`}
                href={section.href}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}

// Shown to a signed-in account that is not an admin.
export function AdminOnly() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
      <DataMessage>
        This area is for DhruvSetu admins. Your account does not have permission to
        open it.{" "}
        <Link className="font-semibold text-sky-800 hover:underline" href="/">
          Back to the home page
        </Link>
      </DataMessage>
    </div>
  );
}
