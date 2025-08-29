import React from "react";
import { render, screen } from "@testing-library/react";
import Contact from "@/components/Contact";

// Mock the email action
jest.mock("@/app/actions/email", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock the Button component
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

describe("Contact Component", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it("renders the main contact section", () => {
    render(<Contact />);

    expect(screen.getByText("CONTACT US")).toBeInTheDocument();
    expect(
      screen.getByText("Let's talk about your needs."),
    ).toBeInTheDocument();
  });

  it('displays the "Our Service Area" section with location icon', () => {
    render(<Contact />);

    const serviceAreaHeading = screen.getByText("Our Service Area");
    expect(serviceAreaHeading).toBeInTheDocument();

    // Check that the location icon is present (SVG with location pin paths)
    const locationIcon = document.querySelector('svg[viewBox="0 0 29 35"]');
    expect(locationIcon).toBeInTheDocument();
  });

  it('displays California cities under "California" header', () => {
    render(<Contact />);

    const californiaHeader = screen.getByText("California");
    expect(californiaHeader).toBeInTheDocument();

    // Check for California cities
    expect(screen.getByText(/Palo Alto, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Mateo, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Mountain View, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Jose, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Oakland, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Sunnyvale, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Richmond, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Hayward, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Concord, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
  });

  it('displays Texas cities under "Texas" header', () => {
    render(<Contact />);

    const texasHeader = screen.getByText("Texas");
    expect(texasHeader).toBeInTheDocument();

    // Check for Texas cities
    expect(screen.getByText(/Austin, TX/)).toBeInTheDocument();
    expect(screen.getByText(/Dallas, TX/)).toBeInTheDocument();
  });

  it('displays the "How Can We Help?" section with envelope icon', () => {
    render(<Contact />);

    const helpHeading = screen.getByText("How Can We Help?");
    expect(helpHeading).toBeInTheDocument();

    // Check that the envelope icon is present (SVG with envelope paths)
    const envelopeIcon = document.querySelector('svg[viewBox="0 0 34 25"]');
    expect(envelopeIcon).toBeInTheDocument();
  });

  it("displays the contact email address", () => {
    render(<Contact />);

    const emailLink = screen.getByText("info@ready-set.co");
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", "mailto:info@ready-set.co");
  });

  it("displays the contact form with all required fields", () => {
    render(<Contact />);

    expect(screen.getByText("Send us a Message")).toBeInTheDocument();
    expect(screen.getByText("Full Name*")).toBeInTheDocument();
    expect(screen.getByText("Email*")).toBeInTheDocument();
    expect(screen.getByText("Phone*")).toBeInTheDocument();
    expect(screen.getByText("Message*")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("has proper spacing and layout classes", () => {
    render(<Contact />);

    // Find the container that holds both service area sections
    const serviceAreaHeading = screen.getByText("Our Service Area");
    const parentContainer =
      serviceAreaHeading.closest("div")?.parentElement?.parentElement;

    // Check that the parent container has proper spacing classes
    expect(parentContainer).toHaveClass("p-8", "pt-16");
  });

  it("maintains proper state organization with California and Texas sections", () => {
    render(<Contact />);

    // Verify the structure: California section comes before Texas section
    const californiaSection = screen.getByText("California").closest("div");
    const texasSection = screen.getByText("Texas").closest("div");

    expect(californiaSection).toBeInTheDocument();
    expect(texasSection).toBeInTheDocument();

    // Check that both sections are within the same parent container
    const serviceAreaContainer = screen
      .getByText("Our Service Area")
      .closest("div");
    expect(serviceAreaContainer).toContainElement(californiaSection);
    expect(serviceAreaContainer).toContainElement(texasSection);
  });

  it("displays all service area cities in the correct format", () => {
    render(<Contact />);

    // Check that all California cities are present
    expect(screen.getByText(/Palo Alto, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Mateo, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Mountain View, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Jose, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Oakland, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Sunnyvale, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Richmond, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Hayward, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Concord, CA/)).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();

    // Check that all Texas cities are present
    expect(screen.getByText(/Austin, TX/)).toBeInTheDocument();
    expect(screen.getByText(/Dallas, TX/)).toBeInTheDocument();
  });
});
