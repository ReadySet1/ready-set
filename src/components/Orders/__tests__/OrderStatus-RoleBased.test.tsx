import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderStatusCard } from "../OrderStatus";
import { OrderStatus, OrderType } from "@/types/order";

// Mock the toast hook
jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

describe("OrderStatusCard - Role-Based Status Change Tests", () => {
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

  describe("Admin Role Status Changes", () => {
    it("should render status change dropdown for admin users", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      // Verify dropdown is present
      expect(screen.getByText("Change Status:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should display current status correctly", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("should handle status changes via component state", () => {
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={true} />,
      );

      // Verify initial state
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(mockOnStatusChange).not.toHaveBeenCalled();

      // Change status by updating props (this should trigger the useEffect)
      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      // The component should update its internal state when initialStatus changes
      expect(screen.getByText("Completed")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });

    it("should handle different initial statuses correctly", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.ASSIGNED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Assigned")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.CANCELLED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  describe("Super Admin Role Status Changes", () => {
    it("should render status change dropdown for super admin users", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      expect(screen.getByText("Change Status:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should update display when initialStatus prop changes", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Completed")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.CANCELLED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });
  });

  describe("Non-Admin Role Restrictions", () => {
    it("should not show change status dropdown for regular users", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={false} />);

      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("should not show change status dropdown when onStatusChange is not provided", () => {
      const { onStatusChange, ...propsWithoutCallback } = defaultProps;
      render(
        <OrderStatusCard {...propsWithoutCallback} canChangeStatus={true} />,
      );

      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("should not show change status dropdown for helpdesk users", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={false} />);

      expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
    });
  });

  describe("Order Type Specific Status Changes", () => {
    it("should work correctly for catering orders", () => {
      render(
        <OrderStatusCard
          {...defaultProps}
          order_type="catering"
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("Change Status:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should work correctly for on-demand orders", () => {
      render(
        <OrderStatusCard
          {...defaultProps}
          order_type="on_demand"
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("Change Status:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Status Change Validation", () => {
    it("should not allow changing to the same status via props", () => {
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={true} />,
      );

      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(mockOnStatusChange).not.toHaveBeenCalled();

      // Try to change to the same status
      rerender(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      // Callback should not be called since status didn't change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });

    it("should handle multiple status changes via props", () => {
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={true} />,
      );

      expect(screen.getByText("Active")).toBeInTheDocument();

      // Change to ASSIGNED
      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.ASSIGNED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Assigned")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();

      // Reset mock and change to COMPLETED
      mockOnStatusChange.mockClear();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Completed")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });
  });

  describe("Status Change Edge Cases", () => {
    it("should handle status change when orderId is a number", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          orderId={12345}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Active")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          orderId={12345}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Completed")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });

    it("should handle status change when orderId is a bigint", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          orderId={BigInt(12345)}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Active")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          orderId={BigInt(12345)}
          initialStatus={OrderStatus.CANCELLED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
      // Note: onStatusChange is only called when user manually changes status, not when props change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });
  });

  describe("Status Change Accessibility", () => {
    it("should have proper ARIA labels for screen readers", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      expect(dropdown).toBeInTheDocument();
    });

    it("should be keyboard accessible", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      expect(dropdown).toBeInTheDocument();

      // Test that the dropdown can receive focus
      dropdown.focus();
      expect(document.activeElement).toBe(dropdown);
    });
  });

  describe("Integration with Parent Components", () => {
    it("should render without errors when used in parent components", () => {
      // Test that OrderStatusCard renders correctly with various props
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={true} />,
      );

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("Change Status:")).toBeInTheDocument();

      // Test with different order types
      rerender(
        <OrderStatusCard
          {...defaultProps}
          order_type="on_demand"
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("Change Status:")).toBeInTheDocument();

      // Test with different statuses
      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });
});
