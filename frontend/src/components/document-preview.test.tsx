import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentDetailPage from "@/app/documents/[id]/page";
import { DocumentPreview } from "@/components/document-preview";
import type { DocumentDetail, DocumentFileInfo } from "@/lib/types";

const getApi = vi.fn();
const getApiText = vi.fn();
const lite = vi.fn<() => Promise<boolean>>();

vi.mock("@/lib/api", () => ({
  getApi: (...args: unknown[]) => getApi(...args),
  getApiText: (...args: unknown[]) => getApiText(...args),
}));
vi.mock("@/lib/lite-mode-server", () => ({ isLiteMode: () => lite() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const TEXT = "Press Information Bureau\n\nFirst paragraph.\n  Indented line.\n<script>window.ran = true</script>\n<b>not bold</b>\n";

function stored(values: Partial<DocumentFileInfo> = {}): DocumentFileInfo {
  return {
    file_name: "release.txt",
    file_type: "txt",
    size_bytes: 2966,
    available: true,
    previewable: true,
    preview_message: null,
    ...values,
  };
}

const pdfFile = stored({ file_name: "paper.pdf", file_type: "pdf", size_bytes: 4301843 });
const missing = stored({
  size_bytes: null,
  available: false,
  previewable: false,
  preview_message: "The stored file for this document is currently unavailable.",
});

function show(file: DocumentFileInfo | null, text: string | null = null, isLite = false) {
  return render(
    <DocumentPreview documentId="doc-1" file={file} lite={isLite} text={text} title="Test release" />,
  );
}

const section = () => screen.getByRole("region", { name: "Document preview" });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as unknown as { ran?: boolean }).ran;
});

describe("text preview", () => {
  it("shows the real text of the file, with its line breaks", () => {
    show(stored(), TEXT);

    const preview = within(section()).getByRole("region", { name: "Text of Test release" });
    expect(preview.tagName).toBe("PRE");
    expect(preview.textContent).toBe(TEXT);
    // Line breaks and spacing are kept, and long lines wrap inside the box.
    expect(preview.className).toContain("whitespace-pre-wrap");
    expect(preview.className).toContain("break-words");
    // A long document scrolls inside the box, which the keyboard can reach.
    expect(preview.className).toContain("overflow-auto");
    expect(preview.className).toMatch(/max-h-/);
    expect(preview.getAttribute("tabindex")).toBe("0");
  });

  it("never runs or renders markup that is inside the file", () => {
    show(stored(), TEXT);

    expect((window as unknown as { ran?: boolean }).ran).toBeUndefined();
    expect(section().querySelector("script")).toBeNull();
    expect(section().querySelector("b")).toBeNull();
    expect(within(section()).getByText(/<b>not bold<\/b>/)).toBeTruthy();
  });

  it("says so when the text could not be read, or is too long to show", () => {
    show(stored(), null);
    expect(within(section()).getByText(/The preview could not be loaded right now/)).toBeTruthy();
    expect(within(section()).getByRole("link", { name: /^Open File/ })).toBeTruthy();
    cleanup();

    show(
      stored({
        previewable: false,
        preview_message: "This text file is too large to preview here. Open or download it instead.",
      }),
    );
    expect(within(section()).getByText(/too large to preview here/)).toBeTruthy();
    expect(section().querySelector("pre")).toBeNull();
    expect(within(section()).getByRole("link", { name: /^Download/ })).toBeTruthy();
  });
});

describe("PDF preview", () => {
  it("embeds the stored PDF by its document address, with a title", () => {
    show(pdfFile);

    const viewer = within(section()).getByTitle("PDF preview of Test release");
    expect(viewer.tagName).toBe("IFRAME");
    expect(viewer.getAttribute("src")).toBe("/api/documents/doc-1/file");
    // Full width of its column, so it cannot push the page sideways.
    expect(viewer.className).toContain("w-full");
    expect(within(section()).getByText(/If the PDF does not appear here, use Open File/)).toBeTruthy();
  });

  it("offers Open File in a new tab and Download", () => {
    show(pdfFile);

    const open = within(section()).getByRole("link", { name: /^Open File/ });
    expect(open.getAttribute("href")).toBe("/api/documents/doc-1/file");
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer");
    expect(open.textContent).toContain("(opens in a new tab)");
    const download = within(section()).getByRole("link", { name: /^Download/ });
    expect(download.getAttribute("href")).toBe("/api/documents/doc-1/download");
    expect(within(section()).getByText(/4\.1 MB/)).toBeTruthy();
  });

  it("does not load the PDF into the page in Lite Mode", () => {
    show(pdfFile, null, true);

    expect(section().querySelector("iframe")).toBeNull();
    expect(within(section()).getByText(/not loaded into the page in Lite Mode/)).toBeTruthy();
    expect(within(section()).getByRole("link", { name: /^Open File/ })).toBeTruthy();
  });
});

