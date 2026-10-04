import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OutreachPage from "@/app/outreach/page";
import { PlannedMultimedia } from "@/components/planned-multimedia";

// The working Outreach Studio is tested by the backend. Here it only marks
// where it sits on the page.
vi.mock("@/components/outreach-studio", () => ({
  OutreachStudio: () => <div data-testid="outreach-studio" />,
}));

afterEach(cleanup);

const section = () => screen.getByRole("region", { name: "Multimedia Content Generation" });

describe("planned multimedia section", () => {
  it("is labelled as planned, at the top and at the bottom", () => {
    render(<PlannedMultimedia />);

    expect(
      within(section()).getByRole("heading", { level: 2, name: "Multimedia Content Generation" }),
    ).toBeTruthy();
    expect(within(section()).getByText("Planned Extension")).toBeTruthy();
    expect(
      within(section()).getByText("Turn verified polar research into engaging multimedia content."),
    ).toBeTruthy();
    expect(within(section()).getByText("Coming Soon — Planned for future development")).toBeTruthy();
    expect(
      within(section()).getByText(
        "This section presents the planned direction of DhruvSetu and does not currently generate multimedia content.",
      ),
    ).toBeTruthy();
  });

  it("shows the six stages of the workflow in order, each with an explanation", () => {
    render(<PlannedMultimedia />);

    const stages = within(section())
      .getAllByRole("listitem")
      .filter((item) => item.parentElement?.tagName === "OL");
    expect(stages.map((stage) => within(stage).getByRole("heading", { level: 4 }).textContent)).toEqual([
      "Stage 1: Research Data",
      "Stage 2: Source Understanding",
      "Stage 3: Script & Storyboard",
      "Stage 4: Visual / Audio Generation",
      "Stage 5: Human Review",
      "Stage 6: Publish",
    ]);
    for (const stage of stages) {
      expect((stage.querySelector("p")?.textContent ?? "").length).toBeGreaterThan(40);
    }
    // Review comes before publishing.
    expect(within(stages[4]).getByText(/check scientific accuracy before publishing/)).toBeTruthy();
  });

  it("lists the seven planned outputs, each marked as planned", () => {
    render(<PlannedMultimedia />);

    const heading = within(section()).getByRole("heading", { level: 3, name: "Planned outputs" });
    const cards = within(heading.parentElement as HTMLElement).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 4 }).textContent)).toEqual([
      "Scientific Explainer Video",
      "Audio Summary",
      "Podcast-style Content",
      "Educational Visuals",
      "Infographics",
      "Social Media Visual Content",
      "Short Research Videos",
    ]);
    for (const card of cards) {
      expect(within(card).getByText("Planned")).toBeTruthy();
    }
  });

  it("names the repository sources and explains that content stays tied to them", () => {
    render(<PlannedMultimedia />);

    for (const source of ["Publication", "Dataset", "Expedition", "Report", "Research Topic", "Document"]) {
      expect(within(section()).getByText(source)).toBeTruthy();
    }
    expect(
      within(section()).getByRole("heading", { level: 3, name: "Source-grounded by design" }),
    ).toBeTruthy();
    expect(
      within(section()).getByText(
        /Scientific claims will remain linked to their original\s+documents, datasets or publications, and generated content will\s+require review before publication\./,
      ),
    ).toBeTruthy();
  });

  it("offers nothing to press: no button, link, form or media that could look like a result", () => {
    render(<PlannedMultimedia />);

    expect(section().querySelectorAll("button, a, form, input, select, textarea")).toHaveLength(0);
    expect(section().querySelectorAll("video, audio, img, canvas, iframe")).toHaveLength(0);
    expect(within(section()).getByText(/Nothing on this page generates\s+video, audio or images today\./)).toBeTruthy();
  });
});

describe("Outreach Studio page", () => {
  it("keeps the working studio first and the planned section below it", () => {
    render(<OutreachPage />);

    const studio = screen.getByTestId("outreach-studio");
    expect(screen.getByRole("heading", { level: 1, name: "Outreach Studio" })).toBeTruthy();
    // The planned section comes after the studio in the page.
    expect(
      studio.compareDocumentPosition(section()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The homepage link lands on it.
    expect(section().id).toBe("multimedia");
  });
});
