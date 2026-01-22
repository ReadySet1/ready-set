import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock Dialog components
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogFooter: ({ children }: any) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogDescription: ({ children }: any) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

// Mock Table components
jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

// Mock Pagination components
jest.mock("@/components/ui/pagination", () => ({
  Pagination: ({ children }: any) => <nav>{children}</nav>,
  PaginationContent: ({ children }: any) => <ul>{children}</ul>,
  PaginationItem: ({ children }: any) => <li>{children}</li>,
  PaginationLink: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  PaginationNext: ({ onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      Next
    </button>
  ),
  PaginationPrevious: ({ onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      Previous
    </button>
  ),
}));

// Mock Avatar components
jest.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  AvatarFallback: ({ children, className }: any) => (
    <span className={className}>{children}</span>
  ),
}));

// Mock ScrollArea
jest.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

// Mock lib/utils
jest.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("OnDemand Driver Assignment Dialog", () => {
  const mockDrivers = [
    {
      id: "driver-ondemand-1",
      name: "Maria Rodriguez",
      email: "maria@example.com",
      contactNumber: "5551234567",
    },
    {
      id: "driver-ondemand-2",
      name: "Carlos Mendez",
      email: "carlos@example.com",
      contactNumber: "5559876543",
    },
  ];

  const defaultProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    isDriverAssigned: false,
    drivers: mockDrivers,
    selectedDriver: null,
    onDriverSelection: jest.fn(),
    onAssignOrEditDriver: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render dialog with on-demand order drivers", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Assign Driver",
    );
    // Verify drivers appear in both desktop and mobile views
    expect(
      screen.getAllByText("Maria Rodriguez").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Carlos Mendez").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should call onDriverSelection with correct driver id", async () => {
    const user = userEvent.setup();
    const mockOnDriverSelection = jest.fn();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        onDriverSelection={mockOnDriverSelection}
      />,
    );

    // Find all Select buttons and click one - the component renders both desktop and mobile views
    // so we verify the callback is called with one of the valid driver IDs
    const selectButtons = screen.getAllByText("Select");
    await user.click(selectButtons[0]);

    // Verify onDriverSelection was called with a valid driver ID
    expect(mockOnDriverSelection).toHaveBeenCalledTimes(1);
    const calledWithId = mockOnDriverSelection.mock.calls[0][0];
    expect(["driver-ondemand-1", "driver-ondemand-2"]).toContain(calledWithId);
  });

  it("should call onAssignOrEditDriver when assigning driver", async () => {
    const user = userEvent.setup();
    const mockOnAssignOrEditDriver = jest.fn().mockResolvedValue(undefined);

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        selectedDriver="driver-ondemand-1"
        onAssignOrEditDriver={mockOnAssignOrEditDriver}
      />,
    );

    const assignButton = screen.getByRole("button", { name: /assign driver/i });
    await user.click(assignButton);

    await waitFor(() => {
      expect(mockOnAssignOrEditDriver).toHaveBeenCalled();
    });
  });

  it("should filter drivers by search term", async () => {
    const user = userEvent.setup();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Both drivers visible initially
    expect(
      screen.getAllByText("Maria Rodriguez").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Carlos Mendez").length,
    ).toBeGreaterThanOrEqual(1);

    // Filter by name
    const searchInput = screen.getByPlaceholderText(
      "Search drivers by name or phone...",
    );
    await user.type(searchInput, "Maria");

    await waitFor(() => {
      expect(
        screen.getAllByText("Maria Rodriguez").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Carlos Mendez")).not.toBeInTheDocument();
    });
  });

  it("should filter drivers by phone number", async () => {
    const user = userEvent.setup();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Filter by phone number
    const searchInput = screen.getByPlaceholderText(
      "Search drivers by name or phone...",
    );
    await user.type(searchInput, "5559876543");

    await waitFor(() => {
      expect(
        screen.getAllByText("Carlos Mendez").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Maria Rodriguez")).not.toBeInTheDocument();
    });
  });

  it("should show no drivers message when none match search", async () => {
    const user = userEvent.setup();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Search for non-existent driver
    const searchInput = screen.getByPlaceholderText(
      "Search drivers by name or phone...",
    );
    await user.type(searchInput, "NonExistentDriver");

    await waitFor(() => {
      expect(screen.getByText("No drivers found")).toBeInTheDocument();
    });
  });

  it("should show selected driver info when driver is selected", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        selectedDriver="driver-ondemand-1"
      />,
    );

    expect(screen.getByText("Selected Driver")).toBeInTheDocument();
    expect(
      screen.getAllByText("Selected").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should disable assign button when no driver is selected", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog {...defaultProps} selectedDriver={null} />,
    );

    const assignButton = screen.getByRole("button", { name: /assign driver/i });
    expect(assignButton).toBeDisabled();
  });

  it("should show update title when editing existing assignment", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        isDriverAssigned={true}
        selectedDriver="driver-ondemand-1"
      />,
    );

    expect(screen.getByText("Update Driver Assignment")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select a different driver to update the current assignment.",
      ),
    ).toBeInTheDocument();
  });

  it("should close dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = jest.fn();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        onOpenChange={mockOnOpenChange}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should display driver phone numbers correctly", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Phone numbers appear in driver list
    expect(
      screen.getAllByText("5551234567").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("5559876543").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should show loading state while assigning driver", async () => {
    const user = userEvent.setup();
    // Create a promise that we can control
    let resolveAssignment: () => void;
    const assignmentPromise = new Promise<void>((resolve) => {
      resolveAssignment = resolve;
    });
    const mockOnAssignOrEditDriver = jest.fn(() => assignmentPromise);

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        selectedDriver="driver-ondemand-1"
        onAssignOrEditDriver={mockOnAssignOrEditDriver}
      />,
    );

    const assignButton = screen.getByRole("button", { name: /assign driver/i });
    await user.click(assignButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/assigning/i)).toBeInTheDocument();
    });

    // Resolve the assignment
    resolveAssignment!();

    await waitFor(() => {
      expect(mockOnAssignOrEditDriver).toHaveBeenCalled();
    });
  });

  it("should handle empty drivers list gracefully", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} drivers={[]} />);

    expect(screen.getByText("No drivers found")).toBeInTheDocument();
    expect(
      screen.getByText("There are no drivers available to assign."),
    ).toBeInTheDocument();
  });
});
