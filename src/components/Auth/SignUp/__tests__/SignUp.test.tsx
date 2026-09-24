/**
 * The admin notification is sent AFTER /api/register created the account, so
 * it is best-effort: a rate-limited or failed notification must never turn a
 * successful registration into an error screen (forms QA B1/A9).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import SignUp from "../SignUp";
import { sendRegistrationNotification } from "@/lib/notifications";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("@/lib/notifications", () => ({
  sendRegistrationNotification: jest.fn(),
}));
jest.mock("@/components/Auth/GoogleAuthButton", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../ui/VendorForm", () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (data: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({ email: "vendor@example.com", contact_name: "Vera Vendor" })
      }
    >
      Submit vendor form
    </button>
  ),
}));
jest.mock("../ui/ClientForm", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../RegistrationSuccessModal", () => ({
  __esModule: true,
  default: ({ isOpen, userEmail }: { isOpen: boolean; userEmail: string }) =>
    isOpen ? <div role="dialog">Registration complete for {userEmail}</div> : null,
}));

const mockedNotify = sendRegistrationNotification as jest.Mock;
const mockedToastError = toast.error as jest.Mock;

async function registerAsVendor() {
  const user = userEvent.setup();
  render(<SignUp />);
  await user.click(screen.getByRole("button", { name: /vendor/i }));
  await user.click(screen.getByRole("button", { name: /submit vendor form/i }));
}

describe("SignUp registration notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ emailSent: true }),
    }) as jest.Mock;
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the success modal when the notification succeeds", async () => {
    mockedNotify.mockResolvedValue({ success: true, message: "sent" });

    await registerAsVendor();

    expect(
      await screen.findByText(/registration complete for vendor@example.com/i),
    ).toBeInTheDocument();
  });

  it("still shows success when registration succeeds but the notification returns a failure", async () => {
    mockedNotify.mockResolvedValue({
      success: false,
      reason: "rate_limited",
      error: "Too many submissions. Please wait a few minutes and try again.",
    });

    await registerAsVendor();

    expect(
      await screen.findByText(/registration complete for vendor@example.com/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/too many submissions/i)).not.toBeInTheDocument();
    expect(mockedToastError).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/registration notification/i),
      expect.objectContaining({ reason: "rate_limited" }),
    );
  });

  it("still shows success when the notification throws", async () => {
    mockedNotify.mockRejectedValue(new Error("An error occurred in the Server Components render"));

    await registerAsVendor();

    expect(
      await screen.findByText(/registration complete for vendor@example.com/i),
    ).toBeInTheDocument();
    expect(mockedToastError).not.toHaveBeenCalled();
  });

  it("shows the error and skips the notification when registration fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Email already registered" }),
    });

    await registerAsVendor();

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});
