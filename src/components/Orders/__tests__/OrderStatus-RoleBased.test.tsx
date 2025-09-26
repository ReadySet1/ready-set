import React from "react";
import { render, screen } from "@testing-library/react";
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
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });

    it("should call onStatusChange when status is changed via props", () => {
      const { rerender } = render(
        <OrderStatusCard {...defaultProps} canChangeStatus={true} />,
      );

      // Verify initial state
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      expect(mockOnStatusChange).not.toHaveBeenCalled();

      // Change status by updating props
      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      // Verify callback was called (this happens in the component's useEffect)
      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);
    });

    it("should handle different initial statuses correctly", () => {
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.ASSIGNED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("ASSIGNED")).toBeInTheDocument();

      rerender(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.CANCELLED}
          canChangeStatus={true}
        />,
      );

      expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    });
  });

  describe("Super Admin Role Status Changes", () => {
    it("should allow super admin users to change status from ACTIVE to COMPLETED", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });

      const completedOption = screen.getByText("completed");
      await user.click(completedOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);

      await waitFor(() => {
        expect(screen.getByText("COMPLETED")).toBeInTheDocument();
      });
    });

    it("should allow super admin users to change status from COMPLETED to CANCELLED", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <OrderStatusCard
          {...defaultProps}
          initialStatus={OrderStatus.COMPLETED}
          canChangeStatus={true}
        />,
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("cancelled")).toBeInTheDocument();
      });

      const cancelledOption = screen.getByText("cancelled");
      await user.click(cancelledOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.CANCELLED);

      await waitFor(() => {
        expect(screen.getByText("CANCELLED")).toBeInTheDocument();
      });
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
    it("should work correctly for catering orders", async () => {
      const user = userEvent.setup();
      render(
        <OrderStatusCard
          {...defaultProps}
          order_type="catering"
          canChangeStatus={true}
        />,
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });

      const completedOption = screen.getByText("completed");
      await user.click(completedOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);
    });

    it("should work correctly for on-demand orders", async () => {
      const user = userEvent.setup();
      render(
        <OrderStatusCard
          {...defaultProps}
          order_type="on_demand"
          canChangeStatus={true}
        />,
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });

      const completedOption = screen.getByText("completed");
      await user.click(completedOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);
    });
  });

  describe("Status Change Validation", () => {
    it("should not allow changing to the same status", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      // Try to select the same status (ACTIVE)
      await waitFor(() => {
        expect(screen.getByText("active")).toBeInTheDocument();
      });

      const activeOption = screen.getByText("active");
      await user.click(activeOption);

      // Callback should not be called since status didn't change
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });

    it("should handle rapid status changes correctly", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");

      // Rapidly change status multiple times
      await user.click(dropdown);
      await waitFor(() => {
        expect(screen.getByText("assigned")).toBeInTheDocument();
      });
      await user.click(screen.getByText("assigned"));

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.ASSIGNED);

      // Change again quickly
      await user.click(dropdown);
      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });
      await user.click(screen.getByText("completed"));

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);
    });
  });

  describe("Status Change Edge Cases", () => {
    it("should handle status change when orderId is a number", async () => {
      const user = userEvent.setup();
      render(
        <OrderStatusCard
          {...defaultProps}
          orderId={12345}
          canChangeStatus={true}
        />,
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });

      const completedOption = screen.getByText("completed");
      await user.click(completedOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.COMPLETED);
    });

    it("should handle status change when orderId is a bigint", async () => {
      const user = userEvent.setup();
      render(
        <OrderStatusCard
          {...defaultProps}
          orderId={BigInt(12345)}
          canChangeStatus={true}
        />,
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText("cancelled")).toBeInTheDocument();
      });

      const cancelledOption = screen.getByText("cancelled");
      await user.click(cancelledOption);

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.CANCELLED);
    });
  });

  describe("Status Change Accessibility", () => {
    it("should have proper ARIA labels for screen readers", () => {
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");
      expect(dropdown).toHaveAttribute("aria-label", "Select status");
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<OrderStatusCard {...defaultProps} canChangeStatus={true} />);

      const dropdown = screen.getByRole("combobox");

      // Focus and open with keyboard
      dropdown.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("assigned")).toBeInTheDocument();
      });

      // Navigate with arrow keys and select
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(mockOnStatusChange).toHaveBeenCalledWith(OrderStatus.ASSIGNED);
    });
  });

  describe("Integration with Parent Components", () => {
    it("should work correctly when integrated with SingleOrder component", async () => {
      const user = userEvent.setup();

      // Mock fetch for SingleOrder
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("/api/orders/")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "test-order-123",
                orderNumber: "SF-56780",
                status: "ACTIVE",
                order_type: "catering",
                dispatches: [],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const { default: SingleOrder } = await import("../SingleOrder");

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Driver & Status")).toBeInTheDocument();
      });

      // Verify that OrderStatusCard is rendered
      expect(screen.getByText("Current Status:")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });
  });
});
