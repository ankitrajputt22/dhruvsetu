import { safeExternalUrl } from "@/lib/format";

export function OriginalSourceLink({
  url,
  title,
  className = "text-sm",
  label = "Open Original Source",
}: {
  url: string | null;
  title: string;
  className?: string;
  label?: string;
}) {
  const safeUrl = safeExternalUrl(url);
  if (safeUrl === null) {
    return null;
  }

  return (
    <a
      className={`inline-flex items-center gap-1.5 font-semibold text-sky-800 hover:underline ${className}`}
      href={safeUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
      <span className="sr-only"> for {title} (opens in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
