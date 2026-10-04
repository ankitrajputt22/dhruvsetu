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
