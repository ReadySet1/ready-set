import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const replace = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
  useSearchParams: () => searchParams,
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
  ApplicationDetailDialog: ({ application, open, onClose }: any) =>
    open && application ? (
      <div role="dialog">
        {application.firstName} {application.lastName}
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

import JobApplicationsClient from "../JobApplicationsClient";

const deepLinked = {
  id: "app-42",
  firstName: "Deep",
  lastName: "Linked",
  email: "deep@example.com",
  position: "Driver",
  status: "PENDING",
  createdAt: "2026-09-23T10:00:00Z",
  fileUploads: [],
};

function mockFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname.endsWith("/stats")) {
      return new Response(JSON.stringify({ totalApplications: 0 }), { status: 200 });
    }
    const applications = url.searchParams.get("id") === "app-42" ? [deepLinked] : [];
    return new Response(
      JSON.stringify({ applications, totalPages: 1, totalCount: applications.length }),
      { status: 200 },
    );
  }) as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch();
});

describe("JobApplicationsClient deep link", () => {
  it("opens the application named by ?id= even when it is not on the current page", async () => {
    searchParams = new URLSearchParams("id=app-42");

    render(<JobApplicationsClient userType="admin" />);

    expect(await screen.findByRole("dialog")).toHaveTextContent("Deep Linked");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("id=app-42"),
      expect.anything(),
    );
  });

  it("drops ?id= from the URL when the dialog is closed", async () => {
    searchParams = new URLSearchParams("id=app-42");

    render(<JobApplicationsClient userType="admin" />);
    (await screen.findByText("close")).click();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/job-applications"));
  });

  it("opens nothing without ?id=", async () => {
    searchParams = new URLSearchParams();

    render(<JobApplicationsClient userType="admin" />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
