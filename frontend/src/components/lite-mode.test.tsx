import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiteModeProvider, LiteModeToggle } from "@/components/lite-mode";
import {
  LITE_EXPLANATION,
  LITE_STORAGE_KEY,
  LITE_SUGGESTION_KEY,
} from "@/lib/lite-mode";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderSite(initialLite: boolean) {
  return render(
    <LiteModeProvider initialLite={initialLite}>
      <LiteModeToggle />
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
