// Lite Mode is a preference of this browser. It is kept in localStorage and
// copied into a small cookie so the server can leave out images and maps
// before anything is sent.
export const LITE_COOKIE = "dhruvsetu_lite";
export const LITE_STORAGE_KEY = "dhruvsetu.liteMode";
export const LITE_INTRO_KEY = "dhruvsetu.liteMode.introSeen";
export const LITE_SUGGESTION_KEY = "dhruvsetu.liteMode.suggestionDismissed";

export const LITE_EXPLANATION =
  "Lite Mode reduces images, maps and other heavy content to save data.";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked. Lite Mode then lasts for the page only.
    return null;
  }
}

export function readStoredLiteMode(): boolean | null {
  const value = storage()?.getItem(LITE_STORAGE_KEY);
  return value === "on" ? true : value === "off" ? false : null;
}

export function storeLiteMode(enabled: boolean): void {
  storage()?.setItem(LITE_STORAGE_KEY, enabled ? "on" : "off");
  if (typeof document !== "undefined") {
    document.cookie = `${LITE_COOKIE}=${enabled ? "1" : "0"}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  }
}

export function readFlag(key: string): boolean {
  return storage()?.getItem(key) === "yes";
}

export function storeFlag(key: string): void {
  storage()?.setItem(key, "yes");
}

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };

// True only when the browser itself reports a data-saving or very slow
// connection. Many browsers report nothing, and then this is false.
export function connectionLooksSlow(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  );
}
