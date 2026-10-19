import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DeliveryRecipient } from "../DeliveryRecipient";

describe("DeliveryRecipient (admin completed-order view)", () => {
  it("shows who received the order at completion", () => {
    render(<DeliveryRecipient receivedBy="  Sam Carter " />);
    expect(screen.getByText("Received by")).toBeInTheDocument();
    expect(screen.getByText("Sam Carter")).toBeInTheDocument();
  });

  it.each([null, undefined, "", "   "])("renders nothing when no name is recorded (%p)", (value) => {
    const { container } = render(<DeliveryRecipient receivedBy={value} />);
    expect(container).toBeEmptyDOMElement();
  });
});
