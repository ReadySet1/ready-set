import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordChangeSuccessModal from "../PasswordChangeSuccessModal";

// Mock pointer capture methods for Radix Dialog compatibility
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  value: jest.fn(),
  writable: true,
});

describe("PasswordChangeSuccessModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    userEmail: "test@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders success title when open", () => {
      render(<PasswordChangeSuccessModal {...defaultProps} />);

      expect(
        screen.getByText("Password Changed Successfully")
      ).toBeInTheDocument();
    });

    it("renders success description", () => {
      render(<PasswordChangeSuccessModal {...defaultProps} />);

      expect(
        screen.getByText("Your password has been updated")
      ).toBeInTheDocument();
    });

    it("displays user email in account details section", () => {
      render(<PasswordChangeSuccessModal {...defaultProps} />);

      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("Account Details")).toBeInTheDocument();
    });

    it("shows security tip message", () => {
      render(<PasswordChangeSuccessModal {...defaultProps} />);

      expect(screen.getByText("Security Tip")).toBeInTheDocument();
      expect(
        screen.getByText(/sign out of other devices/i)
      ).toBeInTheDocument();
    });

    it("renders Done button", () => {
      render(<PasswordChangeSuccessModal {...defaultProps} />);

      expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("calls onClose when Done button is clicked", async () => {
      const onClose = jest.fn();
      render(<PasswordChangeSuccessModal {...defaultProps} onClose={onClose} />);

      const doneButton = screen.getByRole("button", { name: /done/i });
      await userEvent.click(doneButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Auto-dismiss", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows countdown in button when autoDismissSeconds is set", () => {
      render(
        <PasswordChangeSuccessModal {...defaultProps} autoDismissSeconds={5} />
      );

      expect(screen.getByRole("button", { name: /done \(5\)/i })).toBeInTheDocument();
    });

    it("counts down and calls onClose when timer expires", async () => {
      const onClose = jest.fn();
      render(
        <PasswordChangeSuccessModal
          {...defaultProps}
          onClose={onClose}
          autoDismissSeconds={3}
        />
      );

      // Initially shows 3
      expect(screen.getByRole("button", { name: /done \(3\)/i })).toBeInTheDocument();

      // Advance 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByRole("button", { name: /done \(2\)/i })).toBeInTheDocument();

      // Advance 1 more second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByRole("button", { name: /done \(1\)/i })).toBeInTheDocument();

      // Advance final second - should call onClose
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("does not show countdown when autoDismissSeconds is 0", () => {
      render(
        <PasswordChangeSuccessModal {...defaultProps} autoDismissSeconds={0} />
      );

      const button = screen.getByRole("button", { name: /done/i });
      expect(button.textContent).toBe("Done");
    });

    it("does not auto-dismiss when autoDismissSeconds is not provided", () => {
      const onClose = jest.fn();
      render(<PasswordChangeSuccessModal {...defaultProps} onClose={onClose} />);

      // Advance several seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // onClose should not have been called automatically
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Modal state", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("resets countdown when modal reopens", () => {
      const { rerender } = render(
        <PasswordChangeSuccessModal
          {...defaultProps}
          isOpen={true}
          autoDismissSeconds={5}
        />
      );

      // Count down a bit
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByRole("button", { name: /done \(3\)/i })).toBeInTheDocument();

      // Close and reopen
      rerender(
        <PasswordChangeSuccessModal
          {...defaultProps}
          isOpen={false}
          autoDismissSeconds={5}
        />
      );
      rerender(
        <PasswordChangeSuccessModal
          {...defaultProps}
          isOpen={true}
          autoDismissSeconds={5}
        />
      );

      // Should reset to 5
      expect(screen.getByRole("button", { name: /done \(5\)/i })).toBeInTheDocument();
    });
  });
});
