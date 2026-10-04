import fs from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthLayout } from "@/components/auth-layout";
import {
  expeditionBanner,
  expeditionCardImages,
  photoCredit,
  siteImages,
} from "@/lib/images";
import type { Expedition } from "@/lib/types";

const lite = vi.fn<() => Promise<boolean>>();
const getApi = vi.fn();

vi.mock("@/lib/lite-mode-server", () => ({ isLiteMode: () => lite() }));
vi.mock("@/lib/api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));

// The page header is tested by itself below. It reads a cookie on the server,
// so the pages that contain it are rendered without it.
vi.mock("@/components/page-hero", () => ({ PageHero: () => null }));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Shows which file a page asks for, without the image optimiser.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const PUBLIC = path.resolve(import.meta.dirname, "../../public");
const IMAGES = path.join(PUBLIC, "images");
const attributions = fs.readFileSync(path.join(IMAGES, "ATTRIBUTIONS.md"), "utf8");
const images = Object.values(siteImages);

function storedImages(folder = IMAGES): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return storedImages(full);
    return /\.(jpe?g|png|webp|avif)$/i.test(entry.name)
      ? [`/images/${path.relative(IMAGES, full).split(path.sep).join("/")}`]
      : [];
  });
}

function shownImages(): string[] {
  return screen.queryAllByRole("img").map((image) => image.getAttribute("src") ?? "");
}

