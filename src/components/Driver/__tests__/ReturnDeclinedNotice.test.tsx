import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ReturnDeclinedNotice,
  RETURN_DECLINED_DISMISSED_KEY,
} from "../ui/ReturnDeclinedNotice";

describe("ReturnDeclinedNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("tells the driver dispatch declined the return and the delivery is still theirs", () => {
    render(<ReturnDeclinedNotice requestId="req-1" notes={null} />);

    expect(
      screen.getByText(/dispatch declined your return request/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this delivery is still yours to complete/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/note from dispatch/i)).not.toBeInTheDocument();
  });

  it("shows the helpdesk resolution notes when present", () => {
    render(
      <ReturnDeclinedNotice requestId="req-1" notes="Too close to pickup, please continue." />,
    );

    expect(screen.getByText(/note from dispatch/i)).toBeInTheDocument();
    expect(
      screen.getByText(/too close to pickup, please continue\./i),
    ).toBeInTheDocument();
  });

  it("wraps a long unbroken note instead of overflowing the card", () => {
    const longToken = "x".repeat(200);
    render(<ReturnDeclinedNotice requestId="req-1" notes={longToken} />);

    const notesEl = screen.getByText(longToken, { exact: false });
    expect(notesEl.closest("div")).toHaveClass("break-words");
  });

  it("hides on dismiss and remembers the request id in localStorage", () => {
    render(<ReturnDeclinedNotice requestId="req-1" notes={null} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(
      screen.queryByText(/dispatch declined your return request/i),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(RETURN_DECLINED_DISMISSED_KEY) ?? "[]"),
    ).toContain("req-1");
  });

  it("renders nothing for a request id that was already dismissed", () => {
    window.localStorage.setItem(
      RETURN_DECLINED_DISMISSED_KEY,
      JSON.stringify(["req-1"]),
    );

    const { container } = render(<ReturnDeclinedNotice requestId="req-1" notes={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still renders for a different request id after an earlier dismissal", () => {
    window.localStorage.setItem(
      RETURN_DECLINED_DISMISSED_KEY,
      JSON.stringify(["req-1"]),
    );

    render(<ReturnDeclinedNotice requestId="req-2" notes={null} />);

    expect(
      screen.getByText(/dispatch declined your return request/i),
    ).toBeInTheDocument();
  });

  it("survives a throwing localStorage (private mode / blocked storage)", () => {
    const getSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    try {
      render(<ReturnDeclinedNotice requestId="req-1" notes={null} />);
      expect(
        screen.getByText(/dispatch declined your return request/i),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      expect(
        screen.queryByText(/dispatch declined your return request/i),
      ).not.toBeInTheDocument();
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
    }
  });
});
