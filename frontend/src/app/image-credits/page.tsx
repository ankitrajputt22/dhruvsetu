import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { safeExternalUrl } from "@/lib/format";
import { siteImages } from "@/lib/images";

export const metadata: Metadata = {
  title: "Image Credits",
};

// Text only: the page lists the photographs without loading them.
export default function ImageCreditsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="About"
        title="Image credits"
        description="Every photograph on DhruvSetu is used under the licence listed here. The files were resized and compressed, and are otherwise unchanged."
      />

      <ul className="mt-8 space-y-4">
        {Object.values(siteImages).map((image) => {
          const source = safeExternalUrl(image.sourceUrl);
          const licence = safeExternalUrl(image.licenceUrl);
          return (
            <li
              key={image.src}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-slate-950">{image.caption}</h2>
              <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-slate-500">Credit:</dt>
                  <dd>{image.credit}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-slate-500">Licence:</dt>
                  <dd>
                    {licence ? (
                      <a
                        className="font-medium text-sky-800 hover:underline"
                        href={licence}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {image.licence}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      image.licence
                    )}
                  </dd>
                </div>
                {source && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500">Source:</dt>
                    <dd>
                      <a
                        className="font-medium text-sky-800 hover:underline"
                        href={source}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Wikimedia Commons file page
                        <span className="sr-only"> for this photograph (opens in a new tab)</span>
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm leading-6 text-slate-600">
        NASA photographs are shown as illustrations of the polar regions. Their use
        does not mean that NASA endorses DhruvSetu. Scientist profiles show initials
        instead of portraits, because no portrait is used without a clear licence.
      </p>
    </div>
  );
}
