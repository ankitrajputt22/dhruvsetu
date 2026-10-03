import Image from "next/image";

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <header className="relative isolate overflow-hidden bg-[#0b4268] text-white">
      {image && (
        <Image
          alt={imageAlt ?? ""}
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src={image}
        />
      )}
      <div className="absolute inset-0 bg-[#062f4f]/70" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-sky-50 sm:text-lg">
          {description}
        </p>
      </div>
    </header>
  );
}
