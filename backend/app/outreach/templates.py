"""Template-based outreach drafts.

Every draft is built by fixed rules from an OutreachSource. No model is called
and nothing is added that is not in the repository record, apart from the fixed
wording below and plain definitions of the record types.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.outreach.sources import OutreachSource
from app.schemas import OutreachAudience, OutreachFormat, OutreachResourceType

SOCIAL_POST_LIMIT = 280
REPOSITORY = "DhruvSetu, a repository of polar science information"

TYPE_WORDS = {
    OutreachResourceType.expedition: "expedition",
    OutreachResourceType.publication: "publication",
    OutreachResourceType.dataset: "dataset",
    OutreachResourceType.document: "source document",
    OutreachResourceType.report: "report",
}

# Plain meanings of the record types, used for the student glossary.
TYPE_MEANINGS = {
    OutreachResourceType.expedition: "Expedition: an organised journey made for research.",
    OutreachResourceType.publication: "Publication: a written work that shares research with others.",
    OutreachResourceType.dataset: "Dataset: a collection of data gathered for study.",
    OutreachResourceType.document: "Source document: a written record, such as a report or field notes.",
    OutreachResourceType.report: "Report: a written account of work that was done.",
}

STATUS_LABELS = {"uploaded": "Uploaded", "reviewed": "Reviewed", "verified": "Verified"}

DEMO_NOTICE = "Based on Demo / Prototype Data"
DEMO_SENTENCE = (
    "Based on Demo / Prototype Data. This record is test content, not real "
    "scientific information."
)


@dataclass(frozen=True)
class Section:
    heading: str
    body: str


@dataclass(frozen=True)
class Warning:
    code: str
    message: str


@dataclass(frozen=True)
class Draft:
    title: str
    sections: list[Section]

    @property
    def text(self) -> str:
        parts = [self.title]
        parts += [f"{section.heading}\n{section.body}" for section in self.sections]
        return "\n\n".join(parts) + "\n"


def status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status.replace("_", " ").capitalize())


def not_verified_message(source: OutreachSource) -> str:
    return (
        "This source has not yet been marked Verified. "
        f"Its status is {status_label(source.verification_status)}."
    )


def warnings_for(source: OutreachSource) -> list[Warning]:
    warnings = []
    if source.is_demo_data:
        warnings.append(Warning("demo_data", DEMO_NOTICE))
    if source.verification_status != "verified":
        warnings.append(Warning("not_verified", not_verified_message(source)))
    if source.summary is None and len(source.facts) < 3:
        warnings.append(
            Warning(
                "limited_information",
                "The repository has little information about this record, so the draft is short.",
            )
        )
    return warnings


def _type_word(source: OutreachSource) -> str:
    return TYPE_WORDS[source.resource_type]


def _a(word: str) -> str:
    return f"an {word}" if word[0] in "aeiou" else f"a {word}"


def _fit(text: str, limit: int) -> str:
    """Return as many whole sentences of the text as fit in the limit."""
    if len(text) <= limit:
        return text
    kept = ""
    for sentence in text.replace("? ", "?|").replace("! ", "!|").replace(". ", ".|").split("|"):
        candidate = f"{kept} {sentence}".strip()
        if len(candidate) > limit:
            break
        kept = candidate
    if kept:
        return kept
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _note(source: OutreachSource) -> Section | None:
    """Status lines that travel with the draft when it is copied or exported."""
    lines = []
    if source.is_demo_data:
        lines.append(DEMO_SENTENCE)
    if source.verification_status != "verified":
        lines.append(not_verified_message(source))
    return Section("Note", "\n".join(lines)) if lines else None


def _introduction(source: OutreachSource, audience: OutreachAudience) -> str:
    word, title = _type_word(source), source.title
    if audience == OutreachAudience.student:
        return f'"{title}" is {_a(word)} recorded in {REPOSITORY}.'
    if audience == OutreachAudience.teacher:
        return f'This text introduces the {word} "{title}" from {REPOSITORY}.'
    if audience == OutreachAudience.journalist:
        return (
            f'{REPOSITORY}, holds a record of the {word} "{title}". '
            f"Its verification status is {status_label(source.verification_status)}."
        )
    return f'"{title}" is {_a(word)} in {REPOSITORY}.'


def _description(source: OutreachSource, audience: OutreachAudience) -> str | None:
    """The repository's own description, quoted as it is stored."""
    if source.summary is None:
        return None
    if audience == OutreachAudience.student:
        return f"The repository describes it like this: {source.summary}"
    if audience == OutreachAudience.teacher:
        return f"Repository description: {source.summary}"
    if audience == OutreachAudience.journalist:
        return f'The repository describes it as follows: "{source.summary}"'
    return f"According to the repository: {source.summary}"


