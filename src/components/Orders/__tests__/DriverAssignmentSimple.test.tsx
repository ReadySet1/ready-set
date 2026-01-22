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

describe("Driver Assignment Dialog", () => {
  // Drivers in non-alphabetical order to test sorting
  const mockDrivers = [
    {
      id: "driver-1",
      name: "Maria Rodriguez",
      email: "maria@example.com",
      contactNumber: "5559876543",
    },
    {
      id: "driver-2",
      name: "David Sanchez",
      email: "david@example.com",
      contactNumber: "5551234567",
    },
    {
      id: "driver-3",
      name: "Ana Garcia",
      email: "ana@example.com",
      contactNumber: "5551112222",
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

  it("should render dialog when open", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Assign Driver");
    expect(
      screen.getByText("Select a driver to assign to this order."),
    ).toBeInTheDocument();
  });

  it("should not render dialog when closed", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("should display available drivers", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Driver names appear in both desktop table and mobile cards
    expect(screen.getAllByText("David Sanchez").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Maria Rodriguez").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ana Garcia").length).toBeGreaterThanOrEqual(1);
  });

  it("should sort drivers alphabetically by name (A-Z)", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Get all driver name elements - they appear in desktop table
    const driverNames = screen
      .getAllByText(/Ana Garcia|David Sanchez|Maria Rodriguez/)
      .filter((el) => el.closest("td")); // Filter to table cells only

    // Should be sorted alphabetically: Ana, David, Maria
    expect(driverNames.length).toBeGreaterThanOrEqual(3);

    // Check that names appear in alphabetical order by getting text content
    const names = driverNames.map((el) => el.textContent);
    const sortedNames = [...names].sort((a, b) =>
      (a || "").localeCompare(b || ""),
    );
    expect(names).toEqual(sortedNames);
  });

  it("should call onDriverSelection when driver is selected", async () => {
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

    // Click the Select button for the first driver (Ana Garcia after sorting)
    const selectButtons = screen.getAllByText("Select");
    await user.click(selectButtons[0]);

    // First driver alphabetically is Ana Garcia (driver-3)
    expect(mockOnDriverSelection).toHaveBeenCalledWith("driver-3");
  });

  it("should show selected state when driver is selected", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog {...defaultProps} selectedDriver="driver-1" />,
    );

    // Should show "Selected" text and "Selected Driver" label
    // "Selected" appears multiple times (in buttons and badges)
    expect(screen.getAllByText("Selected").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Selected Driver")).toBeInTheDocument();
  });

  it("should call onAssignOrEditDriver when assign button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnAssignOrEditDriver = jest.fn().mockResolvedValue(undefined);

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog
        {...defaultProps}
        selectedDriver="driver-1"
        onAssignOrEditDriver={mockOnAssignOrEditDriver}
      />,
    );

    // Find and click the assign button in the footer
    const assignButton = screen.getByRole("button", { name: /assign driver/i });
    await user.click(assignButton);

    await waitFor(() => {
      expect(mockOnAssignOrEditDriver).toHaveBeenCalled();
    });
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

  it("should show update title when driver is already assigned", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(
      <DriverAssignmentDialog {...defaultProps} isDriverAssigned={true} />,
    );

    expect(screen.getByText("Update Driver Assignment")).toBeInTheDocument();
  });

  it("should filter drivers by search term", async () => {
    const user = userEvent.setup();

    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // All drivers should be visible initially (appear in both desktop and mobile views)
    expect(screen.getAllByText("David Sanchez").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Maria Rodriguez").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ana Garcia").length).toBeGreaterThanOrEqual(1);

    // Type in search
    const searchInput = screen.getByPlaceholderText(
      "Search drivers by name or phone...",
    );
    await user.type(searchInput, "David");

    // Only David should be visible after filtering
    await waitFor(() => {
      expect(screen.getAllByText("David Sanchez").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Maria Rodriguez")).not.toBeInTheDocument();
      expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument();
    });
  });

  it("should not display Status column", async () => {
    const { default: DriverAssignmentDialog } = await import(
      "@/components/Orders/ui/DriverAssignmentDialog"
    );

    render(<DriverAssignmentDialog {...defaultProps} />);

    // Status column should not be present - only Driver and Action columns
    const headers = screen.getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain("Driver");
    expect(headerTexts).toContain("Action");
    expect(headerTexts).not.toContain("Status");
  });

  it("should call onOpenChange when cancel is clicked", async () => {
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
});