const expedition = (name: string): Expedition => ({
  id: name,
  name,
  expedition_number: null,
  summary: null,
  start_date: null,
  end_date: null,
  source_url: null,
  verification_status: "uploaded",
  is_demo_data: false,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("site images", () => {
  it("are all stored in this project, and each file is a real JPEG", () => {
    for (const image of images) {
      expect(image.src.startsWith("/images/")).toBe(true);
      const file = fs.readFileSync(path.join(PUBLIC, image.src));
      // A page saved by mistake instead of the image would not start like this.
      expect([...file.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      expect(file.length).toBeGreaterThan(20_000);
      expect(file.length).toBeLessThan(1_000_000);
    }
  });

  it("have a licence, a credit, a source page and plain alt text", () => {
    for (const image of images) {
      expect(image.credit.length).toBeGreaterThan(3);
      expect(image.licence).toMatch(/^(CC BY|Public domain|Government Open Data)/);
      expect(image.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:")).toBe(true);
      expect(image.alt.length).toBeGreaterThan(30);
      expect(image.alt).not.toMatch(/amazing|beautiful|stunning|image of|photo of/i);
      expect(photoCredit(image)).toBe(`Photo: ${image.credit}, ${image.licence}`);
    }
    expect(new Set(images.map((image) => image.src)).size).toBe(images.length);
  });

  it("match the attribution file, with no unlisted file in the folder", () => {
    const listed = images.map((image) => image.src).sort();

    expect(storedImages().sort()).toEqual(listed);
    for (const image of images) {
      expect(attributions).toContain(`\`${image.src.replace("/images/", "")}\``);
      expect(attributions).toContain(image.credit.split(",")[0]);
      expect(attributions).toContain(image.licence.split(" (")[0].replace(" - India", ""));
      // The attribution file may write the address with percent signs.
      expect([image.sourceUrl, encodeURI(image.sourceUrl)].some((url) => attributions.includes(url))).toBe(
        true,
      );
    }
  });

  it("show the region of an expedition and never guess", () => {
    expect(expeditionBanner("15th Indian Arctic Expedition (2024-25)")).toBe(
      siteImages.nyAlesund,
    );
    expect(expeditionBanner("41st Indian Scientific Expedition to Antarctica")).toBe(
      siteImages.maitriStation,
    );
    // "Antarctic" contains "arctic": it must not get the Arctic photograph.
    expect(expeditionBanner("Antarctic survey")).toBe(siteImages.maitriStation);
    expect(expeditionBanner("Himalayan glacier survey")).toBeNull();
  });

  it("give neighbouring expedition cards different photographs", () => {
    expect(
      expeditionCardImages([
        "14th Indian Arctic Expedition (2023-24)",
        "15th Indian Arctic Expedition (2024-25)",
        "41st Indian Scientific Expedition to Antarctica",
        "Himalayan glacier survey",
        "43rd Indian Scientific Expedition to Antarctica",
      ]),
    ).toEqual([
      siteImages.nyAlesund,
      siteImages.kongsfjordenShore,
      siteImages.maitriAerial,
      null,
      siteImages.maitriStation,
    ]);
  });
});

describe("images in Lite Mode", () => {
  it("leaves the photograph out of the sign-in panel", () => {
    render(
      <AuthLayout lite subtitle="Sign in to continue to DhruvSetu." title="Welcome back">
        <p>Form</p>
      </AuthLayout>,
    );

    expect(shownImages()).toEqual([]);
    expect(screen.getByText("Browsing DhruvSetu needs no account.")).toBeTruthy();
    expect(screen.queryByText(/^Photo:/)).toBeNull();
  });

  it("shows the sign-in panel photograph in normal mode, with its credit", () => {
    render(
      <AuthLayout subtitle="Sign in to continue to DhruvSetu." title="Welcome back">
        <p>Form</p>
      </AuthLayout>,
    );

    expect(shownImages()).toEqual([siteImages.authPanel.src]);
    expect(siteImages.authPanel.src).not.toBe(siteImages.homeHero.src);
    expect(screen.getByText("Photo: NASA / Christy Hansen, Public domain")).toBeTruthy();
  });

  it("requests no image on the home page, and keeps the text", async () => {
    const { default: Home } = await import("@/app/page");
    getApi.mockResolvedValue({ data: [], status: 200, detail: null });

    lite.mockResolvedValue(true);
    render(await Home());
    expect(shownImages()).toEqual([]);
    expect(screen.getByRole("heading", { level: 1, name: "DhruvSetu" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "India in the Polar Regions" })).toBeTruthy();
    cleanup();

    lite.mockResolvedValue(false);
    render(await Home());
    expect(shownImages()).toEqual([siteImages.homeHero.src, siteImages.maitriStation.src]);
  });

  it("leaves the photograph out of a page header", async () => {
    const { PageHero } = await vi.importActual<typeof import("@/components/page-hero")>(
      "@/components/page-hero",
    );
    const hero = {
      eyebrow: "Explore",
      title: "Expeditions",
      description: "Polar expeditions.",
      image: siteImages.schirmacherHills.src,
      imageAlt: siteImages.schirmacherHills.alt,
    };

    lite.mockResolvedValue(true);
    render(await PageHero(hero));
    expect(shownImages()).toEqual([]);
    expect(screen.getByRole("heading", { level: 1, name: "Expeditions" })).toBeTruthy();
    cleanup();

    lite.mockResolvedValue(false);
    render(await PageHero(hero));
    expect(shownImages()).toEqual([siteImages.schirmacherHills.src]);
  });

  it("requests no image for the expedition cards, and keeps the records", async () => {
    const { default: ExpeditionsPage } = await import("@/app/expeditions/page");
    getApi.mockResolvedValue({
      data: [
        expedition("15th Indian Arctic Expedition (2024-25)"),
        expedition("43rd Indian Scientific Expedition to Antarctica"),
      ],
      status: 200,
      detail: null,
    });

    lite.mockResolvedValue(true);
    render(await ExpeditionsPage());
    expect(shownImages()).toEqual([]);
    expect(screen.getByText("15th Indian Arctic Expedition (2024-25)")).toBeTruthy();
    cleanup();

    lite.mockResolvedValue(false);
    render(await ExpeditionsPage());
    expect(shownImages()).toEqual([siteImages.nyAlesund.src, siteImages.maitriAerial.src]);
  });
});
