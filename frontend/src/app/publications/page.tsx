import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { getApi } from "@/lib/api";
import { doiUrl, publicationUrl } from "@/lib/format";
import type { Publication } from "@/lib/types";

export default async function PublicationsPage() {
  const result = await getApi<Publication[]>("/api/publications");

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Knowledge repository"
        title="Publications"
        description="Peer-reviewed papers on India's polar research, each with its authors, journal and DOI."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No publications are available yet.</DataMessage>
        ) : (
          <ul className="space-y-4">
            {result.data.map((publication) => (
              <PublicationCard key={publication.id} publication={publication} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// A link to the paper on another site. It opens in a new tab.
function PaperLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a className={className} href={href} rel="noopener noreferrer" target="_blank">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function PublicationCard({ publication }: { publication: Publication }) {
  // Both come from the record itself. Without a source link or a DOI the
  // title and the DOI stay plain text.
  const paperUrl = publicationUrl(publication);
  const doiLink = doiUrl(publication.doi);

  return (
    <li
      id={`publication-${publication.id}`}
      className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm target:border-sky-400 target:ring-2 target:ring-sky-200 sm:p-6"
    >
      <article className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
          <Icon name="publication" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                {publication.publication_year ?? "Year not listed"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {paperUrl ? (
                  <PaperLink
                    className="rounded-sm underline-offset-4 transition hover:text-sky-800 hover:underline"
                    href={paperUrl}
                  >
                    {publication.title}
                  </PaperLink>
                ) : (
                  publication.title
                )}
              </h2>
              {publication.authors && (
                <p className="mt-2 text-sm leading-6 text-slate-700">{publication.authors}</p>
              )}
              {publication.journal && (
                <p className="mt-1 text-sm italic text-slate-600">{publication.journal}</p>
              )}
            </div>
            {publication.is_demo_data && <DemoLabel />}
          </div>
          <p className="mt-3 max-w-4xl leading-7 text-slate-600">
            {publication.summary ?? "No summary is available."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <VerificationBadge status={publication.verification_status} />
            {publication.doi && (
              <span className="break-all text-xs text-slate-500">
                DOI:{" "}
                {doiLink ? (
                  <PaperLink
                    className="rounded-sm font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
                    href={doiLink}
                  >
                    {publication.doi}
                  </PaperLink>
                ) : (
                  publication.doi
                )}
              </span>
            )}
            <OriginalSourceLink
              className="text-xs"
              title={publication.title}
              url={publication.source_url}
            />
          </div>
        </div>
      </article>
    </li>
  );
}
