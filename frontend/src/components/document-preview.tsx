import { formatFileSize } from "@/lib/format";
import type { DocumentFileInfo } from "@/lib/types";

// The stored copy of a document: shown inside the page when it is a PDF or a
// text file, with links to open and download it. This is the file DhruvSetu
// holds. The original source on another site has its own section.

const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
      {children}
    </p>
  );
}

export function DocumentPreview({
  documentId,
  title,
  file,
  text,
  lite = false,
}: {
  documentId: string;
  title: string;
  file: DocumentFileInfo | null;
  // The contents of a text file, already read on the server.
  text: string | null;
  // In Lite Mode a PDF is not loaded into the page.
  lite?: boolean;
}) {
  const base = `/api/documents/${encodeURIComponent(documentId)}`;

  return (
    <section aria-labelledby="document-preview" className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="text-xl font-semibold text-slate-950" id="document-preview">
        Document preview
      </h2>

      {file === null ? (
        // Not an error: some records only describe a source.
        <Notice>
          DhruvSetu stores metadata and source information for this record, but
          does not hold a local copy of the document.
        </Notice>
      ) : !file.available ? (
        <Notice>
          {file.preview_message ?? "The stored file for this document is currently unavailable."}
        </Notice>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The copy of this document that DhruvSetu holds
            {file.size_bytes !== null && ` (${formatFileSize(file.size_bytes)})`}.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              className={`${buttonClass} border-sky-800 bg-sky-800 text-white hover:bg-sky-900`}
              href={`${base}/file`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open File
              <span className="sr-only">: {title} (opens in a new tab)</span>
              <span aria-hidden="true">↗</span>
            </a>
            <a
              className={`${buttonClass} border-sky-800 bg-white text-sky-800 hover:bg-sky-50`}
              href={`${base}/download`}
            >
              Download
              <span className="sr-only">: {title}</span>
            </a>
          </div>

          {!file.previewable ? (
            <Notice>{file.preview_message ?? "Preview is not available for this file type."}</Notice>
          ) : file.file_type === "pdf" ? (
            lite ? (
              <Notice>
                The PDF is not loaded into the page in Lite Mode. Use Open File
                to read it.
              </Notice>
            ) : (
              <>
                <iframe
                  className="mt-4 h-[28rem] w-full rounded-lg border border-slate-200 bg-slate-100 sm:h-[40rem] lg:h-[46rem]"
                  loading="lazy"
                  src={`${base}/file`}
                  title={`PDF preview of ${title}`}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  If the PDF does not appear here, use Open File. Some phones
                  and tablets cannot show a PDF inside a page.
                </p>
              </>
            )
          ) : file.file_type === "txt" && text !== null ? (
            // Shown as plain text. Markup inside the file is never run.
            <pre
              aria-label={`Text of ${title}`}
              className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800"
              role="region"
              tabIndex={0}
            >
              {text}
            </pre>
          ) : file.file_type === "txt" ? (
            <Notice>The preview could not be loaded right now. Use Open File to read it.</Notice>
          ) : (
            <Notice>Preview is not available for this file type.</Notice>
          )}
        </>
      )}
    </section>
  );
}
