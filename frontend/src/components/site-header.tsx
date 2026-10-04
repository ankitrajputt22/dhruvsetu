import Link from "next/link";

import { Icon, LogoMark } from "@/components/icons";
import { LiteModeToggle } from "@/components/lite-mode";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/expeditions", label: "Expeditions" },
  { href: "/scientists", label: "Scientists" },
  { href: "/publications", label: "Publications" },
  { href: "/datasets", label: "Datasets" },
  { href: "/documents", label: "Documents" },
  { href: "/map", label: "Polar Map" },
  { href: "/assistant", label: "Ask DhruvSetu" },
];

export function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-white/10 bg-[#062f4f] text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-white"
        >
          <LogoMark className="h-8 w-8 text-sky-100" />
          DhruvSetu
        </Link>

        <div className="ml-auto hidden items-center gap-3 lg:flex xl:gap-5">
          <nav aria-label="Main navigation" className="h-full">
            <ul className="flex h-full items-center gap-3 whitespace-nowrap text-sm text-slate-200 xl:gap-5">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link className="py-2 transition hover:text-white" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            aria-label="Search DhruvSetu"
            className="rounded-full p-2 text-sky-100 transition hover:bg-white/10 hover:text-white"
            href="/search"
          >
            <Icon name="search" className="h-5 w-5" />
          </Link>
        </div>

        <div className="ml-auto lg:ml-0">
          <LiteModeToggle />
        </div>

        <details className="group relative lg:hidden">
          <summary
            aria-label="Open navigation menu"
            className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-sm font-medium marker:content-none"
          >
            <span className="hidden sm:inline">Menu</span>
            <span aria-hidden="true" className="space-y-1">
              <span className="block h-px w-4 bg-white" />
              <span className="block h-px w-4 bg-white" />
              <span className="block h-px w-4 bg-white" />
            </span>
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-xl">
            <nav aria-label="Mobile navigation">
              <ul className="space-y-1 text-sm">
                {navigation.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="block rounded-md px-3 py-2.5 hover:bg-sky-50 hover:text-sky-900"
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="border-t border-slate-200 pt-1">
                  <Link
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 hover:bg-sky-50 hover:text-sky-900"
                    href="/search"
                  >
                    <Icon name="search" className="h-4 w-4" /> Search
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
