import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { apiUrl, type ApiResult } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

const SESSION_COOKIE = "dhruvsetu_session";

async function sessionHeader(): Promise<Record<string, string> | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return session ? { cookie: `${SESSION_COOKIE}=${session}` } : null;
}

// The signed-in user for this request, or null. Signed-out visitors cause no
// extra request, and the result is reused within one page render.
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const headers = await sessionHeader();
  if (headers === null) return null;
  try {
    const response = await fetch(apiUrl("/api/auth/me"), { cache: "no-store", headers });
    return response.ok ? ((await response.json()) as AuthUser) : null;
  } catch {
    return null;
  }
});

// For admin pages. Signed-out visitors are sent to the login page. A signed-in
// account that is not an admin gets null, and the page shows a short message.
// The API checks the role again on every admin request.
export async function getAdminOrRedirect(path: string): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user.role === "admin" ? user : null;
}

// For researcher pages. Signed-out visitors are sent to the login page. A
// signed-in account without the researcher or admin role gets null. The API
// checks the role again on every researcher request.
export async function getResearcherOrRedirect(path: string): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user.role === "researcher" || user.role === "admin" ? user : null;
}

// For pages that need any signed-in account.
export async function getUserOrRedirect(path: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user;
}

// A server-side read on behalf of the signed-in user.
export async function getApiAsUser<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(apiUrl(path), {
      cache: "no-store",
      headers: (await sessionHeader()) ?? {},
    });
    if (!response.ok) {
      return { data: null, status: response.status, detail: null };
    }
    return { data: (await response.json()) as T, status: response.status, detail: null };
  } catch {
    return { data: null, status: null, detail: null };
  }
}
