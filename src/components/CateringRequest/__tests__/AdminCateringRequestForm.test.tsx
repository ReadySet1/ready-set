import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminCateringRequestForm from "../AdminCateringRequestForm";

describe("AdminCateringRequestForm", () => {
  it("renders the client select dropdown", () => {
    render(<AdminCateringRequestForm />);
    expect(screen.getByLabelText(/select client/i)).toBeInTheDocument();
  });

  it("shows placeholder when no client is selected", () => {
    render(<AdminCateringRequestForm />);
    expect(
      screen.getByText(/please select a client to fill out the form/i),
    ).toBeInTheDocument();
  });

  it("shows the form placeholder when a client is selected", () => {
    render(<AdminCateringRequestForm />);
    const select = screen.getByLabelText(/select client/i);
    fireEvent.change(select, { target: { value: "1" } });
    expect(
      screen.getByText(/CateringRequestForm would render here/i),
    ).toBeInTheDocument();
  });
});
