import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminResearcherRequestPage from "@/app/admin/researcher-requests/[id]/page";
import AdminResearcherRequestsPage from "@/app/admin/researcher-requests/page";
import ResearchWorkspacePage from "@/app/researcher/page";
import { AccountMenu, AuthProvider } from "@/components/auth";
import { ResearcherAccessPanel } from "@/components/researcher-access";
import { ResearcherDecision } from "@/components/researcher-decision";
import { SubmissionForm } from "@/components/submission-form";
import type { AuthUser, UserRole } from "@/lib/auth";
import type {
  AdminResearcherRequest,
  AdminResearcherRequestDetail,
  ResearcherAccess,
  ResearcherRequestOwn,
  SubmissionItem,
} from "@/lib/types";

const push = vi.fn();
const refresh = vi.fn();
const postApi = vi.fn();
const postForm = vi.fn();
const getAdminOrRedirect = vi.fn();
const getResearcherOrRedirect = vi.fn();
const getApiAsUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  notFound: () => {
    throw new Error("not found");
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    "aria-current"?: "page";
  }) => (
    <a aria-current={rest["aria-current"]} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  postApi: (...args: unknown[]) => postApi(...args),
  postForm: (...args: unknown[]) => postForm(...args),
}));

vi.mock("@/lib/auth-server", () => ({
  getAdminOrRedirect: (...args: unknown[]) => getAdminOrRedirect(...args),
  getResearcherOrRedirect: (...args: unknown[]) => getResearcherOrRedirect(...args),
  getApiAsUser: (...args: unknown[]) => getApiAsUser(...args),
}));

function account(role: UserRole): AuthUser {
  return { id: `${role}-id`, email: `${role}@example.org`, display_name: `Test ${role}`, role };
}

function ownRequest(changes: Partial<ResearcherRequestOwn> = {}): ResearcherRequestOwn {
  return {
    id: "request-1",
    status: "pending",
    institution: "Test Polar Institute",
    research_area: "Glaciology",
    designation: null,
    reason: "To submit field notes.",
    profile_url: null,
    created_at: "2026-10-04T10:00:00",
    decided_at: null,
    decision_note: null,
    ...changes,
  };
}

function access(changes: Partial<ResearcherAccess> = {}): ResearcherAccess {
  return { role: "user", access_status: "none", can_request: true, requests: [], ...changes };
}

