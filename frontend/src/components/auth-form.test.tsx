import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm, RegisterForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import {
  emptyRegistration,
  registrationPayload,
  validateRegistration,
} from "@/lib/auth-validation";

const push = vi.fn();
const refresh = vi.fn();
const postApi = vi.fn();

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
}));

const PASSWORD = "a-long-test-value";
const created = {
  data: { id: "new-id", email: "asha@example.org", display_name: "Asha Rao", role: "user" },
  status: 201,
  detail: null,
};

function field(label: string | RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

function errorOf(label: string | RegExp): string | null {
  const id = field(label).getAttribute("aria-describedby");
  return id?.endsWith("-error") ? (document.getElementById(id)?.textContent ?? null) : null;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("Sign In form", () => {
  function submit() {
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  }

  function fillLogin() {
    fill("Email Address", "  asha@example.org ");
    fill("Password", PASSWORD);
  }

  it("shows the heading, the two fields and the way to create an account", () => {
    render(
      <AuthLayout subtitle="Sign in to continue to DhruvSetu." title="Welcome back">
        <LoginForm next="/admin" />
      </AuthLayout>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeTruthy();
    expect(screen.getByText("Sign in to continue to DhruvSetu.")).toBeTruthy();
    expect(field("Email Address").type).toBe("email");
    expect(field("Password").type).toBe("password");
    expect(screen.getByRole("link", { name: "Create Account" }).getAttribute("href")).toBe(
      "/register?next=%2Fadmin",
    );
    // The role comes from the account, so nobody chooses one when signing in.
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/forgot/i)).toBeNull();
  });

  it("sends the email and password and returns to the requested page", async () => {
    postApi.mockResolvedValue({ data: created.data, status: 200, detail: null });
    render(<LoginForm next="/admin" />);

    fillLogin();
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(postApi).toHaveBeenCalledWith("/api/auth/login", {
      email: "asha@example.org",
      password: PASSWORD,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows and hides the password with a named button", () => {
    render(<LoginForm next="/" />);
    fill("Password", PASSWORD);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field("Password").type).toBe("text");
    expect(field("Password").value).toBe(PASSWORD);
    expect(field("Password").autocomplete).toBe("current-password");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field("Password").type).toBe("password");
    // The button must not send the form.
    expect(postApi).not.toHaveBeenCalled();
  });

  it("checks the fields before sending anything", () => {
    render(<LoginForm next="/" />);

    submit();
    expect(errorOf("Email Address")).toBe("Enter your email address.");
    expect(errorOf("Password")).toBe("Enter your password.");
    expect(field("Email Address").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("Email Address"));

    fill("Email Address", "not-an-email");
    expect(errorOf("Email Address")).toBe("Enter a valid email address.");
    expect(postApi).not.toHaveBeenCalled();
  });

  it("shows one message for wrong details and keeps the form", async () => {
    postApi.mockResolvedValue({
      data: null,
      status: 401,
      detail: "Email or password is incorrect.",
    });
    render(<LoginForm next="/admin" />);

    fillLogin();
    submit();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect."),
    );
    expect(push).not.toHaveBeenCalled();
    expect(field("Password").value).toBe(PASSWORD);
    expect((screen.getByRole("button", { name: "Sign In" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("never shows the server's own text for an unexpected failure", async () => {
    postApi.mockResolvedValue({
      data: null,
      status: 500,
      detail: "Traceback: sqlalchemy.exc.OperationalError",
    });
    render(<LoginForm next="/" />);

    fillLogin();
    submit();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "We could not sign you in right now. Please try again.",
      ),
    );
    expect(document.body.textContent).not.toContain("Traceback");
  });

  it("says when DhruvSetu cannot be reached", async () => {
    postApi.mockResolvedValue({ data: null, status: null, detail: null });
    render(<LoginForm next="/" />);

    fillLogin();
    submit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not reach"));
  });

  it("sends one request while the first is still on its way", async () => {
    let finish: (value: unknown) => void = () => {};
    postApi.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<LoginForm next="/" />);

    fillLogin();
    const form = screen.getByRole("button", { name: "Sign In" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    const button = await screen.findByRole("button", { name: "Signing in…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Signing in…");
    fireEvent.submit(form);
    expect(postApi).toHaveBeenCalledTimes(1);

    finish({ data: created.data, status: 200, detail: null });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});

describe("Create Account form", () => {
  function submit() {
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
  }

  function fillAccount(confirm = PASSWORD) {
    fill("Full Name", " Asha Rao ");
    fill("Email Address", "asha@example.org");
    fill("Password", PASSWORD);
    fill("Confirm Password", confirm);
  }

  function chooseResearcher() {
    fireEvent.click(screen.getByRole("radio", { name: "Researcher" }));
  }

  function fillResearcher() {
    fill("Institution / Organisation", "Test Polar Institute");
    fill("Research Area", "Glaciology");
    fill("Reason for Researcher Access", "To analyse the demo datasets.");
    fireEvent.click(screen.getByRole("checkbox"));
  }

  function sentBody(): Record<string, unknown> {
    return postApi.mock.calls[0][1] as Record<string, unknown>;
  }

  it("offers General User and Researcher, and never Admin", () => {
    render(
      <AuthLayout
        subtitle="Join India's polar science knowledge platform."
        title="Create your DhruvSetu account"
      >
        <RegisterForm next="/" />
      </AuthLayout>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Create your DhruvSetu account" }),
    ).toBeTruthy();
    const group = screen.getByRole("group", { name: "I want to join as" });
    const options = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(options.map((option) => option.value)).toEqual(["user", "researcher"]);
    expect(options.map((option) => option.checked)).toEqual([true, false]);
    expect(screen.getByRole("radio", { name: "General User" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /admin/i })).toBeNull();
    expect(screen.queryByText(/^admin$/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Sign In" }).getAttribute("href")).toBe("/login");
  });

  it("shows the researcher questions only while Researcher is chosen", () => {
    render(<RegisterForm next="/" />);
    expect(screen.queryByLabelText("Institution / Organisation")).toBeNull();
    expect(screen.queryByText(/requires administrator approval\. Your account/)).toBeNull();

    chooseResearcher();
    expect(
      screen.getByText(
        "Researcher access requires administrator approval. Your account will initially have normal user access.",
      ),
    ).toBeTruthy();
    for (const label of [
      "Institution / Organisation",
      "Research Area",
      /^Designation/,
      "Reason for Researcher Access",
      /^Institutional \/ Professional Profile URL/,
    ]) {
      expect(field(label)).toBeTruthy();
    }
    expect(screen.getByRole("checkbox")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "General User" }));
    expect(screen.queryByLabelText("Institution / Organisation")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("asks for every required field", () => {
    render(<RegisterForm next="/" />);

    submit();

    expect(errorOf("Full Name")).toBe("Enter your full name.");
    expect(errorOf("Email Address")).toBe("Enter your email address.");
    expect(errorOf("Password")).toBe("Enter a password.");
    expect(errorOf("Confirm Password")).toBe("Confirm your password.");
    expect(document.activeElement).toBe(field("Full Name"));
    expect(postApi).not.toHaveBeenCalled();
  });

  it("uses the same password length as the API", () => {
    render(<RegisterForm next="/" />);
    expect(screen.getByText("Use at least 10 characters.")).toBeTruthy();

    fillAccount();
    fill("Password", "too-short");
    fill("Confirm Password", "too-short");
    submit();
    expect(errorOf("Password")).toBe("Use at least 10 characters.");

    fill("Password", "x".repeat(129));
    expect(errorOf("Password")).toBe("Use at most 128 characters.");

    // Ten characters are enough. No other password rule is added.
    fill("Password", "aaaaaaaaaa");
    expect(errorOf("Password")).toBeNull();
    expect(postApi).not.toHaveBeenCalled();
  });

  it("stops when the two passwords are different", () => {
    render(<RegisterForm next="/" />);

    fillAccount("a-different-value");
    submit();

    expect(errorOf("Confirm Password")).toBe("Passwords do not match.");
    expect(document.activeElement).toBe(field("Confirm Password"));
    expect(postApi).not.toHaveBeenCalled();

    fill("Confirm Password", PASSWORD);
    expect(errorOf("Confirm Password")).toBeNull();
  });

  it("shows and hides each password on its own", () => {
    render(<RegisterForm next="/" />);
    fillAccount();

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field("Password").type).toBe("text");
    expect(field("Confirm Password").type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(field("Confirm Password").type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide confirm password" }));
    expect(field("Password").type).toBe("password");
    expect(field("Confirm Password").type).toBe("password");
    expect(field("Password").autocomplete).toBe("new-password");
  });

  it("creates a normal user account and sends only what the API needs", async () => {
    postApi.mockResolvedValue(created);
    render(<RegisterForm next="/datasets" />);

    fillAccount();
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome?next=%2Fdatasets"));
    expect(refresh).toHaveBeenCalled();
    expect(postApi).toHaveBeenCalledTimes(1);
    expect(postApi.mock.calls[0][0]).toBe("/api/auth/register");
    // No password confirmation and no role.
    expect(sentBody()).toEqual({
      email: "asha@example.org",
      password: PASSWORD,
      display_name: "Asha Rao",
      account_type: "user",
    });
  });

  it("checks the researcher questions", () => {
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();

    submit();

    expect(errorOf("Institution / Organisation")).toBe(
      "Enter your institution or organisation.",
    );
    expect(errorOf("Research Area")).toBe("Select your research area.");
    expect(errorOf("Reason for Researcher Access")).toBe(
      "Tell us why you need researcher access.",
    );
    expect(screen.getByText("Please confirm that you understand this.")).toBeTruthy();
    expect(document.activeElement).toBe(field("Institution / Organisation"));
    expect(postApi).not.toHaveBeenCalled();
  });

  it("needs the acknowledgement for a researcher request", () => {
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();
    fillResearcher();
    fireEvent.click(screen.getByRole("checkbox"));

    submit();

    expect(screen.getByText("Please confirm that you understand this.")).toBeTruthy();
    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBe("true");
    expect(postApi).not.toHaveBeenCalled();
  });

  it("asks for the research area when Other is chosen", async () => {
    postApi.mockResolvedValue(created);
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();
    fillResearcher();
    expect(screen.queryByLabelText("Please specify")).toBeNull();

    fill("Research Area", "Other");
    submit();
    expect(errorOf("Please specify")).toBe("Please specify your research area.");
    expect(postApi).not.toHaveBeenCalled();

    fill("Please specify", "Polar Law");
    submit();
    await waitFor(() => expect(postApi).toHaveBeenCalledTimes(1));
    expect((sentBody().researcher as Record<string, unknown>).research_area).toBe("Polar Law");
  });

  it("accepts only an http or https profile address", () => {
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();
    fillResearcher();

    for (const address of ["example.org/me", "javascript:alert(1)", "ftp://example.org/me"]) {
      fill(/^Institutional \/ Professional Profile URL/, address);
      submit();
      expect(errorOf(/^Institutional \/ Professional Profile URL/)).toBe(
        "Enter a full web address that starts with http:// or https://.",
      );
    }
    expect(postApi).not.toHaveBeenCalled();
  });

  it("sends a researcher request that still asks for a normal user account", async () => {
    postApi.mockResolvedValue(created);
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();
    fillResearcher();
    fill(/^Designation/, "Research student");
    fill(/^Institutional \/ Professional Profile URL/, "https://example.org/people/asha");

    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome"));
    expect(sentBody()).toEqual({
      email: "asha@example.org",
      password: PASSWORD,
      display_name: "Asha Rao",
      account_type: "researcher",
      researcher: {
        institution: "Test Polar Institute",
        research_area: "Glaciology",
        designation: "Research student",
        reason: "To analyse the demo datasets.",
        profile_url: "https://example.org/people/asha",
        acknowledged: true,
      },
    });
    // The welcome page is told what was asked for, for this account only.
    expect(window.sessionStorage.getItem("dhruvsetu.signup")).toBe("new-id:researcher");
  });

  it("leaves the researcher answers out after switching back to General User", async () => {
    postApi.mockResolvedValue(created);
    render(<RegisterForm next="/" />);
    fillAccount();
    chooseResearcher();
    fillResearcher();
    fireEvent.click(screen.getByRole("radio", { name: "General User" }));

    submit();

    await waitFor(() => expect(postApi).toHaveBeenCalledTimes(1));
    expect(sentBody().account_type).toBe("user");
    expect("researcher" in sentBody()).toBe(false);
  });

  it("can never ask the API for a role", () => {
    for (const accountType of ["user", "researcher"] as const) {
      const payload = registrationPayload({
        ...emptyRegistration,
        accountType,
        researchArea: "Sea Ice",
      });
      const text = JSON.stringify(payload);
      expect(text).not.toContain('"role"');
      expect(text).not.toContain("admin");
      expect(text).not.toContain("confirm");
      expect(payload.account_type).toBe(accountType);
    }
  });

  it("explains a failed sign-up without the server's own text", async () => {
    postApi.mockResolvedValue({ data: null, status: 409, detail: "duplicate key users.email" });
    render(<RegisterForm next="/" />);
    fillAccount();

    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "An account with this email already exists. Sign in instead.",
      ),
    );
    expect(document.body.textContent).not.toContain("duplicate key");
    expect(push).not.toHaveBeenCalled();

    postApi.mockResolvedValue({ data: null, status: 500, detail: "Internal Server Error" });
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "We could not create your account right now. Please try again.",
      ),
    );
  });

  it("creates one account when the form is sent twice", async () => {
    let finish: (value: unknown) => void = () => {};
    postApi.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<RegisterForm next="/" />);
    fillAccount();

    const form = screen.getByRole("button", { name: "Create Account" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    const button = await screen.findByRole("button", { name: "Creating your account…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(postApi).toHaveBeenCalledTimes(1);

    finish(created);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome"));
  });
});

describe("registration checks", () => {
  it("does not check researcher answers for a general user", () => {
    const errors = validateRegistration({
      ...emptyRegistration,
      fullName: "Asha Rao",
      email: "asha@example.org",
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });

    expect(errors).toEqual({});
  });
});
