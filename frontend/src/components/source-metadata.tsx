import { formatDate, formatStatus } from "@/lib/format";

// One line of source details. Anything that is missing is left out.
export function SourceMetadata({
  sourceType,
  fileType,
  sectionName,
  publicationDate,
}: {
  sourceType: string | null;
  fileType: string | null;
  sectionName?: string | null;
  publicationDate: string | null;
}) {
  const items: { key: string; content: React.ReactNode }[] = [];
  if (sourceType) {
    items.push({
      key: "source-type",
      content: <span className="capitalize">{formatStatus(sourceType)}</span>,
    });
  }
  if (fileType) {
    items.push({
      key: "file-type",
      content: (
        <>
          <span className="uppercase">{fileType}</span> document
        </>
      ),
    });
  }
  if (sectionName) {
    items.push({ key: "section", content: sectionName });
  }
  if (publicationDate) {
    items.push({ key: "date", content: formatDate(publicationDate) });
  }
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">•</span>}
          <span>{item.content}</span>
        </li>
      ))}
    </ul>
  );
}
