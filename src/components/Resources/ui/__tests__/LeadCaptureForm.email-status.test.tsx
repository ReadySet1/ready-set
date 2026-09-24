import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import LeadCaptureForm from "../LeadCaptureForm";

jest.mock("@/lib/cloudinary", () => ({ getCloudinaryUrl: () => "/logo.png" }));

function mockLeadsResponse(body: Record<string, unknown>) {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  ) as jest.Mock;
}

async function submit() {
  fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByPlaceholderText("Last Name"), { target: { value: "Lopez" } });
  fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Industry"), { target: { value: "Catering" } });
  fireEvent.submit(screen.getByPlaceholderText("Email Address").closest("form")!);
  await screen.findByText("Thank you for signing up!");
}

beforeEach(() => {
  window.open = jest.fn();
});

describe("LeadCaptureForm email status", () => {
  it("sends the given resource slug to the leads API", async () => {
    mockLeadsResponse({ success: true, emailSent: true });
    render(<LeadCaptureForm resourceSlug="catering-delivery-checklist" resourceTitle="Checklist" />);

    await submit();

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.resourceSlug).toBe("catering-delivery-checklist");
  });

  it("promises an email copy only when one was sent", async () => {
    mockLeadsResponse({ success: true, emailSent: true });
    render(<LeadCaptureForm resourceSlug="guide" resourceTitle="Guide" />);

    await submit();

    expect(screen.getByText(/We've also sent a copy to your email/)).toBeInTheDocument();
  });

  it("says the email could not be sent when the API reports a failure", async () => {
    mockLeadsResponse({ success: true, emailSent: false });
    render(<LeadCaptureForm resourceSlug="guide" resourceTitle="Guide" />);

    await submit();

    expect(screen.queryByText(/We've also sent a copy to your email/)).not.toBeInTheDocument();
    expect(screen.getByText(/couldn't email you a copy/i)).toBeInTheDocument();
  });
});
