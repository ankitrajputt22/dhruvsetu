import Link from "next/link";

import { LogoMark } from "@/components/icons";

const links = [
  { href: "/expeditions", label: "Expeditions" },
  { href: "/scientists", label: "Scientists" },
  { href: "/publications", label: "Publications" },
  { href: "/datasets", label: "Datasets" },
  { href: "/documents", label: "Documents" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-[#062f4f] text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr] lg:px-8">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <LogoMark className="h-9 w-9" />
            <span className="text-lg font-semibold">DhruvSetu</span>
          </Link>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            India&apos;s Polar Science Platform. Explore research, data, people,
            and expeditions in one place.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Explore</p>
          <nav aria-label="Footer navigation" className="mt-4">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              {links.map((item) => (
                <li key={item.href}>
                  <Link className="transition hover:text-white" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>Prototype developed for Smart India Hackathon.</p>
          <p>Polar science knowledge, analysis, and outreach.</p>
        </div>
      </div>
    </footer>
  );
}
