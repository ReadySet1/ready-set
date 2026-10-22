/**
 * Mobile QA round 1, finding F1: on a phone the post-sign-up modal could not
 * be dismissed without a hard refresh. The dialog had no close control, its
 * content filled the whole viewport (no backdrop left to tap) and it could not
 * scroll, so the only button sat below the fold.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistrationSuccessModal from "../RegistrationSuccessModal";

// jest.setup.ts replaces Radix Dialog with inert divs; this suite needs the
// real primitive so close/escape behaviour is actually exercised.
jest.unmock("@radix-ui/react-dialog");

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderModal(onClose = jest.fn()) {
  render(
    <RegistrationSuccessModal
      isOpen
      onClose={onClose}
      userName="Casey Client"
      userEmail="casey.client@example.com"
      userType="client"
    />,
  );
  return onClose;
}

describe("RegistrationSuccessModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("has a visible close button that dismisses the modal", async () => {
    const onClose = renderModal();

    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = renderModal();

    await userEvent.setup().keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("caps its height to the viewport and scrolls so every control stays reachable on small screens", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-h-\[[^\]]*dvh[^\]]*\]/);
    expect(dialog.className).toMatch(/\boverflow-y-auto\b/);
    // Leave a gutter around the dialog so the backdrop stays tappable.
    expect(dialog.className).toMatch(/w-\[calc\(100%-2rem\)\]/);
  });

  it("still sends the user to sign in from the primary action", async () => {
    const onClose = renderModal();

    await userEvent.setup().click(screen.getByRole("button", { name: /go to login/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/sign-in");
  });
});
