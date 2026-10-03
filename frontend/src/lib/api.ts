export type ApiResult<T> =
  | { data: T; status: number }
  | { data: null; status: number | null };

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function getApi<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });

    if (!response.ok) {
      return { data: null, status: response.status };
    }

    return { data: (await response.json()) as T, status: response.status };
  } catch {
    return { data: null, status: null };
  }
}

export type PostResult<T> =
  | { data: T; status: number; detail: null }
  | { data: null; status: number | null; detail: string | null };

export async function postApi<T>(
  path: string,
  body: unknown,
): Promise<PostResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

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
  } catch {
    return { data: null, status: null, detail: null };
  }
}
