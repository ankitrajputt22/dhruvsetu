export type ApiResult<T> =
  | { data: T; status: number; detail: null }
  | { data: null; status: number | null; detail: string | null };

const SERVER_API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// On the server the API is called directly. In the browser every call goes to
// this site, which passes it on to the API (see next.config.ts), so the login
// cookie is sent with it.
export function apiUrl(path: string): string {
  return typeof window === "undefined" ? `${SERVER_API_URL}${path}` : path;
}

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    return {
      data: null,
      status: response.status,
      detail: typeof error?.detail === "string" ? error.detail : null,
    };
  }

  return { data: (await response.json()) as T, status: response.status, detail: null };
}

export async function getApi<T>(path: string): Promise<ApiResult<T>> {
  try {
    return await readResult<T>(await fetch(apiUrl(path), { cache: "no-store" }));
  } catch {
    return { data: null, status: null, detail: null };
  }
}

// Reads a plain text file from the API, for the text preview of a document.
// Empty when the file cannot be read.
export async function getApiText(path: string): Promise<string | null> {
  try {
    const response = await fetch(apiUrl(path), { cache: "no-store" });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

export async function postApi<T>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    return await readResult<T>(
      await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  } catch {
    return { data: null, status: null, detail: null };
  }
}

// Sends a form with a file. The browser sets the content type itself.
export async function postForm<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  try {
    return await readResult<T>(await fetch(apiUrl(path), { method: "POST", body: form }));
  } catch {
    return { data: null, status: null, detail: null };
  }
}

export async function patchApi<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    return await readResult<T>(
      await fetch(apiUrl(path), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  } catch {
    return { data: null, status: null, detail: null };
  }
}

// "keepalive" lets the request finish while the page is being closed.
export async function deleteApi(path: string, keepalive = false): Promise<number | null> {
  try {
    const response = await fetch(apiUrl(path), { method: "DELETE", keepalive });
    return response.status;
  } catch {
    return null;
  }
}
