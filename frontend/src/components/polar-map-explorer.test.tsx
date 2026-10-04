import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiteModeProvider, LiteModeToggle } from "@/components/lite-mode";
import { PolarMapExplorer } from "@/components/polar-map-explorer";
import type { GlobeCameraRequest, GlobePoint } from "@/lib/globe";
import { siteImages } from "@/lib/images";
import { LITE_STORAGE_KEY } from "@/lib/lite-mode";
import type { MapLocation } from "@/lib/types";
import { realLocations, unplaced } from "@/test/map-locations";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

type GlobeProps = {
  points: GlobePoint[];
  selectedId: string | null;
  camera: GlobeCameraRequest;
  onSelect: (id: string) => void;
  onUserMove: () => void;
  onUnavailable: () => void;
};

// The real globe is loaded with next/dynamic and needs WebGL. This stand-in
// shows what the page asks of it: the markers, the selection and the view.
vi.mock("next/dynamic", () => ({
  default: () =>
    function InteractiveGlobe(props: GlobeProps) {
      return (
        <div
          data-camera={JSON.stringify(props.camera.target)}
          data-key={props.camera.key}
          data-selected={props.selectedId ?? ""}
          data-testid="interactive-globe"
        >
          {props.points.map((point) => (
            <button key={point.id} onClick={() => props.onSelect(point.id)} type="button">
              {`marker: ${point.label}`}
            </button>
          ))}
          <button onClick={props.onUserMove} type="button">
            drag the globe
          </button>
          <button onClick={props.onUnavailable} type="button">
            break the globe
          </button>
        </div>
      );
    },
}));

function open(
  options: {
    lite?: boolean;
    locationId?: string | null;
    expeditionId?: string | null;
    locations?: MapLocation[];
  } = {},
) {
  if (options.lite) {
    window.localStorage.setItem(LITE_STORAGE_KEY, "on");
  }
  return render(
    <LiteModeProvider initialLite={options.lite ?? false}>
      <LiteModeToggle />
      <PolarMapExplorer
        initialExpeditionId={options.expeditionId ?? null}
        initialLocationId={options.locationId ?? null}
        locations={options.locations ?? realLocations}
      />
    </LiteModeProvider>,
  );
}

const globe = () => screen.getByTestId("interactive-globe");
const camera = () => JSON.parse(globe().dataset.camera as string);
const markers = () =>
  within(globe())
    .getAllByRole("button", { name: /^marker: / })
    .map((button) => (button.textContent ?? "").replace("marker: ", ""));
const panel = () => screen.getByRole("region", { name: "Selected location" });
const regionButton = (name: string) =>
  within(screen.getByRole("group", { name: "Globe view" })).getByRole("button", { name });
const clickMarker = (label: string) =>
  fireEvent.click(within(globe()).getByRole("button", { name: `marker: ${label}` }));

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "dhruvsetu_lite=; path=/; max-age=0";
});

afterEach(cleanup);

