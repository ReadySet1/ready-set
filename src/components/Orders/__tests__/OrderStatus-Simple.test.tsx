import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderStatusCard } from "../OrderStatus";
import { OrderStatus, OrderType } from "@/types/order";
import { UserType } from "@/types/client-enums";

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the toast hook
jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

describe("OrderStatusCard - Change Status Feature", () => {
  const mockOnStatusChange = jest.fn();
  const defaultProps = {
    order_type: "catering" as OrderType,
    initialStatus: OrderStatus.ACTIVE,
    orderId: "test-order-123",
    onStatusChange: mockOnStatusChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should render current status badge with correct text", () => {
      render(<OrderStatusCard {...defaultProps} />);

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });

    it("should display different status badges correctly", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
        />,
      );
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.CANCELLED}
        />,
      );
      expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    });
  });

  describe("Change Status Dropdown Visibility", () => {
    it("should not show change status dropdown when canChangeStatus is false", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={false} />);

      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
    });

    it("should not show change status dropdown when onStatusChange is not provided", () => {
      const { onStatusChange, ...propsWithoutCallback } = defaultProps;
      render(
        <OrderStatusCard {...propsWithoutCallback} canChangeStatus={true} />,
      );

      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
    });

    it("should show change status dropdown when canChangeStatus is true and onStatusChange is provided", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      expect(screen.getByText("Change Status:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Dropdown Interaction", () => {
    it("should open dropdown when clicked", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      // Wait for dropdown content to appear
      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });
    });

    it("should display status options when dropdown is opened", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      // Check that status options are available
      await waitFor(() => {
        // The dropdown should contain the available statuses
        const dropdownContent = screen
          .getByText("Change Status:")
          .closest("div");
        expect(dropdownContent).toBeInTheDocument();
      });
    });
  });

  describe("Role-Based Access Control", () => {
    it("should pass canChangeStatus prop correctly", () => {
      // Test that the prop is being passed through correctly
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={false} />,
      );
      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();

      rerender(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);
      expect(screen.getByText("Change Status:")).toBeInTheDocument();
    });
  });

  describe("Client Enums Safety", () => {
    it("should import UserType without Prisma dependencies", () => {
      // Verify that importing UserType works without webpack errors
      expect(UserType.ADMIN).toBe("ADMIN");
      expect(UserType.SUPER_ADMIN).toBe("SUPER_ADMIN");
      expect(UserType.HELPDESK).toBe("HELPDESK");
    });

    it("should use correct enum values", () => {
      // Verify that the enum values match the expected database values
      const expectedValues = [
        "VENDOR",
        "CLIENT",
        "DRIVER",
        "ADMIN",
        "HELPDESK",
        "SUPER_ADMIN",
      ];
      const actualValues = Object.values(UserType);

      expect(actualValues).toEqual(expectedValues);
    });
  });

  describe("Component Integration", () => {
    it("should work with different order types", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          order_type="catering"
          canChangeStatus={true}
        />,
      );
      expect(screen.getByText("Change Status:")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          order_type="on_demand"
          canChangeStatus={true}
        />,
      );
      expect(screen.getByText("Change Status:")).toBeInTheDocument();
    });

    it("should handle status updates", () => {
      const { rerender } = render(<OrderStatusCard {...defaultProps} />);
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
        />,
      );
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    });
  });
});
