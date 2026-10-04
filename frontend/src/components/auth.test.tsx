import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserRoleControl, VerificationControls } from "@/components/admin-controls";
import { AccountMenu, AccountMenuItems, AuthProvider } from "@/components/auth";
import { AuthForm } from "@/components/auth-form";
import {
  DATA_LAB_RESEARCH_ONLY,
  DatasetDataLabAction,
} from "@/components/data-lab-access";
import { type AuthUser, safeNextPath, type UserRole } from "@/lib/auth";
import type { AdminUser } from "@/lib/types";

const push = vi.fn();
const refresh = vi.fn();
const postApi = vi.fn();
const patchApi = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api", () => ({
  postApi: (...args: unknown[]) => postApi(...args),
  patchApi: (...args: unknown[]) => patchApi(...args),
}));

function account(role: UserRole): AuthUser {
  return { id: `${role}-id`, email: `${role}@example.org`, display_name: `Test ${role}`, role };
}

function renderHeader(user: AuthUser | null) {
  return render(
    <AuthProvider user={user}>
      <AccountMenu />
    </AuthProvider>,
  );
}

function renderMobileMenu(user: AuthUser | null) {
  return render(
    <AuthProvider user={user}>
      <ul>
        <AccountMenuItems />
      </ul>
    </AuthProvider>,
  );
}

