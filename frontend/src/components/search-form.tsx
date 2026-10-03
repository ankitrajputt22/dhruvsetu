import type { SearchMode } from "@/lib/types";

export function SearchForm({
  defaultQuery = "",
  compact = false,
  mode = "keyword",
}: {
  defaultQuery?: string;
  compact?: boolean;
  mode?: SearchMode;
}) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={`flex w-full ${compact ? "max-w-sm" : "max-w-2xl"}`}
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
        className="min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-700"
      />
      <button
        type="submit"
        className="rounded-r-sm border border-sky-800 bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
      >
        Search
      </button>
    </form>
  );
}
