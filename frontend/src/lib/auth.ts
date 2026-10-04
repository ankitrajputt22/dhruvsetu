export type UserRole = "user" | "researcher" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
};

export const roleLabels: Record<UserRole, string> = {
  user: "User",
  researcher: "Researcher",
  admin: "Admin",
};

// These only decide what the page shows. The API checks every request itself.
export function canUseDataLab(user: AuthUser | null): boolean {
  return user?.role === "researcher" || user?.role === "admin";
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

export function userName(user: AuthUser): string {
  return user.display_name ?? user.email;
}

// Where to go after signing in. Only paths on this site are accepted.
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

// After signing up, the welcome page says what was asked for. The note is kept
// for this browser tab only and is tied to the new account.
const SIGNUP_NOTE_KEY = "dhruvsetu.signup";

export function rememberSignup(userId: string, accountType: string): void {
  try {
    window.sessionStorage.setItem(SIGNUP_NOTE_KEY, `${userId}:${accountType}`);
  } catch {
    // Without storage the welcome page simply shows its general message.
  }
}

export function signedUpAsResearcher(userId: string): boolean {
  try {
    return window.sessionStorage.getItem(SIGNUP_NOTE_KEY) === `${userId}:researcher`;
  } catch {
    return false;
  }
}
