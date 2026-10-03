import type { SearchMode } from "@/lib/types";

export function SearchForm({
  defaultQuery = "",
  compact = false,
  mode = "keyword",
  tone = "light",
}: {
  defaultQuery?: string;
  compact?: boolean;
  mode?: SearchMode;
  tone?: "light" | "hero";
}) {
  const isHero = tone === "hero";
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={`flex w-full flex-col gap-2 sm:flex-row sm:gap-0 ${compact ? "max-w-sm" : "max-w-2xl"}`}
    >
      <input type="hidden" name="mode" value={mode} />
      <label className="sr-only" htmlFor={compact ? "site-search" : "page-search"}>
        Search DhruvSetu
      </label>
      <input
        id={compact ? "site-search" : "page-search"}
        name="q"
        type="search"
        defaultValue={defaultQuery}
        placeholder="Search polar science..."
        className={`min-w-0 flex-1 rounded-lg border bg-white px-4 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50 sm:rounded-r-none sm:border-r-0 ${
          isHero
            ? "border-white/70 py-3.5 shadow-lg"
            : "border-slate-300 py-3"
        }`}
      />
      <button
        type="submit"
        className={`w-full rounded-lg border px-5 text-sm font-semibold text-white transition sm:w-auto sm:rounded-l-none ${
          isHero
            ? "border-sky-600 bg-sky-600 py-3.5 hover:bg-sky-500"
            : "border-sky-800 bg-sky-800 py-3 hover:bg-sky-900"
        }`}
      >
        Search
      </button>
    </form>
  );
}
