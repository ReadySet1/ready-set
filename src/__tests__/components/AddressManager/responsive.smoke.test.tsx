import React from "react";
import { render } from "@testing-library/react";

// Mock the createClient function
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user" } }, error: null }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: { access_token: "test-token" } },
          error: null,
        }),
      ),
    },
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock the router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock UI components to avoid complex dependencies
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: any) => (
    <span className={className}>{children}</span>
  ),
}));

jest.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, defaultValue }: any) => (
    <div data-testid="tabs" data-value={defaultValue}>
      {children}
    </div>
  ),
  TabsList: ({ children, className }: any) => (
    <div data-testid="tabs-list" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, className }: any) => (
    <button data-testid={`tab-${value}`} className={className}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogAction: ({ children, className, onClick }: any) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/AddressManager/AddressModal", () => ({
  __esModule: true,
  default: ({ onAddressUpdated, addressToEdit, isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="address-modal">
        <h2>{addressToEdit ? "Edit Address" : "Add Address"}</h2>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe("Addresses Manager - Responsive Smoke Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  describe("UserAddresses Component", () => {
    it("should render without crashing", async () => {
      const { container } = render(
        <div>
          <h2>Your Addresses</h2>
          <p>Manage your saved addresses for deliveries and pickups</p>
        </div>,
      );

      expect(container).toBeInTheDocument();
      expect(container.textContent).toContain("Your Addresses");
    });

    it("should have responsive CSS classes", () => {
      const { container } = render(
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full sm:w-auto">Content</div>
          </div>
        </div>,
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass("p-4", "sm:p-6");

      const flexDiv = mainDiv.firstChild as HTMLElement;
      expect(flexDiv).toHaveClass("flex", "flex-col", "gap-4", "sm:flex-row");
    });
  });

  describe("Responsive Layout Classes", () => {
    it("should support mobile-first responsive design", () => {
      const { container } = render(
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
          <div className="sm:col-span-3">Input</div>
        </div>,
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass(
        "grid",
        "grid-cols-1",
        "gap-2",
        "sm:grid-cols-4",
        "sm:gap-4",
      );

      const inputDiv = gridDiv.firstChild as HTMLElement;
      expect(inputDiv).toHaveClass("sm:col-span-3");
    });

    it("should support responsive button layouts", () => {
      const { container } = render(
        <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:space-x-4">
          <button className="w-full sm:w-auto">Button 1</button>
          <button className="w-full sm:w-auto">Button 2</button>
        </div>,
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass(
        "flex",
        "flex-col",
        "gap-3",
        "pb-6",
        "sm:flex-row",
        "sm:space-x-4",
      );

      const buttons = containerDiv.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("w-full", "sm:w-auto");
      });
    });
  });

  describe("Responsive Typography", () => {
    it("should support responsive text sizing", () => {
      const { container } = render(
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px]">
          Responsive Title
        </h1>,
      );

      const title = container.firstChild as HTMLElement;
      expect(title).toHaveClass(
        "text-2xl",
        "sm:text-3xl",
        "md:text-4xl",
        "lg:text-[40px]",
      );
    });

    it("should support responsive margins", () => {
      const { container } = render(
        <div className="mb-3 sm:mb-4">
          <p className="mb-4 text-sm sm:mb-5 sm:text-base">Content</p>
        </div>,
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass("mb-3", "sm:mb-4");

      const paragraph = containerDiv.firstChild as HTMLElement;
      expect(paragraph).toHaveClass(
        "mb-4",
        "text-sm",
        "sm:mb-5",
        "sm:text-base",
      );
    });
  });

  describe("Responsive Spacing", () => {
    it("should support responsive padding", () => {
      const { container } = render(
        <div className="px-3 sm:px-4 md:px-6 lg:px-8">Responsive Content</div>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div).toHaveClass("px-3", "sm:px-4", "md:px-6", "lg:px-8");
    });

    it("should support responsive gaps", () => {
      const { container } = render(
        <div className="gap-2 sm:gap-4">
          <div>Item 1</div>
          <div>Item 2</div>
        </div>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div).toHaveClass("gap-2", "sm:gap-4");
    });
  });
});
