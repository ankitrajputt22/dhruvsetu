export default function Home() {
  return (
    <div id="home" className="min-h-screen bg-background">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <a
            href="#home"
            className="flex items-center gap-3 font-semibold tracking-tight text-slate-900"
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-sm bg-sky-700"
            />
            DhruvSetu
          </a>

          <nav aria-label="Main navigation">
            <ul className="flex items-center gap-5 text-sm text-slate-600 sm:gap-7">
              <li>
                <a className="font-medium text-sky-800" href="#home">
                  Home
                </a>
              </li>
              <li>
                <span className="cursor-default">Explore</span>
              </li>
              <li>
                <span className="cursor-default">Datasets</span>
              </li>
              <li>
                <span className="cursor-default">About</span>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-121px)] max-w-6xl items-center px-6 py-20 sm:min-h-[calc(100vh-73px)] lg:px-8">
        <section className="max-w-3xl" aria-labelledby="page-title">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-sky-800">
            India&apos;s Polar Science Platform
          </p>
          <h1
            id="page-title"
            className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl"
          >
            DhruvSetu
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700 sm:text-2xl">
            India&apos;s Polar Science Knowledge, Analysis and Outreach Platform
          </p>
          <p className="mt-8 max-w-xl border-l-4 border-sky-700 pl-5 text-base leading-7 text-slate-600 sm:text-lg">
            Explore India&apos;s polar science information in one place.
          </p>
        </section>
      </main>
    </div>
  );
}
