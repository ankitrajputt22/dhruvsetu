import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">
        Not found
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-slate-950">
        This information is not available.
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        The record may have moved or may not exist.
      </p>
      <Link
        className="mt-8 inline-block font-semibold text-sky-800"
        href="/expeditions"
      >
        Return to expeditions
      </Link>
    </div>
  );
}