describe("Polar Map globe", () => {
  it("opens on the whole world with every real location marked", () => {
    open();

    expect(camera()).toBe("global");
    expect(markers()).toEqual([
      "Bharati research station, Antarctica",
      "Djupranen Ice Rise other repository location, Antarctica",
      "Himadri research station, Arctic",
      "Kongsfjorden expedition location, Arctic",
      "Maitri research station, Antarctica",
    ]);
    expect(regionButton("Global").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("5 locations, 5 on the globe")).toBeTruthy();

    // Nothing is selected yet: the panel introduces the map with real counts.
    expect(within(panel()).getByRole("heading", { name: "Explore India's Polar Research" })).toBeTruthy();
    expect(within(panel()).getByText("Select a station or research location on the globe.")).toBeTruthy();
    const counts = [...panel().querySelectorAll("dl > div")].map((item) => item.textContent);
    expect(counts).toEqual(["Research stations3", "Locations5", "Expeditions3"]);
    expect(panel().querySelector("img")).toBeNull();
  });

  it("turns to Antarctica, the Arctic and back without reloading", () => {
    open();

    fireEvent.click(regionButton("Antarctica"));
    expect(camera()).toBe("antarctic");
    expect(regionButton("Antarctica").getAttribute("aria-pressed")).toBe("true");
    expect(regionButton("Global").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(regionButton("Arctic"));
    expect(camera()).toBe("arctic");
    expect(regionButton("Arctic").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(regionButton("Global"));
    expect(camera()).toBe("global");
    // The same button asks again, for example after the globe was dragged away.
    const before = globe().dataset.key;
    fireEvent.click(regionButton("Global"));
    expect(globe().dataset.key).not.toBe(before);
    // Every marker stays: the buttons move the view and filter nothing.
    expect(markers()).toHaveLength(5);
  });

  it("no longer names a region once the globe is moved by hand", () => {
    open();
    fireEvent.click(regionButton("Arctic"));

    fireEvent.click(within(globe()).getByRole("button", { name: "drag the globe" }));

    for (const name of ["Global", "Antarctica", "Arctic"]) {
      expect(regionButton(name).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("shows a compact legend, the notice and the map data credits", () => {
    open();

    const legend = screen.getByRole("list", { name: "Marker types" });
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Research station",
      "Expedition location",
      "Other repository location",
    ]);
    // Each type has its own drawn shape beside its name.
    expect(new Set([...legend.querySelectorAll("svg")].map((icon) => icon.innerHTML)).size).toBe(3);
    expect(
      screen.getByText(
        "Map is for repository exploration. Coordinates are source-backed; do not use this view for scientific measurement.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" }).getAttribute("href")).toBe(
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByRole("link", { name: "OpenFreeMap" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "© OpenMapTiles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "MapLibre" })).toBeTruthy();
  });
});

describe("selected location", () => {
  it("shows Maitri with its facts, source, photograph and related records", () => {
    open();

    clickMarker("Maitri research station, Antarctica");

    expect(globe().dataset.selected).toBe("maitri");
    // A marker opens the details and leaves the view where it is.
    expect(camera()).toBe("global");
    const details = within(panel());
    expect(details.getByRole("heading", { level: 2, name: "Maitri Station" })).toBeTruthy();
    expect(details.getAllByText("Research station").length).toBeGreaterThan(0);
    expect(details.getByText("Antarctica")).toBeTruthy();
    expect(details.getByText("70.7644° S, 11.7342° E")).toBeTruthy();
    expect(details.getByText(/on the ice-free Schirmacher Oasis/)).toBeTruthy();
    expect(details.getByText("Uploaded")).toBeTruthy();
    expect(details.getByRole("link", { name: /Open Original Source/ }).getAttribute("href")).toBe(
      "https://ncpor.res.in/antarcticas/display/376-maitri-",
    );
    expect(details.getByRole("img").getAttribute("src")).toBe(siteImages.maitriStation.src);
    expect(details.getByText(/Photo: Prakash khatarkar, CC BY-SA 4.0/)).toBeTruthy();
    expect(
      details.getByRole("link", { name: "41st Indian Scientific Expedition to Antarctica" }).getAttribute("href"),
    ).toBe("/expeditions/isea-41");
    expect(
      details
        .getByRole("link", { name: "India launches the 41st Scientific Expedition to Antarctica" })
        .getAttribute("href"),
    ).toBe("/documents/pib-41");
  });

  it("shows Bharati without a photograph, and says why", () => {
    open();

    clickMarker("Bharati research station, Antarctica");

    const details = within(panel());
    expect(details.getByRole("heading", { level: 2, name: "Bharati Station" })).toBeTruthy();
    expect(details.getByText("69.4068° S, 76.1953° E")).toBeTruthy();
    expect(details.getByRole("link", { name: /Open Original Source/ }).getAttribute("href")).toBe(
      "https://ncpor.res.in/antarcticas/display/377-bharati",
    );
    // No licensed photograph of Bharati exists. Nothing stands in for it.
    expect(details.queryByRole("img")).toBeNull();
    expect(details.getByText(/holds no licensed photograph of\s+this station/)).toBeTruthy();
  });

  it("shows Himadri with the Ny-Ålesund photograph, captioned as what it is", () => {
    open();

    clickMarker("Himadri research station, Arctic");

    const details = within(panel());
    expect(details.getByRole("heading", { level: 2, name: "Himadri Station" })).toBeTruthy();
    expect(details.getByText("78.9167° N, 11.9333° E")).toBeTruthy();
    expect(details.getByRole("link", { name: /Open Original Source/ }).getAttribute("href")).toBe(
      "https://ncpor.res.in/app/webroot/pages/view/340-himadri-station",
    );
    expect(details.getByRole("img").getAttribute("src")).toBe(siteImages.nyAlesund.src);
    expect(details.getByText(/Ny-Ålesund, where Himadri is located\./)).toBeTruthy();
    expect(details.queryByText(/Himadri station photo/i)).toBeNull();
    expect(details.getAllByRole("link", { name: /Indian Arctic Expedition/ })).toHaveLength(2);

    // The Kongsfjorden marker sits under this one. The panel offers it.
    fireEvent.click(details.getByRole("button", { name: "Kongsfjorden (IndARC mooring site)" }));
    expect(globe().dataset.selected).toBe("kongsfjorden");
    expect(camera()).toEqual({ locationId: "kongsfjorden" });
    expect(within(panel()).getByRole("img").getAttribute("src")).toBe(siteImages.kongsfjordenShore.src);
  });

  it("changes with the marker, and closes back to the introduction", () => {
    open();

    clickMarker("Maitri research station, Antarctica");
    clickMarker("Bharati research station, Antarctica");
    expect(within(panel()).getByRole("heading", { level: 2, name: "Bharati Station" })).toBeTruthy();
    expect(within(panel()).queryByText("Maitri Station")).toBeNull();

    fireEvent.click(within(panel()).getByRole("button", { name: /^Close/ }));
    expect(globe().dataset.selected).toBe("");
    expect(within(panel()).getByRole("heading", { name: "Explore India's Polar Research" })).toBeTruthy();
  });

  it("turns the globe to a location chosen from the lists", () => {
    open();

    fireEvent.click(within(panel()).getByRole("button", { name: "Himadri" }));
    expect(camera()).toEqual({ locationId: "himadri" });
    expect(globe().dataset.selected).toBe("himadri");
    // A view of one location is not one of the three regions.
    expect(regionButton("Arctic").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /^Show details\s*for Maitri Station$/ }));
    expect(camera()).toEqual({ locationId: "maitri" });
    expect(within(panel()).getByRole("heading", { level: 2, name: "Maitri Station" })).toBeTruthy();
  });
});

describe("links and search", () => {
  it("opens on the location named in the link", () => {
    open({ locationId: "maitri" });

    expect(camera()).toEqual({ locationId: "maitri" });
    expect(globe().dataset.selected).toBe("maitri");
    expect(within(panel()).getByRole("heading", { level: 2, name: "Maitri Station" })).toBeTruthy();

    cleanup();
    open({ locationId: "himadri" });
    expect(camera()).toEqual({ locationId: "himadri" });
    expect(within(panel()).getByRole("heading", { level: 2, name: "Himadri Station" })).toBeTruthy();
  });

  it("ignores a location that does not exist", () => {
    open({ locationId: "no-such-location" });

    expect(camera()).toBe("global");
    expect(globe().dataset.selected).toBe("");
  });

  it("opens on the locations of the expedition named in the link", () => {
    open({ expeditionId: "arctic-15" });

    // Both of its locations are in the Arctic, so the globe turns there.
    expect(camera()).toBe("arctic");
    expect(markers()).toEqual([
      "Himadri research station, Arctic",
      "Kongsfjorden expedition location, Arctic",
    ]);
    expect((screen.getByLabelText("Expedition") as HTMLSelectElement).value).toBe("arctic-15");
    expect(screen.getByText("2 locations match, 2 on the globe")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(camera()).toBe("global");
    expect(markers()).toHaveLength(5);
  });

  it("finds a station by name, selects it and turns to it", () => {
    open();
    const search = screen.getByLabelText("Find a station or location");

    fireEvent.change(search, { target: { value: "Maitri" } });
    expect(markers()).toEqual(["Maitri research station, Antarctica"]);
    expect(camera()).toEqual({ locationId: "maitri" });
    expect(within(panel()).getByRole("heading", { level: 2, name: "Maitri Station" })).toBeTruthy();

    fireEvent.change(search, { target: { value: "Himadri" } });
    expect(camera()).toEqual({ locationId: "himadri" });
    expect(within(panel()).getByText("Arctic")).toBeTruthy();

    // A search that matches a whole region turns to that region.
    fireEvent.change(search, { target: { value: "arctic" } });
    expect(camera()).toBe("arctic");
    expect(markers()).toHaveLength(2);

    fireEvent.change(search, { target: { value: "nowhere" } });
    expect(screen.getByText("No locations match these filters.")).toBeTruthy();
    expect(camera()).toBe("global");
  });

  it("filters by type", () => {
    open();

    fireEvent.click(screen.getByRole("button", { name: "Stations" }));

    expect(markers()).toEqual([
      "Bharati research station, Antarctica",
      "Himadri research station, Arctic",
      "Maitri research station, Antarctica",
    ]);
    expect(screen.getByText("3 locations match, 3 on the globe")).toBeTruthy();
  });
});

describe("when the globe cannot be shown", () => {
  it("says so, keeps the list, and offers another try", () => {
    open();

    fireEvent.click(within(globe()).getByRole("button", { name: "break the globe" }));

    expect(screen.queryByTestId("interactive-globe")).toBeNull();
    expect(screen.getByRole("heading", { name: "Interactive map could not be loaded." })).toBeTruthy();
    // Every location is still there as text, with its source.
    const card = screen.getByRole("heading", { name: "Himadri Station" }).closest("li") as HTMLElement;
    expect(within(card).getByText("78.9167° N, 11.9333° E")).toBeTruthy();
    expect(within(card).getByRole("link", { name: /Open Original Source/ })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: /Show details/ }));
    expect(within(panel()).getByRole("heading", { level: 2, name: "Himadri Station" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByTestId("interactive-globe")).toBeTruthy();
  });

  it("lists a location without coordinates but puts no marker on the globe", () => {
    open({ locations: [...realLocations, unplaced] });

    expect(markers()).toHaveLength(5);
    expect(screen.getByText("6 locations, 5 on the globe")).toBeTruthy();
    const card = screen
      .getByRole("heading", { name: "Field area without coordinates" })
      .closest("li") as HTMLElement;
    expect(within(card).getByText("Not stored (not on the globe)")).toBeTruthy();
  });
});

describe("Polar Map in Lite Mode", () => {
  const liteSwitch = () => screen.getByRole("switch", { name: "Lite Mode" });

  it("does not load the globe, and lists the real locations as text", () => {
    open({ lite: true });

    expect(screen.queryByTestId("interactive-globe")).toBeNull();
    expect(screen.getByRole("heading", { name: "Interactive globe is paused in Lite Mode." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load Interactive Globe" })).toBeTruthy();
    expect(within(panel()).getByText("Select a station or research location in the list below.")).toBeTruthy();

    for (const name of [
      "Maitri Station",
      "Bharati Station",
      "Himadri Station",
      "Kongsfjorden (IndARC mooring site)",
      "Djupranen Ice Rise",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeTruthy();
    }
    const card = screen.getByRole("heading", { name: "Maitri Station" }).closest("li") as HTMLElement;
    expect(within(card).getByText("Research station")).toBeTruthy();
    expect(within(card).getByText("Antarctica")).toBeTruthy();
    expect(within(card).getByText("70.7644° S, 11.7342° E")).toBeTruthy();
    expect(within(card).getByText("Uploaded")).toBeTruthy();
    expect(within(card).getByRole("link", { name: /Open Original Source/ }).getAttribute("href")).toBe(
      "https://ncpor.res.in/antarcticas/display/376-maitri-",
    );
    expect(within(card).getByText("1 related expedition")).toBeTruthy();
  });

  it("opens the details without the globe and without a photograph", () => {
    open({ lite: true });

    fireEvent.click(screen.getByRole("button", { name: /^Show details\s*for Maitri Station$/ }));

    const details = within(panel());
    expect(details.getByRole("heading", { level: 2, name: "Maitri Station" })).toBeTruthy();
    expect(details.getByRole("link", { name: "41st Indian Scientific Expedition to Antarctica" })).toBeTruthy();
    // Lite Mode requests no photograph, and does not apologise for one either.
    expect(details.queryByRole("img")).toBeNull();
    expect(details.queryByText(/No photograph is shown/)).toBeNull();
  });

  it("loads the globe for this page only, and Lite Mode stays on", () => {
    open({ lite: true });

    fireEvent.click(screen.getByRole("button", { name: "Load Interactive Globe" }));

    expect(screen.getByTestId("interactive-globe")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Interactive Globe" })).toBeNull();
    expect(liteSwitch().getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(LITE_STORAGE_KEY)).toBe("on");
    expect(document.cookie).not.toContain("dhruvsetu_lite=0");
    expect(
      screen.getByText("Lite Mode is still on. The globe was loaded for this page only."),
    ).toBeTruthy();
    // Photographs stay off even with the globe loaded.
    clickMarker("Maitri research station, Antarctica");
    expect(within(panel()).queryByRole("img")).toBeNull();

    // Opening the page again starts paused again.
    cleanup();
    open({ lite: true });
    expect(screen.queryByTestId("interactive-globe")).toBeNull();
    expect(screen.getByRole("button", { name: "Load Interactive Globe" })).toBeTruthy();
  });

  it("removes the globe when Lite Mode is turned on, and brings it back when off", () => {
    open();
    expect(screen.getByTestId("interactive-globe")).toBeTruthy();

    fireEvent.click(liteSwitch());
    expect(screen.queryByTestId("interactive-globe")).toBeNull();

    fireEvent.click(liteSwitch());
    expect(screen.getByTestId("interactive-globe")).toBeTruthy();
  });
});
