import Link from "next/link";

import { type AuthUser, canUseDataLab } from "@/lib/auth";

export const DATA_LAB_RESEARCH_ONLY = "Polar Data Lab is available to research users.";

// Explains who can use Polar Data Lab, to a visitor who cannot. The API makes
// the real check when a session is started.
export function DataLabResearchOnly({
  user,
  next,
}: {
  user: AuthUser | null;
  next: string;
}) {
  return (
    <>
      {DATA_LAB_RESEARCH_ONLY}{" "}
      {user === null ? (
        <Link
          className="font-semibold text-sky-800 hover:underline"
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          Login
        </Link>
      ) : (
        "Your account does not have research access."
      )}
    </>
  );
}

// The Polar Data Lab part of a dataset page.
export function DatasetDataLabAction({
  user,
  enabled,
  fileSupported,
  datasetId,
}: {
  user: AuthUser | null;
  enabled: boolean;
  fileSupported: boolean;
  datasetId: string;
}) {
  const href = `/data-lab?dataset=${datasetId}`;
  const textClass = "mt-2 text-sm leading-6 text-slate-600";

  if (!enabled) {
    return <p className={textClass}>Polar Data Lab is not enabled on this server.</p>;
  }
  if (!canUseDataLab(user)) {
    return (
      <p className={textClass}>
        <DataLabResearchOnly next={href} user={user} />
      </p>
    );
  }
  if (!fileSupported) {
    return (
      <p className={textClass}>
        This dataset cannot currently be opened in Polar Data Lab. A CSV or JSON
        data file is needed.
      </p>
    );
  }
  return (
    <>
      <p className={textClass}>Analyse this dataset with Python in a temporary session.</p>
      <Link
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-800 bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
        href={href}
      >
        Open in Polar Data Lab <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}
