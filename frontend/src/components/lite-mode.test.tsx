import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiteModeProvider, LiteModeToggle } from "@/components/lite-mode";
import { PolarMapExplorer } from "@/components/polar-map-explorer";
import {
  LITE_EXPLANATION,
  LITE_STORAGE_KEY,
  LITE_SUGGESTION_KEY,
} from "@/lib/lite-mode";
import type { MapLocation } from "@/lib/types";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// The real map is loaded with next/dynamic. This stand-in shows whether the
// page tried to mount it, without loading Leaflet.
vi.mock("next/dynamic", () => ({
  default: () =>
    function InteractiveMap() {
      return <div data-testid="interactive-map" />;
    },
}));

const locations: MapLocation[] = [
  {
    id: "station-location",
    name: "Bharati Station",
    region: "Antarctica",
    description: null,
    latitude: -69.406833,
    longitude: 76.195333,
    mappable: true,
    location_type: "station",
    polar_region: "antarctic",
    is_demo_data: false,
    stations: [
      {
        id: "station",
        name: "Bharati",
        description: null,
        source_url: "https://ncpor.res.in/antarcticas/display/377-bharati",
        verification_status: "uploaded",
        is_demo_data: false,
      },
    ],
    expeditions: [],
    expedition_count: 0,
    research_topics: [],
    datasets: [],
    documents: [],
  },
  {
    id: "demo-location",
    name: "Demo Southern Ocean Area",
    region: "Prototype ocean region",
    description: null,
    latitude: null,
    longitude: null,
    mappable: false,
    location_type: "expedition_location",
    polar_region: null,
    is_demo_data: true,
    stations: [],
    expeditions: [
      {
        id: "expedition",
        name: "Demo Sea Ice Observation Expedition",
        expedition_number: "DEMO-EXP-002",
        verification_status: "uploaded",
        is_demo_data: true,
      },
    ],
    expedition_count: 1,
    research_topics: [],
    datasets: [],
    documents: [],
  },
];

function renderSite(initialLite: boolean, page: React.ReactNode = null) {
  return render(
    <LiteModeProvider initialLite={initialLite}>
      <LiteModeToggle />
      {page}
    </LiteModeProvider>,
  );
}

function liteSwitch(): HTMLElement {
  return screen.getByRole("switch", { name: "Lite Mode" });
}