function linkTo(href: string): HTMLElement | undefined {
  return screen.queryAllByRole("link").find((link) => link.getAttribute("href") === href);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("header account menu", () => {
  it("shows only Login to a signed-out visitor", () => {
    renderHeader(null);

    expect(linkTo("/login")?.textContent).toBe("Login");
    expect(screen.queryByText("Logout")).toBeNull();
    expect(linkTo("/admin")).toBeUndefined();
  });

  it("shows the name, the role and Logout to a signed-in user", () => {
    renderHeader(account("user"));

    expect(screen.getAllByText("Test user").length).toBeGreaterThan(0);
    expect(screen.getByText("Role: User")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    expect(linkTo("/login")).toBeUndefined();
  });

  it("shows the Admin entry only to an admin", () => {
    renderHeader(account("admin"));
    expect(linkTo("/admin")?.textContent).toBe("Admin");
    cleanup();

    for (const role of ["user", "researcher"] as const) {
      renderHeader(account(role));
      expect(linkTo("/admin")).toBeUndefined();
      cleanup();
    }
  });

  it("applies the same rules in the small-screen menu", () => {
    renderMobileMenu(null);
    expect(linkTo("/login")).toBeTruthy();
    expect(linkTo("/admin")).toBeUndefined();
    cleanup();

    renderMobileMenu(account("researcher"));
    expect(screen.getByText("Role: Researcher")).toBeTruthy();
    expect(linkTo("/data-lab")).toBeTruthy();
    expect(linkTo("/admin")).toBeUndefined();
    cleanup();

    renderMobileMenu(account("admin"));
    expect(linkTo("/admin")).toBeTruthy();
  });

  it("logs out through the API and reloads the page data", async () => {
    postApi.mockResolvedValue({ data: null, status: null, detail: null });
    renderHeader(account("user"));

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(postApi).toHaveBeenCalledWith("/api/auth/logout", {});
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("Polar Data Lab access", () => {
  function renderAction(user: AuthUser | null, enabled = true) {
    return render(
      <DatasetDataLabAction datasetId="dataset-1" enabled={enabled} fileSupported user={user} />,
    );
  }

  it("lets a researcher and an admin open the Data Lab", () => {
    for (const role of ["researcher", "admin"] as const) {
      renderAction(account(role));
      expect(linkTo("/data-lab?dataset=dataset-1")).toBeTruthy();
      expect(screen.queryByText(DATA_LAB_RESEARCH_ONLY, { exact: false })).toBeNull();
      cleanup();
    }
  });

  it("shows a normal user the research-only message and no Data Lab link", () => {
    renderAction(account("user"));

    expect(screen.getByText(DATA_LAB_RESEARCH_ONLY, { exact: false })).toBeTruthy();
    expect(linkTo("/data-lab?dataset=dataset-1")).toBeUndefined();
    expect(linkTo("/login")).toBeUndefined();
  });

  it("shows a signed-out visitor the message and a Login link that returns here", () => {
    renderAction(null);

    expect(screen.getByText(DATA_LAB_RESEARCH_ONLY, { exact: false })).toBeTruthy();
    expect(linkTo("/data-lab?dataset=dataset-1")).toBeUndefined();
    expect(linkTo(`/login?next=${encodeURIComponent("/data-lab?dataset=dataset-1")}`)).toBeTruthy();
  });

  it("offers no Data Lab link to anyone when the server has it turned off", () => {
    renderAction(account("researcher"), false);

    expect(screen.getByText("Polar Data Lab is not enabled on this server.")).toBeTruthy();
    expect(linkTo("/data-lab?dataset=dataset-1")).toBeUndefined();
  });
});

describe("admin verification controls", () => {
  function buttonNames(): string[] {
    return screen.getAllByRole("button").map((button) => button.textContent ?? "");
  }

  it("offers only the next step for an Uploaded record", () => {
    render(<VerificationControls recordId="r1" recordType="dataset" status="uploaded" />);

    expect(buttonNames()).toEqual(["Mark as Reviewed"]);
  });

  it("offers Verified, and a way back, for a Reviewed record", () => {
    render(<VerificationControls recordId="r1" recordType="dataset" status="reviewed" />);

    expect(buttonNames()).toEqual(["Mark as Verified", "Move back to Uploaded"]);
  });

  it("offers only backward moves for a Verified record", () => {
    render(<VerificationControls recordId="r1" recordType="dataset" status="verified" />);

    expect(buttonNames()).toEqual(["Move back to Reviewed", "Move back to Uploaded"]);
  });

  it("changes nothing until a button is pressed, then asks the API", async () => {
    patchApi.mockResolvedValue({ data: { id: "r1" }, status: 200, detail: null });
    render(<VerificationControls recordId="r1" recordType="dataset" status="uploaded" />);
    expect(patchApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Mark as Reviewed" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(patchApi).toHaveBeenCalledWith("/api/admin/records/dataset/r1/verification", {
      status: "reviewed",
    });
    expect(screen.getByRole("status").textContent).toBe("The status was changed.");
  });

  it("shows the reason when the API refuses the change", async () => {
    patchApi.mockResolvedValue({
      data: null,
      status: 403,
      detail: "Your account does not have permission for this.",
    });
    render(<VerificationControls recordId="r1" recordType="dataset" status="uploaded" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark as Reviewed" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Your account does not have permission for this.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("admin role control", () => {
  function adminUser(role: UserRole): AdminUser {
    return {
      id: `${role}-id`,
      email: `${role}@example.org`,
      display_name: null,
      role,
      is_active: true,
      created_at: "2026-10-04T00:00:00",
    };
  }

  it("offers only the User and Researcher roles", () => {
    render(<UserRoleControl user={adminUser("user")} />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["User", "Researcher"]);
  });

  it("has no control for an admin account", () => {
    render(<UserRoleControl user={adminUser("admin")} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Admin")).toBeTruthy();
  });
});

describe("login and registration forms", () => {
  function fill(label: RegExp, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it("registers with an email, a password and a name, and never a role", async () => {
    postApi.mockResolvedValue({ data: account("user"), status: 201, detail: null });
    render(<AuthForm mode="register" next="/" />);

    fill(/^Name/, "Asha");
    fill(/^Email/, "asha@example.org");
    fill(/^Password/, "a-long-test-value");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(postApi).toHaveBeenCalledTimes(1);
    const [path, body] = postApi.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/auth/register");
    expect(Object.keys(body).sort()).toEqual(["display_name", "email", "password"]);
  });

  it("shows the login error and stays on the page", async () => {
    postApi.mockResolvedValue({
      data: null,
      status: 401,
      detail: "Email or password is incorrect.",
    });
    render(<AuthForm mode="login" next="/admin" />);

    fill(/^Email/, "asha@example.org");
    fill(/^Password/, "not-the-right-one");
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect."),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("returns to the requested page after login", async () => {
    postApi.mockResolvedValue({ data: account("admin"), status: 200, detail: null });
    render(<AuthForm mode="login" next="/admin" />);

    fill(/^Email/, "admin@example.org");
    fill(/^Password/, "a-long-test-value");
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(refresh).toHaveBeenCalled();
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site and rejects everything else", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/data-lab?dataset=1")).toBe("/data-lab?dataset=1");
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//example.com")).toBe("/");
    expect(safeNextPath("/\\example.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