function linkTo(href: string): HTMLElement | undefined {
  return screen.queryAllByRole("link").find((link) => link.getAttribute("href") === href);
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Researcher Access page", () => {
  function fillRequest() {
    fill("Institution / Organisation", "Test Polar Institute");
    fill("Research Area", "Glaciology");
    fill("Reason for Researcher Access", "To submit field notes.");
    fireEvent.click(screen.getByRole("checkbox"));
  }

  it("shows a general user with no request the request form", () => {
    render(<ResearcherAccessPanel initial={access()} />);

    expect(screen.getByText("General User")).toBeTruthy();
    expect(screen.getByText("No researcher access request")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Request Researcher Access" }),
    ).toBeTruthy();
    for (const label of [
      "Institution / Organisation",
      "Research Area",
      /^Designation/,
      "Reason for Researcher Access",
      /^Institutional \/ Professional Profile URL/,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: "Your requests" })).toBeNull();
    expect(linkTo("/researcher")).toBeUndefined();
  });

  it("checks the answers and sends only the researcher details", async () => {
    postApi.mockResolvedValue({
      data: access({
        access_status: "pending",
        can_request: false,
        requests: [ownRequest()],
      }),
      status: 201,
      detail: null,
    });
    render(<ResearcherAccessPanel initial={access()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    expect(screen.getByText("Enter your institution or organisation.")).toBeTruthy();
    expect(screen.getByText("Please confirm that you understand this.")).toBeTruthy();
    expect(postApi).not.toHaveBeenCalled();

    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    await waitFor(() => expect(screen.getByText("Your request was sent.")).toBeTruthy());
    expect(postApi).toHaveBeenCalledTimes(1);
    // No status, role or decision can be part of what is sent.
    expect(postApi).toHaveBeenCalledWith("/api/researcher-access", {
      institution: "Test Polar Institute",
      research_area: "Glaciology",
      designation: null,
      reason: "To submit field notes.",
      profile_url: null,
      acknowledged: true,
    });
    // The page now shows the waiting request and no second form.
    expect(screen.getAllByText("Pending Review").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Send Request" })).toBeNull();
    expect(screen.getByText("General User")).toBeTruthy();
  });

  it("shows a waiting request without calling the account a researcher", () => {
    render(
      <ResearcherAccessPanel
        initial={access({
          access_status: "pending",
          can_request: false,
          requests: [ownRequest()],
        })}
      />,
    );

    expect(screen.getByText("General User")).toBeTruthy();
    expect(screen.getAllByText("Pending Review").length).toBe(2);
    expect(screen.getByText(/Until it is approved, your account has normal user access/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Request Researcher Access" })).toBeNull();
    expect(linkTo("/researcher")).toBeUndefined();
    expect(screen.queryByText("Researcher", { exact: true })).toBeNull();
  });

  it("shows an approved account the way to the workspace", () => {
    render(
      <ResearcherAccessPanel
        initial={access({
          role: "researcher",
          access_status: "approved",
          can_request: false,
          requests: [ownRequest({ status: "approved", decided_at: "2026-10-05T09:00:00" })],
        })}
      />,
    );

    expect(screen.getByText("Researcher", { exact: true })).toBeTruthy();
    expect(screen.getAllByText("Approved").length).toBe(2);
    expect(linkTo("/researcher")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Request Researcher Access" })).toBeNull();
  });

  it("shows a rejected request with its note and lets the person ask again", () => {
    render(
      <ResearcherAccessPanel
        initial={access({
          access_status: "rejected",
          can_request: true,
          requests: [
            ownRequest({
              status: "rejected",
              decided_at: "2026-10-05T09:00:00",
              decision_note: "Please add your institutional profile.",
            }),
          ],
        })}
      />,
    );

    expect(screen.getAllByText("Rejected").length).toBe(2);
    expect(screen.getByText("Note from the administrator:", { exact: false })).toBeTruthy();
    expect(screen.getAllByText(/Please add your institutional profile\./).length).toBe(2);
    expect(screen.getByText(/You can send a new request\./)).toBeTruthy();
    // The resubmission rule: a rejected person gets the form again.
    expect(
      screen.getByRole("heading", { name: "Request Researcher Access" }),
    ).toBeTruthy();
    expect(screen.getByText("General User")).toBeTruthy();
  });

  it("shows no note when the administrator wrote none", () => {
    render(
      <ResearcherAccessPanel
        initial={access({
          access_status: "rejected",
          requests: [ownRequest({ status: "rejected", decided_at: "2026-10-05T09:00:00" })],
        })}
      />,
    );

    expect(screen.queryByText("Note from the administrator:", { exact: false })).toBeNull();
  });

  it("explains a request that the API refuses", async () => {
    postApi.mockResolvedValue({
      data: null,
      status: 409,
      detail: "You already have a request waiting for review.",
    });
    render(<ResearcherAccessPanel initial={access()} />);

    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "You already have a request waiting for review.",
      ),
    );
    expect(screen.queryByText("Your request was sent.")).toBeNull();
  });
});

describe("Admin researcher requests", () => {
  const admin = account("admin");

  function listed(changes: Partial<AdminResearcherRequest> = {}): AdminResearcherRequest {
    return {
      id: "request-1",
      status: "pending",
      applicant: {
        id: "user-1",
        email: "asha@example.org",
        display_name: "Asha Rao",
        role: "user",
      },
      institution: "Test Polar Institute",
      research_area: "Glaciology",
      designation: "Research student",
      created_at: "2026-10-04T10:00:00",
      ...changes,
    };
  }

  function detail(
    changes: Partial<AdminResearcherRequestDetail> = {},
  ): AdminResearcherRequestDetail {
    return {
      ...listed(),
      reason: "To submit field notes.",
      profile_url: "https://example.org/people/asha",
      decided_at: null,
      decided_by: null,
      decision_note: null,
      other_requests: [],
      ...changes,
    };
  }

  it("lists the waiting requests first, with the applicant's details", async () => {
    getAdminOrRedirect.mockResolvedValue(admin);
    getApiAsUser.mockResolvedValue({
      data: [
        listed(),
        listed({
          id: "request-2",
          status: "approved",
          applicant: { id: "user-2", email: "ben@example.org", display_name: "Ben Roy", role: "researcher" },
        }),
      ],
      status: 200,
      detail: null,
    });

    render(await AdminResearcherRequestsPage({ searchParams: Promise.resolve({}) }));

    expect(getAdminOrRedirect).toHaveBeenCalledWith("/admin/researcher-requests");
    const filters = within(screen.getByRole("navigation", { name: "Filter requests by status" }));
    expect(filters.getByRole("link", { name: "Pending (1)" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(filters.getByRole("link", { name: "Approved (1)" })).toBeTruthy();
    expect(filters.getByRole("link", { name: "Rejected (0)" })).toBeTruthy();
    expect(filters.getByRole("link", { name: "All (2)" })).toBeTruthy();

    expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy();
    expect(screen.getByText("asha@example.org")).toBeTruthy();
    expect(screen.getByText("Test Polar Institute")).toBeTruthy();
    expect(screen.getByText("Glaciology")).toBeTruthy();
    expect(screen.getByText("Research student")).toBeTruthy();
    expect(screen.getByText("Pending Review")).toBeTruthy();
    expect(linkTo("/admin/researcher-requests/request-1")).toBeTruthy();
    // Only waiting requests are shown by default.
    expect(screen.queryByRole("heading", { name: "Ben Roy" })).toBeNull();
  });

  it("filters by status and says when nothing is waiting", async () => {
    getAdminOrRedirect.mockResolvedValue(admin);
    getApiAsUser.mockResolvedValue({
      data: [listed({ status: "rejected" })],
      status: 200,
      detail: null,
    });

    render(await AdminResearcherRequestsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("No requests are waiting for review.")).toBeTruthy();
    cleanup();

    render(
      await AdminResearcherRequestsPage({
        searchParams: Promise.resolve({ status: "rejected" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy();
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });

  it("shows nothing of the list to an account that is not an admin", async () => {
    getAdminOrRedirect.mockResolvedValue(null);

    render(await AdminResearcherRequestsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/This area is for DhruvSetu admins/)).toBeTruthy();
    expect(getApiAsUser).not.toHaveBeenCalled();
  });

  it("shows the full request with the decision controls while it waits", async () => {
    getAdminOrRedirect.mockResolvedValue(admin);
    getApiAsUser.mockResolvedValue({ data: detail(), status: 200, detail: null });

    render(
      await AdminResearcherRequestPage({ params: Promise.resolve({ id: "request-1" }) }),
    );

    expect(getApiAsUser).toHaveBeenCalledWith("/api/admin/researcher-requests/request-1");
    for (const text of [
      "asha@example.org",
      "General User",
      "Test Polar Institute",
      "Glaciology",
      "Research student",
      "To submit field notes.",
      "https://example.org/people/asha",
      "Pending Review",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("shows who decided, and no controls, once a request is decided", async () => {
    getAdminOrRedirect.mockResolvedValue(admin);
    getApiAsUser.mockResolvedValue({
      data: detail({
        status: "rejected",
        decided_at: "2026-10-05T09:00:00",
        decided_by: "Test Admin",
        decision_note: "Please add your institutional profile.",
        other_requests: [
          {
            id: "request-0",
            status: "rejected",
            created_at: "2026-09-01T10:00:00",
            decided_at: "2026-09-02T10:00:00",
            decided_by: "Test Admin",
            decision_note: null,
          },
        ],
      }),
      status: 200,
      detail: null,
    });

    render(
      await AdminResearcherRequestPage({ params: Promise.resolve({ id: "request-1" }) }),
    );

    expect(screen.getByText("Test Admin")).toBeTruthy();
    expect(screen.getByText("Please add your institutional profile.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    // The earlier decision stays visible.
    expect(linkTo("/admin/researcher-requests/request-0")).toBeTruthy();
  });

  it("approves only after the decision is confirmed", async () => {
    postApi.mockResolvedValue({ data: detail({ status: "approved" }), status: 200, detail: null });
    render(<ResearcherDecision applicantName="Asha Rao" requestId="request-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/Approve this request\? Asha Rao becomes a Researcher/)).toBeTruthy();
    expect(postApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(postApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(postApi).toHaveBeenCalledTimes(1);
    expect(postApi).toHaveBeenCalledWith("/api/admin/researcher-requests/request-1/approve", {
      note: null,
    });
  });

  it("rejects with an optional note for the applicant", async () => {
    postApi.mockResolvedValue({ data: detail({ status: "rejected" }), status: 200, detail: null });
    render(<ResearcherDecision applicantName="Asha Rao" requestId="request-1" />);

    fill(/^Note for the applicant/, "  Please add your institutional profile.  ");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText(/Reject this request\? Asha Rao stays a General User/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Rejection" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(postApi).toHaveBeenCalledWith("/api/admin/researcher-requests/request-1/reject", {
      note: "Please add your institutional profile.",
    });
  });

  it("shows a saving state and sends one decision", async () => {
    let finish: (value: unknown) => void = () => {};
    postApi.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ResearcherDecision applicantName="Asha Rao" requestId="request-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const confirm = screen.getByRole("button", { name: "Confirm Approval" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    const saving = await screen.findByRole("button", { name: "Saving the decision…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Saving the decision…");
    expect(postApi).toHaveBeenCalledTimes(1);

    finish({ data: detail({ status: "approved" }), status: 200, detail: null });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("explains a decision the API refuses and offers the controls again", async () => {
    postApi.mockResolvedValue({
      data: null,
      status: 409,
      detail: "This request was already approved.",
    });
    render(<ResearcherDecision applicantName="Asha Rao" requestId="request-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Rejection" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("This request was already approved."),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

    postApi.mockResolvedValue({ data: null, status: 500, detail: "Traceback (most recent call last)" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Rejection" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "The decision could not be saved. Please try again.",
      ),
    );
    expect(document.body.textContent).not.toContain("Traceback");
  });
});

describe("Research Workspace", () => {
  const submissions: SubmissionItem[] = [
    {
      type: "document",
      id: "doc-1",
      title: "Prototype Field Notes",
      file_type: "txt",
      verification_status: "uploaded",
      created_at: "2026-10-04T10:00:00",
      href: "/documents/doc-1",
    },
    {
      type: "dataset",
      id: "data-1",
      title: "Prototype Sample Table",
      file_type: "csv",
      verification_status: "verified",
      created_at: "2026-10-03T10:00:00",
      href: "/datasets/data-1",
    },
  ];

  it("is closed to an account without researcher access", async () => {
    getResearcherOrRedirect.mockResolvedValue(null);

    render(await ResearchWorkspacePage());

    expect(getResearcherOrRedirect).toHaveBeenCalledWith("/researcher");
    expect(screen.getByText(/available to approved researchers/)).toBeTruthy();
    expect(linkTo("/account/researcher-access")).toBeTruthy();
    expect(linkTo("/researcher/submit/document")).toBeUndefined();
    expect(getApiAsUser).not.toHaveBeenCalled();
  });

  it("shows a researcher their status, the two actions and their own submissions", async () => {
    getResearcherOrRedirect.mockResolvedValue(account("researcher"));
    getApiAsUser.mockResolvedValue({ data: submissions, status: 200, detail: null });

    render(await ResearchWorkspacePage());

    expect(getApiAsUser).toHaveBeenCalledWith("/api/researcher/submissions");
    expect(screen.getByRole("heading", { level: 1, name: "Research Workspace" })).toBeTruthy();
    expect(screen.getByText("Account type: Researcher")).toBeTruthy();
    expect(linkTo("/researcher/submit/document")).toBeTruthy();
    expect(linkTo("/researcher/submit/dataset")).toBeTruthy();

    const items = screen.getAllByRole("listitem").filter((item) => item.querySelector("h3"));
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      "Prototype Field Notes",
      "Prototype Sample Table",
    ]);
    // Each submission carries its verification status in words.
    expect(within(items[0]).getByText("Uploaded")).toBeTruthy();
    expect(within(items[1]).getByText("Verified")).toBeTruthy();
    expect(linkTo("/documents/doc-1")).toBeTruthy();
    expect(linkTo("/datasets/data-1")).toBeTruthy();
  });

  it("says so when nothing has been submitted yet", async () => {
    getResearcherOrRedirect.mockResolvedValue(account("researcher"));
    getApiAsUser.mockResolvedValue({ data: [], status: 200, detail: null });

    render(await ResearchWorkspacePage());

    expect(screen.getByText("You have not submitted anything yet.")).toBeTruthy();
  });

  it("offers the workspace in the account menu only with researcher access", () => {
    for (const role of ["researcher", "admin"] as const) {
      render(
        <AuthProvider user={account(role)}>
          <AccountMenu />
        </AuthProvider>,
      );
      expect(linkTo("/researcher")?.textContent).toBe("Research Workspace");
      expect(linkTo("/account/researcher-access")).toBeUndefined();
      cleanup();
    }

    render(
      <AuthProvider user={account("user")}>
        <AccountMenu />
      </AuthProvider>,
    );
    expect(linkTo("/researcher")).toBeUndefined();
    expect(linkTo("/account/researcher-access")?.textContent).toBe("Researcher Access");
  });
});

describe("submission form", () => {
  const expeditions = [{ id: "expedition-1", name: "Demo Sea Ice Observation Expedition" }];
  const topics = [{ id: "topic-1", name: "Demo Sea Ice" }];
  const saved: SubmissionItem = {
    type: "document",
    id: "doc-1",
    title: "Prototype Field Notes",
    file_type: "txt",
    verification_status: "uploaded",
    created_at: "2026-10-04T10:00:00",
    href: "/documents/doc-1",
  };

  function choose(file: File) {
    fireEvent.change(screen.getByLabelText("File"), { target: { files: [file] } });
  }

  function fileError(): string | null {
    const id = screen.getByLabelText("File").getAttribute("aria-describedby");
    return id?.endsWith("-error") ? (document.getElementById(id)?.textContent ?? null) : null;
  }

  function sentForm(): Record<string, FormDataEntryValue> {
    return Object.fromEntries((postForm.mock.calls[0][1] as FormData).entries());
  }

  it("checks the title, the type and the file before sending", () => {
    render(<SubmissionForm expeditions={expeditions} kind="document" />);

    fireEvent.click(screen.getByRole("button", { name: "Submit Document" }));
    expect(screen.getByText("Enter a title of at least 3 characters.")).toBeTruthy();
    expect(screen.getByText("Select the document type.")).toBeTruthy();
    expect(fileError()).toBe("Choose a PDF or TXT file.");

    choose(new File(["x"], "notes.docx"));
    expect(fileError()).toBe("Only PDF or TXT files can be submitted.");
    choose(new File([], "notes.txt"));
    expect(fileError()).toBe("The file is empty.");
    const large = new File(["x"], "notes.pdf");
    Object.defineProperty(large, "size", { value: 20 * 1024 * 1024 + 1 });
    choose(large);
    expect(fileError()).toBe("The file is larger than 20 MB.");

    fill(/^Source URL/, "example.org/notes");
    expect(
      screen.getByText("Enter a full web address that starts with http:// or https://."),
    ).toBeTruthy();
    expect(postForm).not.toHaveBeenCalled();
  });

  it("submits a document and shows it as Uploaded", async () => {
    postForm.mockResolvedValue({ data: saved, status: 201, detail: null });
    render(<SubmissionForm expeditions={expeditions} kind="document" />);

    fill("Title", "  Prototype Field Notes ");
    fill("Document Type", "field_notes");
    choose(new File(["Prototype text."], "notes.txt", { type: "text/plain" }));
    fill(/^Related Expedition/, "expedition-1");
    fill(/^Source URL/, "https://example.org/notes");
    fireEvent.click(screen.getByRole("button", { name: "Submit Document" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Your document was submitted." })).toBeTruthy(),
    );
    expect(postForm).toHaveBeenCalledTimes(1);
    expect(postForm.mock.calls[0][0]).toBe("/api/researcher/documents");
    const sent = sentForm();
    // The status and the submitter are never chosen in the form.
    expect(Object.keys(sent).sort()).toEqual([
      "document_type",
      "expedition_id",
      "file",
      "source_url",
      "title",
    ]);
    expect(sent.title).toBe("Prototype Field Notes");
    expect(sent.document_type).toBe("field_notes");
    expect((sent.file as File).name).toBe("notes.txt");

    expect(within(screen.getByRole("status")).getByText("Uploaded")).toBeTruthy();
    expect(screen.getByText(/Only|before it can be marked Reviewed or Verified/)).toBeTruthy();
    expect(linkTo("/documents/doc-1")).toBeTruthy();
    expect(linkTo("/researcher")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("submits a dataset with its own fields", async () => {
    postForm.mockResolvedValue({
      data: { ...saved, type: "dataset", id: "data-1", file_type: "csv", href: "/datasets/data-1" },
      status: 201,
      detail: null,
    });
    render(<SubmissionForm expeditions={expeditions} kind="dataset" topics={topics} />);

    expect(screen.queryByLabelText("Document Type")).toBeNull();
    fill("Title", "Prototype Sample Table");
    fill(/^Description/, "Three prototype rows.");
    choose(new File(["a,b\n1,2\n"], "samples.csv", { type: "text/csv" }));
    fill(/^Research Topic/, "topic-1");
    fireEvent.click(screen.getByRole("button", { name: "Submit Dataset" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Your dataset was submitted." })).toBeTruthy(),
    );
    expect(postForm.mock.calls[0][0]).toBe("/api/researcher/datasets");
    expect(Object.keys(sentForm()).sort()).toEqual(["description", "file", "title", "topic_id"]);
    expect(linkTo("/datasets/data-1")).toBeTruthy();
  });

  it("refuses a dataset file of the wrong type or size", () => {
    render(<SubmissionForm expeditions={[]} kind="dataset" />);

    fill("Title", "Prototype Sample Table");
    choose(new File(["x"], "samples.xlsx"));
    fireEvent.click(screen.getByRole("button", { name: "Submit Dataset" }));
    expect(fileError()).toBe("Only CSV or JSON files can be submitted.");

    const large = new File(["x"], "samples.csv");
    Object.defineProperty(large, "size", { value: 5 * 1024 * 1024 + 1 });
    choose(large);
    expect(fileError()).toBe("The file is larger than 5 MB.");
    expect(postForm).not.toHaveBeenCalled();
  });

  it("shows why the API refused a submission and keeps the form", async () => {
    postForm.mockResolvedValue({
      data: null,
      status: 409,
      detail: "This document is already in the repository.",
    });
    render(<SubmissionForm expeditions={[]} kind="document" />);

    fill("Title", "Prototype Field Notes");
    fill("Document Type", "report");
    choose(new File(["Prototype text."], "notes.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Submit Document" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "This document is already in the repository.",
      ),
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Prototype Field Notes",
    );

    postForm.mockResolvedValue({ data: null, status: 500, detail: "Internal Server Error" });
    fireEvent.click(screen.getByRole("button", { name: "Submit Document" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "We could not submit this document right now. Please try again.",
      ),
    );
  });

  it("sends one submission while the first is still on its way", async () => {
    let finish: (value: unknown) => void = () => {};
    postForm.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<SubmissionForm expeditions={[]} kind="document" />);

    fill("Title", "Prototype Field Notes");
    fill("Document Type", "report");
    choose(new File(["Prototype text."], "notes.txt"));
    const form = screen.getByRole("button", { name: "Submit Document" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    const button = await screen.findByRole("button", { name: "Submitting…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(postForm).toHaveBeenCalledTimes(1);

    finish({ data: saved, status: 201, detail: null });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Your document was submitted." })).toBeTruthy(),
    );
  });
});