def _explanation(source: OutreachSource, audience: OutreachAudience) -> str:
    paragraphs = [_introduction(source, audience), _description(source, audience)]
    return "\n\n".join(paragraph for paragraph in paragraphs if paragraph)


def _key_points(source: OutreachSource) -> str | None:
    if not source.facts:
        return None
    return "\n".join(f"- {fact.label}: {fact.value}" for fact in source.facts)


def _terms(source: OutreachSource) -> str:
    lines = [f"- {TYPE_MEANINGS[source.resource_type]}"]
    for topic in source.topics:
        if topic.description:
            lines.append(f'- {topic.name}: the repository describes this topic as "{topic.description}"')
        else:
            lines.append(f"- {topic.name}: a research topic listed in the repository.")
    return "\n".join(lines)


def _sources(source: OutreachSource) -> Section:
    lines = [
        f"- {source.title} ({source.type_label}). DhruvSetu repository.",
        f"  Verification status: {status_label(source.verification_status)}",
    ]
    if source.is_demo_data:
        lines.append("  Demo / Prototype Data")
    if source.href:
        lines.append(f"  DhruvSetu page: {source.href}")
    if source.source_url and source.source_url.startswith(("http://", "https://")):
        lines.append(f"  Original source: {source.source_url}")
    return Section("Sources", "\n".join(lines))


def _sections(*sections: Section | None) -> list[Section]:
    return [section for section in sections if section is not None and section.body]


def _optional(heading: str, body: str | None) -> Section | None:
    return Section(heading, body) if body else None


def short_explanation(source: OutreachSource, audience: OutreachAudience) -> Draft:
    titles = {
        OutreachAudience.student: f"{source.title}: a simple explanation",
        OutreachAudience.teacher: f"{source.title}: explanation for teachers",
        OutreachAudience.journalist: f"{source.title}: background",
        OutreachAudience.public: f"About {source.title}",
    }
    return Draft(
        titles[audience],
        _sections(
            _note(source),
            Section("Short explanation", _explanation(source, audience)),
            _optional("Key points", _key_points(source)),
            # Students also get plain meanings of the terms used.
            Section("Important terms", _terms(source))
            if audience == OutreachAudience.student
            else None,
            _sources(source),
        ),
    )


def social_post(source: OutreachSource, audience: OutreachAudience) -> Draft:
    word, title = _type_word(source), source.title
    openings = {
        OutreachAudience.student: f'Learn about "{title}", {_a(word)} in the DhruvSetu polar science repository.',
        OutreachAudience.teacher: f'For the classroom: "{title}", {_a(word)} in the DhruvSetu polar science repository.',
        OutreachAudience.journalist: f'"{title}": {word} record in the DhruvSetu polar science repository.',
        OutreachAudience.public: f'From the DhruvSetu polar science repository: "{title}", {_a(word)}.',
    }
    post = openings[audience]
    if source.is_demo_data:
        post = f"[Demo / Prototype Data] {post}"
    # Every post names its source. Journalists also get the source status.
    attribution = "Source: DhruvSetu."
    if audience == OutreachAudience.journalist:
        attribution = (
            f"Source: DhruvSetu, status {status_label(source.verification_status)}."
        )

    # The repository description is added only as far as the post stays short.
    room = SOCIAL_POST_LIMIT - len(post) - len(attribution) - 2
    summary = source.summary or ""
    if source.is_demo_data:
        # The post already starts with the demo label, so it is not repeated.
        summary = summary.removeprefix("Demo / Prototype Data.").strip()
    if summary and room > 40:
        post = f"{post} {_fit(summary, room)}"
    post = f"{post} {attribution}"

    return Draft(
        title,
        _sections(Section("Post", post), _sources(source)),
    )


