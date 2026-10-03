export type IconName =
  | "arrow"
  | "calendar"
  | "dataset"
  | "document"
  | "expedition"
  | "location"
  | "publication"
  | "scientist"
  | "search"
  | "status"
  | "topic";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  dataset: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  document: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  expedition: (
    <>
      <path d="m3 19 6-10 4 6 3-4 5 8z" />
      <path d="m9 9 2-4 2 4" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  publication: (
    <>
      <path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 3z" />
      <path d="M20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3z" />
    </>
  ),
  scientist: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0M8 14l4 4 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  status: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  topic: (
    <>
      <path d="M12 3a7 7 0 0 0-4 12.7V20h8v-4.3A7 7 0 0 0 12 3Z" />
      <path d="M9 23h6M9 16h6" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
    >
      <path
        d="M4 30 15.5 11l4.2 7 3.8-5.5L36 30H4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m11.5 24 4-5 3 3 5-6 5.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 33h26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
