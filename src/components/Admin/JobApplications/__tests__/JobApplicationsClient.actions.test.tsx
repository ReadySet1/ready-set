import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/job-applications",
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "token" } },
      }),
    },
  }),
}));

jest.mock("@/app/actions/admin/job-applications", () => ({
  approveJobApplication: jest.fn(),
  deleteJobApplication: jest.fn(),
}));

jest.mock("@/components/ui/use-toast", () => ({ toast: jest.fn() }));

jest.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { PieChart: Stub, Pie: Stub, Cell: Stub, ResponsiveContainer: Stub, Tooltip: Stub };
});

jest.mock("../ApplicationDetailDialog", () => ({
  ApplicationDetailDialog: () => null,
}));

import JobApplicationsClient from "../JobApplicationsClient";
import { approveJobApplication } from "@/app/actions/admin/job-applications";
import { toast } from "@/components/ui/use-toast";

const mockToast = toast as jest.Mock;
const mockApprove = approveJobApplication as jest.Mock;

const stats = {
  totalApplications: 1,
  pendingApplications: 1,
  approvedApplications: 0,
  rejectedApplications: 0,
  interviewingApplications: 0,
  applicationsByPosition: {},
  recentApplications: [],
};

function makeApplication(id: string, firstName: string) {
  return {
    id,
    firstName,
    lastName: "Tester",
    email: `${firstName.toLowerCase()}@example.com`,
    phone: null,
    position: "Driver for Catering Deliveries",
    addressStreet: "1 Main St",
    addressCity: "San Francisco",
    addressState: "CA",
    addressZip: "94103",
    status: "PENDING",
    createdAt: "2026-09-23T10:00:00Z",
    fileUploads: [],
  };
}

const listedApp = makeApplication("app-1", "Pat");
const exportedApps = [makeApplication("exp-1", "Ann"), makeApplication("exp-2", "Bo")];

type Route = (url: URL, init?: RequestInit) => Response | undefined;

/** Routes stats + list calls; `override` can intercept any request first. */
function mockFetch(override?: Route) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const overridden = override?.(url, init);
    if (overridden) return overridden;
    if (url.pathname.endsWith("/stats")) {
      return new Response(JSON.stringify(stats), { status: 200 });
    }
    const applications = url.searchParams.get("limit") === "1000" ? exportedApps : [listedApp];
    return new Response(
      JSON.stringify({ applications, totalPages: 1, totalCount: applications.length }),
      { status: 200 },
    );
  }) as jest.Mock;
}

function fetchCallsTo(pathname: string) {
  return (global.fetch as jest.Mock).mock.calls.filter(
    ([input]) => new URL(String(input), "http://localhost").pathname === pathname,
  );
}

async function renderLoaded() {
  const user = userEvent.setup();
  render(<JobApplicationsClient userType="admin" />);
  await screen.findByText("Pat Tester");
  return user;
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = document.querySelector<HTMLElement>('button[aria-haspopup="menu"]');
  if (!trigger) throw new Error("row menu trigger not found");
  await user.click(trigger);
}

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch();
  // The error paths log on purpose; keep the test output readable.
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("JobApplicationsClient CSV export", () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;
  let clickSpy: jest.SpyInstance;
  let downloads: string[];

  beforeEach(() => {
    downloads = [];
    createObjectURL = jest.fn(() => "blob:mock-url");
    revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.getAttribute("download") ?? "");
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("requests every application with the auth header and downloads a dated CSV", async () => {
    const user = await renderLoaded();

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Exported 2 applications to CSV",
        variant: "default",
      }),
    );

    const exportCall = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
      String(input).includes("limit=1000"),
    );
    expect(exportCall).toBeDefined();
    const [input, init] = exportCall!;
    const url = new URL(String(input), "http://localhost");
    expect(url.pathname).toBe("/api/admin/job-applications");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "1000",
      search: "",
      status: "",
      position: "",
    });
    expect(init).toEqual({ headers: { Authorization: "Bearer token" } });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^job-applications-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("shows an error toast and downloads nothing when the export request fails", async () => {
    mockFetch((url) =>
      url.searchParams.get("limit") === "1000"
        ? new Response(JSON.stringify({ error: "nope" }), { status: 500 })
        : undefined,
    );
    const user = await renderLoaded();

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to fetch applications for export",
        variant: "destructive",
      }),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
  });
});

describe("JobApplicationsClient row status menu", () => {
  it("approves through the server action and marks the row APPROVED", async () => {
    mockApprove.mockResolvedValue({ message: "Application approved and profile created." });
    const user = await renderLoaded();

    await openRowMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /approve/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Application approved and profile created.",
        variant: "default",
      }),
    );
    expect(mockApprove).toHaveBeenCalledWith("app-1");
    expect(fetchCallsTo("/api/admin/job-applications/app-1/status")).toHaveLength(0);
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("shows an error toast and keeps the row PENDING when approval fails", async () => {
    mockApprove.mockRejectedValue(new Error("Approval blocked"));
    const user = await renderLoaded();

    await openRowMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /approve/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Approval blocked",
        variant: "destructive",
      }),
    );
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("PATCHes the status endpoint when rejecting and shows the server's status", async () => {
    mockFetch((url, init) =>
      url.pathname === "/api/admin/job-applications/app-1/status"
        ? new Response(
            JSON.stringify({
              success: true,
              application: { ...listedApp, status: JSON.parse(String(init?.body)).status },
            }),
            { status: 200 },
          )
        : undefined,
    );
    const user = await renderLoaded();

    await openRowMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /reject/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Application status updated to REJECTED",
        variant: "default",
      }),
    );
    const patchCalls = fetchCallsTo("/api/admin/job-applications/app-1/status");
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0][1]).toEqual({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
  });

  it("surfaces the API error and keeps the row PENDING when the PATCH fails", async () => {
    mockFetch((url) =>
      url.pathname === "/api/admin/job-applications/app-1/status"
        ? new Response(JSON.stringify({ error: "Invalid transition" }), { status: 400 })
        : undefined,
    );
    const user = await renderLoaded();

    await openRowMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /reject/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Invalid transition",
        variant: "destructive",
      }),
    );
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });
});