function setConnection(connection: object | undefined) {
  Object.defineProperty(window.navigator, "connection", {
    configurable: true,
    value: connection,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "dhruvsetu_lite=; path=/; max-age=0";
  setConnection(undefined);
  refresh.mockClear();
});

afterEach(cleanup);

describe("Lite Mode switch", () => {
  it("starts off, turns on, and saves the choice", () => {
    renderSite(false);

    expect(liteSwitch().getAttribute("aria-checked")).toBe("false");
    expect(liteSwitch().textContent).toContain("Off");

    fireEvent.click(liteSwitch());

    expect(liteSwitch().getAttribute("aria-checked")).toBe("true");
    expect(liteSwitch().textContent).toContain("On");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBe("on");
    expect(document.cookie).toContain("dhruvsetu_lite=1");
    // The server parts of the page are asked for again in the new mode.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("turns off again and saves that too", () => {
    window.localStorage.setItem(LITE_STORAGE_KEY, "on");
    renderSite(true);

    fireEvent.click(liteSwitch());

    expect(liteSwitch().getAttribute("aria-checked")).toBe("false");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBe("off");
    expect(document.cookie).toContain("dhruvsetu_lite=0");
  });

  it("uses the saved choice after a reload, even if the cookie was lost", () => {
    window.localStorage.setItem(LITE_STORAGE_KEY, "on");

    renderSite(false);

    expect(liteSwitch().getAttribute("aria-checked")).toBe("true");
    expect(document.cookie).toContain("dhruvsetu_lite=1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("explains itself to assistive technology and on first use only", () => {
    renderSite(false);
    const description = document.getElementById(
      liteSwitch().getAttribute("aria-describedby") ?? "",
    );
    expect(description?.textContent).toBe(LITE_EXPLANATION);

    fireEvent.click(liteSwitch());
    expect(screen.getByText("Lite Mode is on")).toBeTruthy();

    fireEvent.click(liteSwitch());
    fireEvent.click(liteSwitch());
    expect(screen.queryByText("Lite Mode is on")).toBeNull();
  });
});

describe("slow connection suggestion", () => {
  it("suggests Lite Mode but never turns it on by itself", async () => {
    setConnection({ saveData: true });

    renderSite(false);

    expect(await screen.findByText("Slow connection detected. Turn on Lite Mode?")).toBeTruthy();
    expect(liteSwitch().getAttribute("aria-checked")).toBe("false");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Slow connection detected. Turn on Lite Mode?")).toBeNull();
    expect(window.localStorage.getItem(LITE_SUGGESTION_KEY)).toBe("yes");
    expect(liteSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("turns Lite Mode on when the user accepts", async () => {
    setConnection({ effectiveType: "2g" });
    renderSite(false);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    expect(liteSwitch().getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBe("on");
  });

  it("stays quiet on a normal connection or after a choice was made", async () => {
    setConnection({ saveData: false, effectiveType: "4g" });
    renderSite(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Slow connection detected. Turn on Lite Mode?")).toBeNull();
    cleanup();

    setConnection({ saveData: true });
    window.localStorage.setItem(LITE_STORAGE_KEY, "off");
    renderSite(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Slow connection detected. Turn on Lite Mode?")).toBeNull();
  });
});

describe("Polar Map in Lite Mode", () => {
  const explorer = (
    <PolarMapExplorer initialExpeditionId={null} initialLocationId={null} locations={locations} />
  );

  it("mounts the interactive map straight away in normal mode", () => {
    renderSite(false, explorer);

    expect(screen.getByTestId("interactive-map")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Interactive Map" })).toBeNull();
  });

  it("does not mount the map in Lite Mode and shows the locations as text", () => {
    window.localStorage.setItem(LITE_STORAGE_KEY, "on");
    renderSite(true, explorer);

    expect(screen.queryByTestId("interactive-map")).toBeNull();
    expect(screen.getByRole("heading", { name: "Polar locations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load Interactive Map" })).toBeTruthy();

    // The text list carries the same information as the map.
    const station = screen
      .getByRole("heading", { name: "Bharati Station" })
      .closest("li") as HTMLElement;
    expect(within(station).getByText("69.4068° S, 76.1953° E")).toBeTruthy();
    expect(within(station).getByText("Antarctica")).toBeTruthy();
    expect(within(station).getByText("Uploaded")).toBeTruthy();
    expect(within(station).getByText("0 related expeditions")).toBeTruthy();

    const demo = screen
      .getByRole("heading", { name: "Demo Southern Ocean Area" })
      .closest("li") as HTMLElement;
    expect(within(demo).getByText("Not stored (not on the map)")).toBeTruthy();
    expect(within(demo).getByText("1 related expedition")).toBeTruthy();
  });

  it("loads the map on request while Lite Mode stays on", () => {
    window.localStorage.setItem(LITE_STORAGE_KEY, "on");
    renderSite(true, explorer);

    fireEvent.click(screen.getByRole("button", { name: "Load Interactive Map" }));

    expect(screen.getByTestId("interactive-map")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Interactive Map" })).toBeNull();
    expect(liteSwitch().getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBe("on");
    expect(document.cookie).not.toContain("dhruvsetu_lite=0");
    expect(screen.getByText("Lite Mode is still on. The map was loaded for this page only.")).toBeTruthy();
  });

  it("removes the map when Lite Mode is turned on, and brings it back when off", () => {
    renderSite(false, explorer);
    expect(screen.getByTestId("interactive-map")).toBeTruthy();

    fireEvent.click(liteSwitch());
    expect(screen.queryByTestId("interactive-map")).toBeNull();

    fireEvent.click(liteSwitch());
    expect(screen.getByTestId("interactive-map")).toBeTruthy();
  });
});
