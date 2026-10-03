import Link from "next/link";

import { SearchForm } from "@/components/search-form";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/expeditions", label: "Expeditions" },
  { href: "/scientists", label: "Scientists" },
  { href: "/publications", label: "Publications" },
  { href: "/datasets", label: "Datasets" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight text-slate-950"
        >
          <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-sky-700" />
          DhruvSetu
        </Link>

        <div className="flex flex-col gap-4 lg:items-end">
          <nav aria-label="Main navigation">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 sm:gap-x-7">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link className="hover:text-sky-800" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SearchForm compact />
        </div>
      </div>
    </header>
  );
}
