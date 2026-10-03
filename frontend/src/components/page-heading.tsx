export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-slate-200 pb-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-800">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
        {description}
      </p>
    </header>
  );
}

export function DataMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-4 border-slate-300 bg-white px-5 py-4 text-slate-600">
      {children}
    </p>
  );
}