describe("when there is nothing to preview", () => {
  it("shows a clear message for a missing file, and no broken viewer or links", () => {
    show(missing);

    expect(
      within(section()).getByText("The stored file for this document is currently unavailable."),
    ).toBeTruthy();
    expect(section().querySelector("iframe, pre")).toBeNull();
    expect(within(section()).queryAllByRole("link")).toHaveLength(0);
  });

  it("explains a record that holds no local copy, which is not an error", () => {
    show(null);

    expect(
      within(section()).getByText(
        /stores metadata and source information for this record, but\s+does not hold a local copy of the document/,
      ),
    ).toBeTruthy();
    expect(within(section()).queryAllByRole("link")).toHaveLength(0);
  });

  it("says when a file type is not previewed", () => {
    show(
      stored({
        file_name: "notes.docx",
        file_type: "docx",
        size_bytes: null,
        available: false,
        previewable: false,
        preview_message: "Preview is not available for this file type.",
      }),
    );
    expect(within(section()).getByText("Preview is not available for this file type.")).toBeTruthy();
    cleanup();

    // A stored file of a type the page does not know how to show.
    show(stored({ file_name: "data.csv", file_type: "csv" }));
    expect(within(section()).getByText("Preview is not available for this file type.")).toBeTruthy();
    expect(section().querySelector("iframe, pre")).toBeNull();
    expect(within(section()).getByRole("link", { name: /^Open File/ })).toBeTruthy();
  });
});

describe("document page", () => {
  const detail = (file: DocumentFileInfo | null, fileType = "txt"): DocumentDetail => ({
    id: "doc-1",
    title: "Test release",
    file_type: fileType,
    file_name: file?.file_name ?? "release.txt",
    source_type: "press_release",
    source_url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1771934",
    publication_date: "2021-11-15",
    verification_status: "reviewed",
    is_demo_data: false,
    related_resources: [
      { id: "exp-1", type: "expedition", title: "41st Indian Scientific Expedition", href: "/expeditions/exp-1" },
    ],
    chunk_count: 3,
    created_at: "2026-10-04T10:00:00",
    first_page: null,
    last_page: null,
    submitted_by: null,
    file,
  });

  async function open(document: DocumentDetail, isLite = false) {
    getApi.mockResolvedValue({ data: document, status: 200, detail: null });
    lite.mockResolvedValue(isLite);
    render(await DocumentDetailPage({ params: Promise.resolve({ id: document.id }) }));
  }

  it("reads the text from the stored file and shows it between source and related records", async () => {
    getApiText.mockResolvedValue(TEXT);
    await open(detail(stored()));

    // The file itself is read, by the document's ID. Search chunks are not used.
    expect(getApiText).toHaveBeenCalledWith("/api/documents/doc-1/file");
    expect(screen.getByRole("region", { name: "Text of Test release" }).textContent).toBe(TEXT);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((item) => item.textContent);
    expect(headings.slice(0, 4)).toEqual([
      "Source information",
      "Original source",
      "Document preview",
      "Related records",
    ]);
  });

  it("keeps the original source, the verification status and the related records", async () => {
    getApiText.mockResolvedValue(TEXT);
    await open(detail(stored()));

    // The original source is still the outside address, not the stored file.
    const source = screen.getByRole("link", { name: /^Open Original Source/ });
    expect(source.getAttribute("href")).toBe("https://www.pib.gov.in/PressReleasePage.aspx?PRID=1771934");
    expect(screen.getByRole("link", { name: /^Open File/ }).getAttribute("href")).toBe(
      "/api/documents/doc-1/file",
    );
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "41st Indian Scientific Expedition" }).getAttribute("href"),
    ).toBe("/expeditions/exp-1");
  });

  it("does not read a PDF as text, and embeds it instead", async () => {
    await open(detail(pdfFile, "pdf"));

    expect(getApiText).not.toHaveBeenCalled();
    expect(screen.getByTitle("PDF preview of Test release").getAttribute("src")).toBe(
      "/api/documents/doc-1/file",
    );
  });

  it("still shows the whole record when the stored file is missing", async () => {
    await open(detail(missing));

    expect(getApiText).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Test release" })).toBeTruthy();
    expect(screen.getByText("The stored file for this document is currently unavailable.")).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: /^Open Original Source/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "41st Indian Scientific Expedition" })).toBeTruthy();
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
  });

  it("works with an API that does not describe the file yet", async () => {
    const old = detail(stored()) as Partial<DocumentDetail>;
    delete old.file;
    await open(old as DocumentDetail);

    expect(screen.getByText(/does not hold a local copy of the document/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Open Original Source/ })).toBeTruthy();
  });
});
