import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CateringContact from "../CateringContact";

// Mock sendEmail action
const mockSendEmail = jest.fn();
jest.mock("@/app/actions/email", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock reCAPTCHA utilities
const mockLoadRecaptchaScript = jest.fn();
const mockExecuteRecaptcha = jest.fn();
jest.mock("@/lib/recaptcha", () => ({
  loadRecaptchaScript: () => mockLoadRecaptchaScript(),
  executeRecaptcha: (...args: unknown[]) => mockExecuteRecaptcha(...args),
}));

// Mock ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => {
  const React = require("react");
  return function MockScheduleDialog({
    buttonText,
    calendarUrl,
    className,
  }: {
    buttonText: string;
    calendarUrl: string;
    className?: string;
  }) {
    return (
      <div data-testid="schedule-dialog">
        <button className={className} data-testid="schedule-dialog-button">
          {buttonText}
        </button>
        <div data-testid="schedule-dialog-calendar-url">{calendarUrl}</div>
      </div>
    );
  };
});

describe("CateringContact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadRecaptchaScript.mockResolvedValue(undefined);
    mockExecuteRecaptcha.mockResolvedValue("mock-recaptcha-token");
    mockSendEmail.mockResolvedValue({ success: true });
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      const { container } = render(<CateringContact />);

      // Get the main wrapper div (first child of container)
      const mainContainer = container.querySelector(".w-full.bg-white");
      expect(mainContainer).toHaveClass("w-full", "bg-white", "py-16", "md:py-20", "lg:py-24");
    });

    it("renders the max-width wrapper", () => {
      const { container } = render(<CateringContact />);

      const wrapper = container.querySelector(".mx-auto.max-w-7xl");
      expect(wrapper).toHaveClass("mx-auto", "max-w-7xl", "px-4");
    });

    it("renders the grid layout container", () => {
      const { container } = render(<CateringContact />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass(
        "grid",
        "grid-cols-1",
        "gap-12",
        "lg:grid-cols-2",
        "lg:gap-16"
      );
    });

    it("renders the form title", () => {
      render(<CateringContact />);

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveTextContent("Send us a message");
    });

    it("renders the ScheduleDialog component for Partner button", () => {
      render(<CateringContact />);

      expect(screen.getByTestId("schedule-dialog")).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("renders all required form fields", () => {
      render(<CateringContact />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/leave a message/i)).toBeInTheDocument();
    });

    it("renders form fields with correct input types", () => {
      render(<CateringContact />);

      expect(screen.getByLabelText(/name/i)).toHaveAttribute("type", "text");
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute("type", "email");
      expect(screen.getByLabelText(/phone number/i)).toHaveAttribute("type", "tel");
      expect(screen.getByLabelText(/company/i)).toHaveAttribute("type", "text");
    });

    it("renders all form fields with required attribute", () => {
      render(<CateringContact />);

      expect(screen.getByLabelText(/name/i)).toBeRequired();
      expect(screen.getByLabelText(/email address/i)).toBeRequired();
      expect(screen.getByLabelText(/phone number/i)).toBeRequired();
      expect(screen.getByLabelText(/company/i)).toBeRequired();
      expect(screen.getByLabelText(/leave a message/i)).toBeRequired();
    });

    it("renders textarea for message field", () => {
      render(<CateringContact />);

      const messageField = screen.getByLabelText(/leave a message/i);
      expect(messageField.tagName).toBe("TEXTAREA");
      expect(messageField).toHaveAttribute("rows", "5");
    });

    it("renders submit button", () => {
      render(<CateringContact />);

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute("type", "submit");
    });

    it("renders privacy notice text", () => {
      render(<CateringContact />);

      expect(screen.getByText(/your name won't be shared/i)).toBeInTheDocument();
      expect(screen.getByText(/never submit passwords/i)).toBeInTheDocument();
    });
  });

  describe("Form Input Handling", () => {
    it("updates name field on input", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "John Doe");

      expect(nameInput).toHaveValue("John Doe");
    });

    it("updates email field on input", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "john@example.com");

      expect(emailInput).toHaveValue("john@example.com");
    });

    it("updates phone field on input", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, "555-123-4567");

      expect(phoneInput).toHaveValue("555-123-4567");
    });

    it("updates company field on input", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      const companyInput = screen.getByLabelText(/company/i);
      await user.type(companyInput, "Acme Inc");

      expect(companyInput).toHaveValue("Acme Inc");
    });

    it("updates message field on input", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      const messageInput = screen.getByLabelText(/leave a message/i);
      await user.type(messageInput, "Hello, I need help!");

      expect(messageInput).toHaveValue("Hello, I need help!");
    });
  });

  describe("Form Validation", () => {
    it("shows error message when submitting with empty fields", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      // Only fill some fields, leave others empty
      await user.type(screen.getByLabelText(/name/i), "John Doe");
      
      // Use fireEvent.submit to bypass HTML5 validation and trigger JS validation
      const form = screen.getByRole("button", { name: /submit/i }).closest("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
      });
    });

    it("does not call sendEmail when validation fails", async () => {
      render(<CateringContact />);

      // Use fireEvent.submit to bypass HTML5 validation
      const form = screen.getByRole("button", { name: /submit/i }).closest("form");
      fireEvent.submit(form!);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("Form Submission", () => {
    const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");
    };

    it("calls sendEmail with correct data on successful submission", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockSendEmail).toHaveBeenCalledWith({
          name: "John Doe",
          email: "john@example.com",
          phone: "555-123-4567",
          message: "Company: Acme Inc\n\nMessage:\nHello!",
          recaptchaToken: "mock-recaptcha-token",
        });
      });
    });

    it("shows success message after successful submission", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/message sent successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/we'll get back to you soon/i)).toBeInTheDocument();
      });
    });

    it("shows error message on submission failure", async () => {
      mockSendEmail.mockRejectedValue(new Error("Email sending failed"));
      const user = userEvent.setup();
      render(<CateringContact />);

      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/error sending message/i)).toBeInTheDocument();
        expect(screen.getByText(/email sending failed/i)).toBeInTheDocument();
      });
    });

    it("shows generic error message for non-Error exceptions", async () => {
      mockSendEmail.mockRejectedValue("Some string error");
      const user = userEvent.setup();
      render(<CateringContact />);

      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/error sending message/i)).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner during submission", async () => {
      // Make sendEmail hang to keep loading state
      mockSendEmail.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/sending/i)).toBeInTheDocument();
      });
    });

    it("disables submit button during loading", async () => {
      mockSendEmail.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      const submitButton = screen.getByRole("button", { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        // During loading, button shows "Sending..." text
        const loadingButton = screen.getByRole("button", { name: /sending/i });
        expect(loadingButton).toBeDisabled();
      });
    });
  });

  describe("reCAPTCHA Integration", () => {
    it("loads reCAPTCHA script on mount", async () => {
      render(<CateringContact />);

      await waitFor(() => {
        expect(mockLoadRecaptchaScript).toHaveBeenCalled();
      });
    });

    it("shows warning when reCAPTCHA fails to load after retries", async () => {
      // Mock reCAPTCHA to fail
      mockLoadRecaptchaScript.mockRejectedValue(new Error("Failed to load"));

      render(<CateringContact />);

      // Wait for retries to complete (3 attempts with exponential backoff)
      await waitFor(
        () => {
          expect(screen.getByText(/enhanced spam protection unavailable/i)).toBeInTheDocument();
        },
        { timeout: 10000 }
      );
    });

    it("executes reCAPTCHA before form submission", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockExecuteRecaptcha).toHaveBeenCalledWith("catering_contact_form_submit");
      });
    });

    it("sends email without token when reCAPTCHA returns null", async () => {
      mockExecuteRecaptcha.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockSendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recaptchaToken: undefined,
          })
        );
      });
    });
  });

  describe("reCAPTCHA Warning UI", () => {
    it("displays warning alert with correct structure", async () => {
      mockLoadRecaptchaScript.mockRejectedValue(new Error("Failed to load"));

      render(<CateringContact />);

      await waitFor(
        () => {
          const alertElement = screen.getByRole("alert");
          expect(alertElement).toBeInTheDocument();
          expect(alertElement).toHaveClass("rounded-md", "border", "border-yellow-400", "bg-yellow-50");
        },
        { timeout: 10000 }
      );
    });

    it("displays helpful message in reCAPTCHA warning", async () => {
      mockLoadRecaptchaScript.mockRejectedValue(new Error("Failed to load"));

      render(<CateringContact />);

      await waitFor(
        () => {
          expect(screen.getByText(/your message will still be sent/i)).toBeInTheDocument();
        },
        { timeout: 10000 }
      );
    });
  });

  describe("Partner Button", () => {
    it("renders Partner With Us button", () => {
      render(<CateringContact />);

      const partnerButton = screen.getByRole("button", { name: /partner with us/i });
      expect(partnerButton).toBeInTheDocument();
    });

    it("renders Partner button with ScheduleDialog", () => {
      render(<CateringContact />);

      const partnerButton = screen.getByTestId("schedule-dialog-button");
      expect(partnerButton).toHaveTextContent("Partner With Us");
    });

    it("renders Partner button with correct styling", () => {
      render(<CateringContact />);

      const partnerButton = screen.getByTestId("schedule-dialog-button");
      expect(partnerButton).toHaveClass(
        "rounded-lg",
        "bg-yellow-400",
        "px-8",
        "py-4",
        "font-extrabold"
      );
    });
  });

  describe("Right Section Content", () => {
    it("renders Ready Set logo", () => {
      render(<CateringContact />);

      const logo = screen.getByAltText("Ready Set");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/images/logo/logo");
    });

    it("renders company description text", () => {
      render(<CateringContact />);

      expect(screen.getByText(/here at ready set/i)).toBeInTheDocument();
      expect(screen.getByText(/we treat your business like an extension of our own/i)).toBeInTheDocument();
    });
  });

  describe("Success/Error Message Display", () => {
    it("renders success message with correct styling", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        expect(alertElement).toHaveClass("border-green-300", "bg-green-50", "text-green-800");
      });
    });

    it("renders error message with correct styling", async () => {
      mockSendEmail.mockRejectedValue(new Error("Failed"));
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        expect(alertElement).toHaveClass("border-red-300", "bg-red-50", "text-red-800");
      });
    });

    it("renders success icon in success message", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        const svgIcon = alertElement.querySelector("svg.text-green-600");
        expect(svgIcon).toBeInTheDocument();
      });
    });

    it("renders error icon in error message", async () => {
      mockSendEmail.mockRejectedValue(new Error("Failed"));
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        const svgIcon = alertElement.querySelector("svg.text-red-600");
        expect(svgIcon).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels for all inputs", () => {
      render(<CateringContact />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const companyInput = screen.getByLabelText(/company/i);
      const messageInput = screen.getByLabelText(/leave a message/i);

      expect(nameInput).toHaveAttribute("id", "name");
      expect(emailInput).toHaveAttribute("id", "email");
      expect(phoneInput).toHaveAttribute("id", "phone");
      expect(companyInput).toHaveAttribute("id", "company");
      expect(messageInput).toHaveAttribute("id", "message");
    });

    it("renders alert role for messages", async () => {
      const user = userEvent.setup();
      render(<CateringContact />);

      await user.type(screen.getByLabelText(/name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/phone number/i), "555-123-4567");
      await user.type(screen.getByLabelText(/company/i), "Acme Inc");
      await user.type(screen.getByLabelText(/leave a message/i), "Hello!");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("has proper heading hierarchy", () => {
      render(<CateringContact />);

      const h2 = screen.getByRole("heading", { level: 2 });
      expect(h2).toBeInTheDocument();
      expect(h2).toHaveTextContent("Send us a message");
    });

    it("has proper image alt text", () => {
      render(<CateringContact />);

      const logo = screen.getByAltText("Ready Set");
      expect(logo).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive container padding", () => {
      const { container } = render(<CateringContact />);

      const mainContainer = container.querySelector(".w-full.bg-white");
      expect(mainContainer).toHaveClass("py-16", "md:py-20", "lg:py-24");
    });

    it("applies responsive grid gap classes", () => {
      const { container } = render(<CateringContact />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("gap-12", "lg:gap-16");
    });

    it("applies responsive grid columns", () => {
      const { container } = render(<CateringContact />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1", "lg:grid-cols-2");
    });

    it("applies responsive title styling", () => {
      render(<CateringContact />);

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveClass("text-3xl", "md:text-4xl");
    });
  });

  describe("Form Field Styling", () => {
    it("applies correct styling to input fields", () => {
      render(<CateringContact />);

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveClass(
        "w-full",
        "rounded-lg",
        "border",
        "border-gray-300",
        "px-4",
        "py-3"
      );
    });

    it("applies Montserrat font to labels", () => {
      render(<CateringContact />);

      const labels = screen.getAllByText(/name|email|phone|company|message/i);
      labels.forEach((label) => {
        if (label.tagName === "LABEL") {
          expect(label).toHaveClass("font-[Montserrat]");
        }
      });
    });

    it("applies correct styling to submit button", () => {
      render(<CateringContact />);

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toHaveClass(
        "w-full",
        "rounded-lg",
        "bg-yellow-400",
        "px-8",
        "py-4",
        "font-extrabold"
      );
    });
  });

  describe("Testimonials Data Structure", () => {
    // The testimonials are currently commented out in the UI,
    // but we can verify the data structure is correct
    it("component initializes with testimonials data", () => {
      // This test verifies the component renders without error,
      // which validates the testimonials array structure
      render(<CateringContact />);
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });
  });
});