def classroom_note(source: OutreachSource, audience: OutreachAudience) -> Draft:
    word = _type_word(source)
    objectives = {
        OutreachAudience.student: f'After reading this note you should be able to say what the {word} "{source.title}" is, using the DhruvSetu record.',
        OutreachAudience.teacher: f'Students will be able to describe the {word} "{source.title}" using the DhruvSetu record, and say where the information comes from.',
        OutreachAudience.journalist: f'Readers will be able to summarise the {word} "{source.title}" and its source status from the DhruvSetu record.',
        OutreachAudience.public: f'Readers will be able to describe the {word} "{source.title}" using the DhruvSetu record.',
    }
    topic_names = ", ".join(topic.name for topic in source.topics)
    questions = [
        f"What does this record tell us about the {word}, and what would you still like to know?",
    ]
    if topic_names:
        questions.append(
            f"The record lists these research topics: {topic_names}. What questions do they raise for you?"
        )
    if audience == OutreachAudience.teacher:
        questions.append(
            f"The source status is {status_label(source.verification_status)}. Why does it help to know how far a source has been checked?"
        )

    return Draft(
        f"Classroom note: {source.title}",
        _sections(
            _note(source),
            Section("Topic", source.title),
            Section("Learning objective", objectives[audience]),
            Section("Explanation", _explanation(source, audience)),
            _optional("Key points", _key_points(source)),
            Section(
                "Discussion question" if len(questions) == 1 else "Discussion questions",
                "\n".join(f"- {question}" for question in questions),
            ),
            _sources(source),
        ),
    )


def _why_it_matters(source: OutreachSource) -> str | None:
    """Only the repository's own topic descriptions, and never for demo data."""
    described = [topic for topic in source.topics if topic.description]
    if source.is_demo_data or not described:
        return None
    lines = [f"The repository links this {_type_word(source)} to these research topics:"]
    lines += [f'- {topic.name}: "{topic.description}"' for topic in described]
    return "\n".join(lines)


def news_brief(source: OutreachSource, audience: OutreachAudience) -> Draft:
    word = _type_word(source)
    headlines = {
        OutreachAudience.student: f"{source.type_label} in focus: {source.title}",
        OutreachAudience.teacher: f"{source.type_label} for the classroom: {source.title}",
        OutreachAudience.journalist: f"{source.type_label} record: {source.title}",
        OutreachAudience.public: f"{source.type_label}: {source.title}",
    }
    return Draft(
        f"News brief: {source.title}",
        _sections(
            _note(source),
            Section("Headline", headlines[audience]),
            Section("Context", _explanation(source, audience)),
            _optional("Key repository facts", _key_points(source)),
            _optional("Why it matters", _why_it_matters(source)),
            _sources(source),
        ),
    )


TEMPLATES = {
    OutreachFormat.short_explanation: short_explanation,
    OutreachFormat.social_post: social_post,
    OutreachFormat.classroom_note: classroom_note,
    OutreachFormat.news_brief: news_brief,
}


class TemplateGenerator:
    """Fixed-rule generator. A later generator can offer the same method."""

    name = "template"

    def generate(
        self,
        source: OutreachSource,
        audience: OutreachAudience,
        format: OutreachFormat,
    ) -> Draft:
        return TEMPLATES[format](source, audience)


def get_generator() -> TemplateGenerator:
    return TemplateGenerator()
