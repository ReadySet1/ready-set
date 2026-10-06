/**
 * DeleteCateringOrder — how the dialog reports the delete action's result.
 * A `partial` result means the order IS deleted but files were left in
 * storage: the list must still refresh, and the toast must not claim success.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToast = jest.fn();
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockDeleteCateringOrder = jest.fn();
jest.mock("@/app/(backend)/admin/catering-orders/_actions/catering-orders", () => ({
  deleteCateringOrder: (...args: unknown[]) => mockDeleteCateringOrder(...args),
}));

import { DeleteCateringOrder } from "../DeleteCateringOrder";

const adminRoles = { isAdmin: true, isSuperAdmin: false, helpdesk: false };

async function confirmDelete(onDeleted: jest.Mock) {
  const user = userEvent.setup();
  render(
    <DeleteCateringOrder
      orderId="order-1"
      orderNumber="CAT-001"
      userRoles={adminRoles}
      onDeleted={onDeleted}
    />,
  );
  // Radix AlertDialog is mocked globally (jest.setup.ts): the confirm action
  // is always rendered, so it can be clicked without opening the dialog.
  await user.click(screen.getByTestId("alert-dialog-action"));
}

describe("DeleteCateringOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("confirms a clean delete and refreshes the list", async () => {
    mockDeleteCateringOrder.mockResolvedValue({
      success: true,
      message: "Order deleted successfully",
    });
    const onDeleted = jest.fn();

    await confirmDelete(onDeleted);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(mockDeleteCateringOrder).toHaveBeenCalledWith("order-1");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Order deleted", variant: "default" }),
    );
  });

  it("refreshes the list but warns when files were left in storage", async () => {
    mockDeleteCateringOrder.mockResolvedValue({
      success: false,
      partial: true,
      error: "Order deleted, but 2 files could not be removed from storage.",
    });
    const onDeleted = jest.fn();

    await confirmDelete(onDeleted);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith({
      title: "Order deleted with warnings",
      description: "Order deleted, but 2 files could not be removed from storage.",
      variant: "destructive",
    });
  });

  it("keeps the order in the list when the delete failed", async () => {
    mockDeleteCateringOrder.mockResolvedValue({
      success: false,
      error: "Order CAT-001 has already been deleted.",
    });
    const onDeleted = jest.fn();

    await confirmDelete(onDeleted);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Order CAT-001 has already been deleted.",
        }),
      ),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
