"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";

import {
  LITE_EXPLANATION,
  LITE_INTRO_KEY,
  LITE_SUGGESTION_KEY,
  connectionLooksSlow,
  readFlag,
  readStoredLiteMode,
  storeFlag,
  storeLiteMode,
} from "@/lib/lite-mode";

type LiteModeState = {
  lite: boolean;
  setLite: (enabled: boolean) => void;
};

const LiteModeContext = createContext<LiteModeState>({
  lite: false,
  setLite: () => {},
});

export function useLiteMode(): LiteModeState {
  return useContext(LiteModeContext);
}

// Components are told when the saved choice changes, in this tab or another.
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function LiteModeProvider({
  initialLite,
  children,
}: {
  // What the server saw in the cookie when it rendered the page.
  initialLite: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // The choice saved in this browser. While the page first renders, the
  // server's value is used so both sides draw the same thing.
  const lite = useSyncExternalStore(
    subscribe,
    () => readStoredLiteMode() ?? initialLite,
    () => initialLite,
  );

  const setLite = useCallback(
    (enabled: boolean) => {
      storeLiteMode(enabled);
      listeners.forEach((listener) => listener());
      // Server-rendered parts of the page are sent again for the new mode.
      router.refresh();
    },
    [router],
  );

  // First load only: the saved choice wins over the cookie the server saw.
  useEffect(() => {
    const stored = readStoredLiteMode();
    if (stored === null) {
      if (initialLite) storeLiteMode(true);
    } else if (stored !== initialLite) {
      storeLiteMode(stored);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LiteModeContext.Provider value={{ lite, setLite }}>
      {children}
    </LiteModeContext.Provider>
  );
}

type Note = "intro" | "suggestion" | null;

export function LiteModeToggle() {
  const { lite, setLite } = useLiteMode();
  const [note, setNote] = useState<Note>(null);
  const explanationId = useId();

  // Suggest Lite Mode once when the browser reports a slow or data-saving
  // connection. It is never switched on automatically.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        readStoredLiteMode() === null &&
        !readFlag(LITE_SUGGESTION_KEY) &&
        connectionLooksSlow()
      ) {
        setNote("suggestion");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function change(enabled: boolean) {
    setLite(enabled);
    if (enabled && !readFlag(LITE_INTRO_KEY)) {
      storeFlag(LITE_INTRO_KEY);
      setNote("intro");
    } else {
      setNote(null);
    }
  }

  function dismissSuggestion() {
    storeFlag(LITE_SUGGESTION_KEY);
    setNote(null);
  }

  const smallButton =
    "rounded-md border px-2.5 py-1 text-xs font-semibold transition";

  return (
    <div className="relative">
      <button
        aria-checked={lite}
        aria-describedby={explanationId}
        aria-label="Lite Mode"
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
        onClick={() => change(!lite)}
        role="switch"
        title={LITE_EXPLANATION}
        type="button"
      >
        <span>
          Lite<span className="sr-only sm:not-sr-only"> Mode</span>
        </span>
        <span
          aria-hidden="true"
          className={`rounded-full px-1.5 py-0.5 text-[0.68rem] leading-none ${
            lite ? "bg-emerald-200 text-emerald-950" : "bg-white/20 text-white"
          }`}
        >
          {lite ? "On" : "Off"}
        </span>
      </button>
      <span className="sr-only" id={explanationId}>
        {LITE_EXPLANATION}
      </span>

      {note !== null && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700 shadow-xl"
          role="status"
        >
          {note === "intro" ? (
            <>
              <p className="font-semibold text-slate-950">Lite Mode is on</p>
              <p className="mt-1">
                {LITE_EXPLANATION} Maps load only when you ask for them.
              </p>
              <button
                className={`${smallButton} mt-2 border-slate-300 text-slate-800 hover:border-sky-600`}
                onClick={() => setNote(null)}
                type="button"
              >
                OK
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-950">
                Slow connection detected. Turn on Lite Mode?
              </p>
              <p className="mt-1">{LITE_EXPLANATION}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className={`${smallButton} border-sky-800 bg-sky-800 text-white hover:bg-sky-900`}
                  onClick={() => {
                    storeFlag(LITE_SUGGESTION_KEY);
                    change(true);
                  }}
                  type="button"
                >
                  Turn on
                </button>
                <button
                  className={`${smallButton} border-slate-300 text-slate-800 hover:border-sky-600`}
                  onClick={dismissSuggestion}
                  type="button"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
