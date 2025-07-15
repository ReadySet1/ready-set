import { render, screen } from "@testing-library/react";
import AddressesPage from "./page";

describe("AddressesPage layout", () => {
  it("should render content edge-to-edge with no left/right margin or padding", () => {
    render(<AddressesPage />);
    // The outermost div should have w-full and not container or px-*
    const wrapper = screen.getByTestId("addresses-edge-wrapper");
    expect(wrapper).toHaveClass("w-full");
    // Should not have container, px-*, or mx-auto classes
    expect(wrapper.className).not.toMatch(/container|px-|mx-auto/);
  });
});
