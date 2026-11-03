// src/components/Orders/__tests__/CreateOrderFormTimezoneHint.test.tsx
/**
 * The create-order forms save the picked times in the pickup address zone
 * (orderTimesInPickupZone), so the admin must see that zone before submitting:
 * "Times in PT" by default, "Times in CT" once an Austin pickup is chosen.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateCateringOrderForm } from "../CateringOrders/CreateCateringOrderForm";
import { CreateOnDemandOrderForm } from "../OnDemand/CreateOnDemandOrderForm";

jest.mock("@/app/(backend)/admin/catering-orders/_actions/catering-orders", () => ({
  createCateringOrder: jest.fn(),
}));

jest.mock("@/app/(backend)/admin/on-demand-orders/_actions/on-demand-orders", () => ({
  createOnDemandOrder: jest.fn(),
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}));

jest.mock("@/hooks/use-upload-file", () => ({
  useUploadFile: () => ({
    onUpload: jest.fn(),
    uploadedFiles: [],
    progresses: {},
    isUploading: false,
    tempEntityId: "temp-1",
    updateEntityId: jest.fn(),
    deleteFile: jest.fn(),
  }),
}));

jest.mock("@/components/AddressManager/AddAddressForm", () => ({
  __esModule: true,
  default: () => null,
}));

const austinPickup = {
  id: "pickup-austin",
  name: "Austin Kitchen",
  street1: "500 Congress Ave",
  street2: "",
  city: "Austin",
  state: "TX",
  zip: "78701",
  county: "Travis",
};

// Stand-in for both AddressSelector APIs: route-builder (onChange) and legacy (onSelect + type).
jest.mock("@/components/AddressSelector", () => ({
  AddressSelector: (props: any) => {
    if (props.type === "delivery") return null;
    return (
      <button
        type="button"
        onClick={() =>
          props.onChange
            ? props.onChange({ pickup: austinPickup })
            : props.onSelect(austinPickup)
        }
      >
        Pick Austin pickup
      </button>
    );
  },
}));

describe.each([
  ["CreateCateringOrderForm", () => <CreateCateringOrderForm clients={[]} />],
  ["CreateOnDemandOrderForm", () => <CreateOnDemandOrderForm clients={[]} />],
])("%s time zone hint", (_name, renderForm) => {
  it("shows the default zone before a pickup address is chosen", async () => {
    render(renderForm());
    expect(await screen.findByText("Times in PT")).toBeInTheDocument();
  });

  it("switches to CT when the pickup address is in Austin, TX", async () => {
    render(renderForm());
    fireEvent.click(await screen.findByRole("button", { name: "Pick Austin pickup" }));
    expect(await screen.findByText("Times in CT")).toBeInTheDocument();
    expect(screen.queryByText("Times in PT")).not.toBeInTheDocument();
  });
});
