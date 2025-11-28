import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CateringFeatures from "../CateringFeatures";
import { MapPin, Headset, Truck } from "lucide-react";

// Mock framer-motion since it's mocked in jest.setup.ts
// The mock converts motion components to regular divs

// Mock ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => {
  const React = require("react");
  return function MockScheduleDialog({
    buttonText,
    dialogTitle,
    dialogDescription,
    calendarUrl,
    customButton,
  }: any) {
    return (
      <div data-testid="schedule-dialog">
        <div data-testid="schedule-dialog-button-text">{buttonText}</div>
        <div data-testid="schedule-dialog-title">{dialogTitle}</div>
        <div data-testid="schedule-dialog-description">{dialogDescription}</div>
        <div data-testid="schedule-dialog-calendar-url">{calendarUrl}</div>
        {customButton && (
          <div data-testid="schedule-dialog-custom-button">{customButton}</div>
        )}
      </div>
    );
  };
});

describe("CateringFeatures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      render(<CateringFeatures />);

      const container = screen.getByRole("main");
      expect(container).toHaveClass("w-full", "bg-gray-50", "py-16", "md:py-20");
    });

    it("renders the max-width wrapper", () => {
      render(<CateringFeatures />);

      const wrapper = screen.getByRole("main").firstElementChild;
      expect(wrapper).toHaveClass("mx-auto", "max-w-7xl", "px-4");
    });

    it("renders the title section", () => {
      render(<CateringFeatures />);

      const titleSection = screen.getByText("More Than Just Delivery").closest("div");
      expect(titleSection).toHaveClass("mb-16", "text-center");
    });

    it("renders the main title with correct styling", () => {
      render(<CateringFeatures />);

      const title = screen.getByText("More Than Just Delivery");
      expect(title).toHaveClass(
        "text-4xl",
        "font-black",
        "text-gray-800",
        "md:text-5xl",
        "lg:text-6xl"
      );
    });
  });

  describe("Feature Cards Grid", () => {
    it("renders the feature cards grid container", () => {
      render(<CateringFeatures />);

      const grid = screen.getByRole("main").querySelector(".grid");
      expect(grid).toHaveClass(
        "grid",
        "grid-cols-1",
        "gap-12",
        "md:grid-cols-3",
        "md:gap-8",
        "lg:gap-12"
      );
    });

    it("renders all three feature cards", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      expect(featureCards).toHaveLength(3);
    });

    it("renders the first feature card with correct content", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      const firstCard = featureCards[0];

      expect(firstCard).toHaveTextContent("Flexible Coordination");
      expect(firstCard).toHaveTextContent(
        "We simplify coordination and make sure every delivery is confirmed, scheduled, and on time."
      );
    });

    it("renders the second feature card with correct content", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      const secondCard = featureCards[1];

      expect(secondCard).toHaveTextContent("Transparent Service");
      expect(secondCard).toHaveTextContent(
        "With real-time tracking and responsive support, you always know where your order is."
      );
    });

    it("renders the third feature card with correct content", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      const thirdCard = featureCards[2];

      expect(thirdCard).toHaveTextContent("Hands-Off Experience");
      expect(thirdCard).toHaveTextContent(
        "Dependable, trained drivers handle every detail, from quick drop-offs to full setups."
      );
    });
  });

  describe("ScheduleDialog Integration", () => {
    it("renders the Get Started button section", () => {
      render(<CateringFeatures />);

      // The motion.div wraps the ScheduleDialog, we need to find it
      const button = screen.getByRole("button", { name: "Get Started" });
      
      // Traverse up to find the div with mt-16 flex justify-center
      let currentElement = button.parentElement;
      let found = false;
      
      while (currentElement && !found) {
        const classes = currentElement.className || "";
        if (classes.includes("mt-16") && classes.includes("flex") && classes.includes("justify-center")) {
          found = true;
          expect(currentElement).toHaveClass("mt-16", "flex", "justify-center");
          break;
        }
        currentElement = currentElement.parentElement;
      }
      
      expect(found).toBe(true);
    });

    it("renders the ScheduleDialog with correct props", () => {
      render(<CateringFeatures />);

      const scheduleDialog = screen.getByTestId("schedule-dialog");
      expect(scheduleDialog).toBeInTheDocument();

      expect(screen.getByTestId("schedule-dialog-button-text")).toHaveTextContent("Get Started");
      expect(screen.getByTestId("schedule-dialog-title")).toHaveTextContent("Schedule an Appointment");
      expect(screen.getByTestId("schedule-dialog-description")).toHaveTextContent("Choose a convenient time for your appointment.");
      expect(screen.getByTestId("schedule-dialog-calendar-url")).toHaveTextContent("https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true");
    });

    it("renders the custom button within ScheduleDialog", () => {
      render(<CateringFeatures />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      expect(customButton).toBeInTheDocument();

      const button = customButton.querySelector("button");
      expect(button).toHaveTextContent("Get Started");
      expect(button).toHaveClass(
        "rounded-lg",
        "bg-yellow-400",
        "px-12",
        "py-4",
        "font-[Montserrat]",
        "text-lg",
        "font-extrabold",
        "text-gray-800",
        "shadow-md"
      );
    });
  });

  describe("FeatureCard Component", () => {
    it("renders FeatureCard with correct props and styling", () => {
      const mockIcon = <MapPin size={80} strokeWidth={2} />;
      const mockTitle = "Test Feature";
      const mockDescription = "Test description for the feature.";
      const mockDelay = 100;

      // Render the component to get access to the internal FeatureCard
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      const firstCard = featureCards[0];

      // Check that the card wrapper has the correct structure
      expect(firstCard).toHaveClass(
        "flex",
        "flex-col",
        "items-center"
      );

      // Check the inner card has the correct styling
      const innerCard = firstCard.querySelector(".rounded-3xl");
      expect(innerCard).toHaveClass(
        "flex",
        "w-full",
        "max-w-[380px]",
        "flex-col",
        "items-center",
        "rounded-3xl",
        "border-4",
        "border-yellow-400",
        "bg-white",
        "p-8",
        "shadow-sm"
      );
    });

    it("renders feature icons correctly", () => {
      render(<CateringFeatures />);

      // Since icons are rendered via Lucide React, we check for the SVG elements
      const svgs = screen.getAllByTestId("feature-card").map(card =>
        card.querySelector("svg")
      ).filter(Boolean);

      expect(svgs).toHaveLength(3);
      expect(svgs[0]).toHaveAttribute("width", "80");
      expect(svgs[0]).toHaveAttribute("height", "80");
    });

    it("renders feature titles with correct styling", () => {
      render(<CateringFeatures />);

      const titles = screen.getAllByTestId("feature-card").map(card =>
        card.querySelector("h3")
      ).filter(Boolean);

      expect(titles).toHaveLength(3);

      titles.forEach(title => {
        expect(title).toHaveClass(
          "mb-4",
          "text-center",
          "text-xl",
          "font-black",
          "uppercase",
          "leading-tight",
          "tracking-wide",
          "text-gray-800",
          "md:text-2xl"
        );
      });
    });

    it("renders feature descriptions with correct styling", () => {
      render(<CateringFeatures />);

      const descriptions = screen.getAllByTestId("feature-card").map(card =>
        card.querySelector("p")
      ).filter(Boolean);

      expect(descriptions).toHaveLength(3);

      descriptions.forEach(description => {
        expect(description).toHaveClass(
          "text-center",
          "text-base",
          "leading-relaxed",
          "text-gray-700"
        );
      });
    });
  });

  describe("Animation and Motion", () => {
    it("applies motion props to title section", () => {
      render(<CateringFeatures />);

      const titleSection = screen.getByText("More Than Just Delivery").closest("div");
      expect(titleSection).toBeInTheDocument();
      // Since framer-motion is mocked, we just verify the structure exists
    });

    it("applies motion props to feature cards", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");
      expect(featureCards).toHaveLength(3);
      // Since framer-motion is mocked, we verify the cards have the expected structure
    });

    it("applies motion props to Get Started button section", () => {
      render(<CateringFeatures />);

      const button = screen.getByRole("button", { name: "Get Started" });
      const buttonSection = button.closest("div");
      expect(buttonSection).toBeInTheDocument();
      // Since framer-motion is mocked, we just verify the section exists
    });
  });

  describe("Accessibility", () => {
    it("has proper semantic structure", () => {
      render(<CateringFeatures />);

      // Check that we have a main container (already tested)
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
    });

    it("feature cards are properly structured for screen readers", () => {
      render(<CateringFeatures />);

      const featureCards = screen.getAllByTestId("feature-card");

      featureCards.forEach(card => {
        const heading = card.querySelector("h3");
        const description = card.querySelector("p");

        expect(heading).toBeInTheDocument();
        expect(description).toBeInTheDocument();
        expect(heading?.tagName).toBe("H3");
      });
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive grid classes", () => {
      render(<CateringFeatures />);

      const grid = screen.getByRole("main").querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-3");
    });

    it("applies responsive padding classes", () => {
      render(<CateringFeatures />);

      const container = screen.getByRole("main");
      expect(container).toHaveClass("py-16", "md:py-20");
    });

    it("applies responsive title classes", () => {
      render(<CateringFeatures />);

      const title = screen.getByText("More Than Just Delivery");
      expect(title).toHaveClass("text-4xl", "md:text-5xl", "lg:text-6xl");
    });
  });
});
