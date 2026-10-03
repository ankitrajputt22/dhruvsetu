export type ApiResult<T> =
  | { data: T; status: number; detail: null }
  | { data: null; status: number | null; detail: string | null };

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
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

// "keepalive" lets the request finish while the page is being closed.
export async function deleteApi(path: string, keepalive = false): Promise<number | null> {
  try {
    const response = await fetch(apiUrl(path), { method: "DELETE", keepalive });
    return response.status;
  } catch {
    return null;
  }
}
