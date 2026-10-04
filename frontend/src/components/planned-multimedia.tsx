import { Icon, type IconName } from "@/components/icons";

// A description of a planned feature. Nothing here generates anything: the
// section has no button, no form and no request, and it says so itself.

const sources: { icon: IconName; label: string }[] = [
  { icon: "publication", label: "Publication" },
  { icon: "dataset", label: "Dataset" },
  { icon: "expedition", label: "Expedition" },
  { icon: "document", label: "Report" },
  { icon: "topic", label: "Research Topic" },
  { icon: "document", label: "Document" },
];

const steps: { title: string; text: string }[] = [
  {
    title: "Research Data",
    text: "Select verified information from publications, datasets, reports, expeditions, documents or research topics.",
  },
  {
    title: "Source Understanding",
    text: "DhruvSetu identifies the important scientific information and maintains source provenance.",
  },
  {
    title: "Script & Storyboard",
    text: "Convert the research into a structured explanation suitable for multimedia communication.",
  },
  {
    title: "Visual / Audio Generation",
    text: "Future generation tools can create audio, visuals and video elements based on the reviewed script.",
  },
  {
    title: "Human Review",
    text: "Researchers or authorised reviewers check scientific accuracy before publishing.",
  },
  {
    title: "Publish",
    text: "Approved multimedia can be used for education, institutional outreach and public communication.",
  },
];

const outputs: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "video",
    title: "Scientific Explainer Video",
    text: "Turn verified research into short visual explanations.",
  },
  {
    icon: "audio",
    title: "Audio Summary",
    text: "Generate accessible audio summaries of scientific resources.",
  },
  {
    icon: "podcast",
    title: "Podcast-style Content",
    text: "Create structured spoken explanations around polar-science topics.",
  },
  {
    icon: "visual",
    title: "Educational Visuals",
    text: "Convert complex scientific information into easier visual learning material.",
  },
  {
    icon: "infographic",
    title: "Infographics",
    text: "Present important data or scientific concepts visually.",
  },
  {
    icon: "share",
    title: "Social Media Visual Content",
    text: "Create short, source-grounded outreach material for public communication.",
  },
  {
    icon: "clip",
    title: "Short Research Videos",
    text: "Summarise research, datasets or expeditions using a short visual format.",
  },
];

function PlannedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-amber-900">
      {children}
    </span>
  );
}

export function PlannedMultimedia() {
  return (
    <section
      aria-labelledby="multimedia-heading"
      className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      id="multimedia"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2
          className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
          id="multimedia-heading"
        >
          Multimedia Content Generation
        </h2>
        <PlannedLabel>Planned Extension</PlannedLabel>
      </div>
      <p className="mt-3 max-w-3xl text-lg leading-7 text-slate-800">
        Turn verified polar research into engaging multimedia content.
      </p>
      <p className="mt-2 max-w-3xl leading-7 text-slate-600">
        DhruvSetu will extend its source-grounded outreach system to support
        visual and audio content directly from repository resources.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        This is a plan, not a working tool. Nothing on this page generates
        video, audio or images today.
      </p>

      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Repository sources it will start from
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {sources.map((source) => (
            <li
              key={source.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900"
            >
              <Icon className="h-4 w-4" name={source.icon} />
              {source.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-950">Planned workflow</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Six stages, from a repository record to reviewed content.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b527b] text-sm font-semibold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-slate-950">
                    <span className="sr-only">Stage {index + 1}: </span>
                    {step.title}
                  </h4>
                  {index < steps.length - 1 && (
                    // Points to the next stage: down in one column, right in a grid.
                    <Icon
                      className="mt-0.5 h-4 w-4 shrink-0 rotate-90 text-sky-700 sm:rotate-0"
                      name="arrow"
                    />
                  )}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-950">Planned outputs</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          The kinds of material the extension is meant to produce. None is
          available yet.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {outputs.map((output) => (
            <li
              key={output.title}
              className="rounded-xl border border-dashed border-slate-300 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                  <Icon name={output.icon} />
                </span>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Planned
                </span>
              </div>
              <h4 className="mt-3 font-semibold text-slate-950">{output.title}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{output.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" name="status" />
        <div>
          <h3 className="font-semibold text-slate-950">Source-grounded by design</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
            Future multimedia content will be created from DhruvSetu repository
            sources. Scientific claims will remain linked to their original
            documents, datasets or publications, and generated content will
            require review before publication.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-5">
        <p className="font-semibold text-slate-950">
          Coming Soon — Planned for future development
        </p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          This section presents the planned direction of DhruvSetu and does not
          currently generate multimedia content.
        </p>
      </div>
    </section>
  );
}
