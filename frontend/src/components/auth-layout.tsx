import Image from "next/image";
import Link from "next/link";

import { Icon, type IconName, LogoMark } from "@/components/icons";
import { photoCredit, siteImages } from "@/lib/images";

const capabilities: { icon: IconName; text: string }[] = [
  { icon: "search", text: "Explore polar research and its sources" },
  { icon: "dataset", text: "Analyse scientific datasets" },
  { icon: "location", text: "Connect knowledge, maps and evidence" },
];

// Lines of latitude and longitude seen from above a pole.
function PolarGrid() {
  const rings = [44, 88, 132, 176];
  const meridians = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    return {
      x: Math.round(200 + 176 * Math.cos(angle)),
      y: Math.round(200 + 176 * Math.sin(angle)),
    };
  });

  return (
    <svg
      aria-hidden="true"
      className="absolute -bottom-40 -right-40 h-[26rem] w-[26rem] text-sky-100/15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 400 400"
    >
      {rings.map((radius) => (
        <circle cx="200" cy="200" key={radius} r={radius} />
      ))}
      {meridians.map((point) => (
        <line key={`${point.x}-${point.y}`} x1="200" x2={point.x} y1="200" y2={point.y} />
      ))}
    </svg>
  );
}

// The frame shared by Sign In, Create Account and the welcome page: the
// DhruvSetu panel beside the form on wide screens, the form alone on small ones.
// In Lite Mode the panel keeps its plain background and no photograph is requested.
export function AuthLayout({
  title,
  subtitle,
  lite = false,
  children,
}: {
  title: string;
  subtitle: string;
  lite?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="relative hidden rounded-l-2xl bg-[#062f4f] text-white lg:block">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-l-2xl">
            {!lite && (
              <>
                <Image
                  alt={siteImages.authPanel.alt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 480px, 1px"
                  src={siteImages.authPanel.src}
                />
                {/* Keeps the white text readable over the photograph. */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#062f4f]/92 via-[#062f4f]/78 to-[#062f4f]/45" />
              </>
            )}
            <PolarGrid />
          </div>
          {/* Stays in view while a long form is scrolled. */}
          <div className="sticky top-0 px-10 py-12">
            <Link className="inline-flex items-center gap-3 text-white" href="/">
              <LogoMark className="h-10 w-10 text-sky-100" />
              <span className="text-2xl font-semibold tracking-tight">DhruvSetu</span>
            </Link>
            <p className="mt-6 max-w-xs text-lg leading-7 text-sky-50">
              India&apos;s Polar Science Knowledge, Analysis and Outreach Platform
            </p>
            <ul className="mt-10 space-y-5">
              {capabilities.map((item) => (
                <li className="flex items-center gap-4" key={item.text}>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-sky-100">
                    <Icon name={item.icon} />
                  </span>
                  <span className="text-sm leading-6 text-slate-100">{item.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-10 border-t border-white/15 pt-6 text-sm leading-6 text-sky-100/80">
              Browsing DhruvSetu needs no account.
            </p>
            {!lite && (
              <p className="mt-6 text-[11px] text-white/60">{photoCredit(siteImages.authPanel)}</p>
            )}
          </div>
        </aside>

        <div className="px-5 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto max-w-lg">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-2 leading-7 text-slate-600">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
