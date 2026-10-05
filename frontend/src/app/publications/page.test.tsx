import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicationsPage from "@/app/publications/page";
import { doiUrl, publicationUrl } from "@/lib/format";
import type { Publication } from "@/lib/types";

const getApi = vi.fn();
vi.mock("@/lib/api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));

function publication(values: Partial<Publication>): Publication {
  return {
    id: "paper",
    title: "A paper",
    authors: null,
    journal: null,
    publication_year: 2026,
    doi: null,
    source_url: null,
    summary: null,
    verification_status: "uploaded",
    is_demo_data: false,
    ...values,
  };
}

const goel = publication({
  id: "goel-2026",
  title: "A new coastal ice-core site identified in Dronning Maud Land, Antarctica",
  authors: "Vikram Goel, Carlos Martín",
  journal: "The Cryosphere, 20, 1363-1378",
  doi: "10.5194/tc-20-1363-2026",
  source_url: "https://doi.org/10.5194/tc-20-1363-2026",
});
// A source link that is not the DOI address, and a record with only a DOI.
const hosted = publication({
  id: "hosted",
  title: "Paper with its own source page",
  doi: "10.3390/rs13142808",
  source_url: "https://www.mdpi.com/2072-4292/13/14/2808",
});
const doiOnly = publication({ id: "doi-only", title: "Paper with a DOI only", doi: "10.5194/tc-6-505-2012" });
const bare = publication({ id: "bare", title: "Paper without a source" });
const unsafe = publication({
  id: "unsafe",
  title: "Paper with unusable details",
  doi: "not a doi",
  source_url: "javascript:alert(1)",
});

async function open(publications: Publication[]) {
  getApi.mockResolvedValue({ data: publications, status: 200, detail: null });
  render(await PublicationsPage());
}

function card(title: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: new RegExp(`^${title}`) }).closest("li") as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("publication links", () => {
  it("makes the title a link to the paper and keeps it the heading of the card", async () => {
    await open([goel]);

    const heading = within(card(goel.title)).getByRole("heading", { level: 2 });
    const link = within(heading).getByRole("link");
    expect(link.getAttribute("href")).toBe("https://doi.org/10.5194/tc-20-1363-2026");
    expect(link.textContent).toContain(goel.title);
    // Not a default blue link: it takes the heading's own colour until hovered.
    expect(link.className).not.toMatch(/(^| )text-(blue|sky)-/);
    expect(link.className).toContain("hover:underline");
  });

  it("makes the DOI a link to doi.org", async () => {
    await open([goel]);

    const link = within(card(goel.title)).getByRole("link", { name: /^10\.5194\/tc-20-1363-2026/ });
    expect(link.getAttribute("href")).toBe("https://doi.org/10.5194/tc-20-1363-2026");
    // It looks like a link without being hovered.
    expect(link.className).toContain("underline");
    expect(within(card(goel.title)).getByText(/^DOI:/)).toBeTruthy();
  });

  it("uses the stored source link for the title, and the DOI when there is none", async () => {
    await open([hosted, doiOnly]);

    const hostedTitle = within(card(hosted.title)).getByRole("heading", { level: 2 });
    expect(within(hostedTitle).getByRole("link").getAttribute("href")).toBe(
      "https://www.mdpi.com/2072-4292/13/14/2808",
    );
    expect(
      within(card(hosted.title)).getByRole("link", { name: /^10\.3390\/rs13142808/ }).getAttribute("href"),
    ).toBe("https://doi.org/10.3390/rs13142808");

    const doiTitle = within(card(doiOnly.title)).getByRole("heading", { level: 2 });
    expect(within(doiTitle).getByRole("link").getAttribute("href")).toBe(
      "https://doi.org/10.5194/tc-6-505-2012",
    );
  });

  it("keeps Open Original Source, and opens every paper link safely in a new tab", async () => {
    await open([goel, hosted, doiOnly]);

    const source = within(card(goel.title)).getByRole("link", { name: /^Open Original Source/ });
    expect(source.getAttribute("href")).toBe("https://doi.org/10.5194/tc-20-1363-2026");
    // A record without a stored source link has no such button.
    expect(within(card(doiOnly.title)).queryByRole("link", { name: /^Open Original Source/ })).toBeNull();

    const links = screen.getAllByRole("link");
    // Three for each record with a source link, two for the record without.
    expect(links).toHaveLength(8);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.textContent).toContain("(opens in a new tab)");
    }
  });

  it("invents no link for a record without a usable DOI or source", async () => {
    await open([bare, unsafe]);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    // The details are still shown, as plain text.
    expect(within(card(bare.title)).getByRole("heading", { level: 2 }).textContent).toBe(bare.title);
    expect(within(card(unsafe.title)).getByText("DOI: not a doi")).toBeTruthy();
    expect(within(card(bare.title)).queryByText(/^DOI:/)).toBeNull();
  });
});

describe("publication addresses", () => {
  it("builds a doi.org address only from a real DOI", () => {
    expect(doiUrl("10.5194/tc-20-1363-2026")).toBe("https://doi.org/10.5194/tc-20-1363-2026");
    expect(doiUrl(" 10.5281/zenodo.18457176 ")).toBe("https://doi.org/10.5281/zenodo.18457176");
    for (const value of [null, "", "tc-20-1363-2026", "10.5194", "10.5194/ two words", "doi:10.5194/x"]) {
      expect(doiUrl(value)).toBeNull();
    }
  });

  it("prefers the stored source link and falls back to the DOI", () => {
    expect(publicationUrl(hosted)).toBe("https://www.mdpi.com/2072-4292/13/14/2808");
    expect(publicationUrl(doiOnly)).toBe("https://doi.org/10.5194/tc-6-505-2012");
    // An unsafe source link is passed over, not followed.
    expect(publicationUrl({ source_url: "javascript:alert(1)", doi: "10.5194/tc-6-505-2012" })).toBe(
      "https://doi.org/10.5194/tc-6-505-2012",
    );
    expect(publicationUrl(bare)).toBeNull();
    expect(publicationUrl(unsafe)).toBeNull();
  });
});
