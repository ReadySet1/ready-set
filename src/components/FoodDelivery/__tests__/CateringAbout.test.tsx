import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CateringAbout from "../CateringAbout";

// Mock framer-motion since it's mocked in jest.setup.ts
// The mock converts motion components to regular divs

// Mock ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => {
  return {
    __esModule: true,
    default: function MockScheduleDialog({
      buttonText,
      dialogTitle,
      dialogDescription,
      calendarUrl,
      customButton,
    }: {
      buttonText: string;
      dialogTitle: string;
      dialogDescription: string;
      calendarUrl: string;
      customButton?: React.ReactNode;
    }) {
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
    },
  };
});

describe("CateringAbout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      const { container } = render(<CateringAbout />);

      const mainContainer = container.querySelector(".w-full.bg-white");
      expect(mainContainer).toHaveClass("w-full", "bg-white", "py-16", "md:py-20", "lg:py-24");
    });

    it("renders the max-width wrapper", () => {
      const { container } = render(<CateringAbout />);

      const wrapper = container.querySelector(".mx-auto.max-w-7xl");
      expect(wrapper).toHaveClass("mx-auto", "max-w-7xl", "px-4");
    });

    it("renders the grid layout container", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass(
        "grid",
        "grid-cols-1",
        "gap-12",
        "lg:grid-cols-2",
        "lg:gap-16"
      );
    });
  });

  describe("Left Column - Image and Stats", () => {
    it("renders the left column with correct flex styling", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      const leftColumn = grid?.firstElementChild;
      expect(leftColumn).toHaveClass("flex", "flex-col");
    });

    it("renders the image with correct props", () => {
      render(<CateringAbout />);

      const image = screen.getByAltText("Restaurant owners reviewing catering orders");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/food/catering-about");
      expect(image).toHaveAttribute("width", "800");
      expect(image).toHaveAttribute("height", "600");
      expect(image).toHaveClass("h-auto", "w-full", "object-cover");
    });

    it("renders the stats description text", () => {
      render(<CateringAbout />);

      const statsText = screen.getByText(/Since 2019, we've completed over 338,000 successful catering deliveries/);
      expect(statsText).toHaveClass(
        "mb-8",
        "text-center",
        "font-[Montserrat]",
        "text-base",
        "font-medium",
        "text-gray-700",
        "md:text-lg"
      );
    });

    it("renders the top stats grid container with 3 columns", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      // First grid is the main layout, second is top stats, third is bottom stats
      const topStatsGrid = statsGrids[1];
      expect(topStatsGrid).toHaveClass("grid", "grid-cols-1", "gap-4", "sm:grid-cols-3", "mb-4");
    });

    it("renders the bottom stats grid container with 2 columns and max-width", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const bottomStatsGrid = statsGrids[2];
      expect(bottomStatsGrid).toHaveClass("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2", "sm:max-w-[66%]");
    });
  });

  describe("Stat Cards", () => {
    it("renders all five stat cards", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      expect(statCards).toHaveLength(5);
    });

    it("renders the first stat card (2019 Founded)", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];

      expect(firstCard).toHaveTextContent("2019");
      expect(firstCard).toHaveTextContent("Founded");
    });

    it("renders the second stat card (350+ Restaurants Served)", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const secondCard = statCards[1];

      expect(secondCard).toHaveTextContent("350+");
      expect(secondCard).toHaveTextContent("Restaurants Served");
    });

    it("renders the third stat card (338K+ Deliveries Completed)", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const thirdCard = statCards[2];

      expect(thirdCard).toHaveTextContent("338K+");
      expect(thirdCard).toHaveTextContent("Deliveries Completed");
    });

    it("renders the fourth stat card (200+ Professional Drivers)", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const fourthCard = statCards[3];

      expect(fourthCard).toHaveTextContent("200+");
      expect(fourthCard).toHaveTextContent("Professional Drivers");
    });

    it("renders the fifth stat card (98% On-Time Delivery Rate)", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const fifthCard = statCards[4];

      expect(fifthCard).toHaveTextContent("98%");
      expect(fifthCard).toHaveTextContent("On-Time Delivery Rate");
    });

    it("renders top row with exactly 3 stat cards", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const topStatsGrid = statsGrids[1];
      const topStatCards = topStatsGrid?.querySelectorAll('[data-testid="stat-card"]');

      expect(topStatCards).toHaveLength(3);
    });

    it("renders bottom row with exactly 2 stat cards", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const bottomStatsGrid = statsGrids[2];
      const bottomStatCards = bottomStatsGrid?.querySelectorAll('[data-testid="stat-card"]');

      expect(bottomStatCards).toHaveLength(2);
    });
  });

  describe("Right Column - Content", () => {
    it("renders the right column with correct flex styling", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      const rightColumn = grid?.children[1];
      expect(rightColumn).toHaveClass("flex", "flex-col", "justify-center");
    });

    it("renders the main title with correct styling", () => {
      render(<CateringAbout />);

      const title = screen.getByText("Delivery Designed for Your Catering");
      expect(title).toHaveClass(
        "mb-6",
        "font-[Montserrat]",
        "text-3xl",
        "font-black",
        "leading-tight",
        "text-gray-800",
        "md:text-4xl",
        "lg:text-5xl"
      );
    });

    it("renders the first description paragraph", () => {
      render(<CateringAbout />);

      const paragraph = screen.getByText(/At Ready Set, we specialize in catering delivery logistics/);
      expect(paragraph).toHaveClass(
        "font-[Montserrat]",
        "text-base",
        "leading-relaxed",
        "text-gray-700",
        "md:text-lg"
      );
    });

    it("renders the second description paragraph", () => {
      render(<CateringAbout />);

      const paragraph = screen.getByText(/We're not a marketplace or broker/);
      expect(paragraph).toHaveClass(
        "font-[Montserrat]",
        "text-base",
        "leading-relaxed",
        "text-gray-700",
        "md:text-lg"
      );
    });
  });

  describe("ScheduleDialog Integration", () => {
    it("renders the How Our Service Works button section", () => {
      render(<CateringAbout />);

      const button = screen.getByRole("button", { name: "How Our Service Works" });
      expect(button).toBeInTheDocument();

      // Verify the button has the correct styling
      expect(button).toHaveClass(
        "rounded-lg",
        "bg-yellow-400",
        "px-12",
        "py-4",
        "font-extrabold"
      );
    });

    it("renders the ScheduleDialog with correct props", () => {
      render(<CateringAbout />);

      const scheduleDialog = screen.getByTestId("schedule-dialog");
      expect(scheduleDialog).toBeInTheDocument();

      expect(screen.getByTestId("schedule-dialog-button-text")).toHaveTextContent("How Our Service Works");
      expect(screen.getByTestId("schedule-dialog-title")).toHaveTextContent("Schedule an Appointment");
      expect(screen.getByTestId("schedule-dialog-description")).toHaveTextContent("Choose a convenient time for your appointment.");
      expect(screen.getByTestId("schedule-dialog-calendar-url")).toHaveTextContent("https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true");
    });

    it("renders the custom button within ScheduleDialog with correct text", () => {
      render(<CateringAbout />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      expect(customButton).toBeInTheDocument();

      const button = customButton.querySelector("button");
      expect(button).toHaveTextContent("How Our Service Works");
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

  describe("StatCard Component", () => {
    it("renders StatCard with correct card styling", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];

      // Check the card wrapper has the correct card styling with background
      expect(firstCard).toHaveClass(
        "flex",
        "flex-col",
        "items-center",
        "justify-center",
        "rounded-2xl",
        "bg-gray-100",
        "px-6",
        "py-8",
        "text-center",
        "shadow-sm"
      );
    });

    it("renders StatCard value with italic styling", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];

      // Check the value (h3) has correct styling including italic
      const value = firstCard.querySelector("h3");
      expect(value).toHaveClass(
        "mb-2",
        "font-[Montserrat]",
        "text-3xl",
        "font-black",
        "italic",
        "text-yellow-400",
        "md:text-4xl"
      );
    });

    it("renders StatCard label with correct styling", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];

      // Check the label (p) has correct styling
      const label = firstCard.querySelector("p");
      expect(label).toHaveClass(
        "font-[Montserrat]",
        "text-base",
        "font-semibold",
        "text-gray-800",
        "md:text-lg"
      );
    });
  });

  describe("Animation and Motion", () => {
    it("applies motion props to left column", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      const leftColumn = grid?.firstElementChild;
      expect(leftColumn).toBeInTheDocument();
      // Since framer-motion is mocked, we just verify the structure exists
    });

    it("applies motion props to right column", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      const rightColumn = grid?.children[1];
      expect(rightColumn).toBeInTheDocument();
      // Since framer-motion is mocked, we verify the column has the expected structure
    });

    it("applies motion props to stat description", () => {
      render(<CateringAbout />);

      const statsText = screen.getByText(/Since 2019, we've completed over 338,000 successful catering deliveries/);
      expect(statsText).toBeInTheDocument();
      // Since framer-motion is mocked, we just verify the text exists
    });

    it("applies motion props to How Our Service Works button section", () => {
      render(<CateringAbout />);

      const button = screen.getByRole("button", { name: "How Our Service Works" });
      expect(button).toBeInTheDocument();
      // Since framer-motion is mocked, we just verify the button exists
    });
  });

  describe("Accessibility", () => {
    it("has proper semantic structure", () => {
      render(<CateringAbout />);

      // Check that images have alt text
      const image = screen.getByAltText("Restaurant owners reviewing catering orders");
      expect(image).toBeInTheDocument();

      // Check that headings are properly structured
      const h2 = screen.getByRole("heading", { level: 2 });
      expect(h2).toHaveTextContent("Delivery Designed for Your Catering");

      // Check that stat cards have proper heading structure (5 stat cards)
      const statHeadings = screen.getAllByRole("heading", { level: 3 });
      expect(statHeadings).toHaveLength(5);
    });

    it("stat cards are properly structured for screen readers", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");

      statCards.forEach(card => {
        const heading = card.querySelector("h3");
        expect(heading).toBeInTheDocument();
        expect(heading?.tagName).toBe("H3");
      });
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive grid classes", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1", "lg:grid-cols-2");
    });

    it("applies responsive gap classes", () => {
      const { container } = render(<CateringAbout />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("gap-12", "lg:gap-16");
    });

    it("applies responsive padding classes", () => {
      const { container } = render(<CateringAbout />);

      const mainContainer = container.querySelector(".w-full.bg-white");
      expect(mainContainer).toHaveClass("py-16", "md:py-20", "lg:py-24");
    });

    it("applies responsive title classes", () => {
      render(<CateringAbout />);

      const title = screen.getByText("Delivery Designed for Your Catering");
      expect(title).toHaveClass("text-3xl", "md:text-4xl", "lg:text-5xl");
    });

    it("applies responsive stat value classes", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];
      const value = firstCard.querySelector("h3");

      expect(value).toHaveClass("text-3xl", "md:text-4xl");
    });

    it("applies responsive stat label classes", () => {
      render(<CateringAbout />);

      const statCards = screen.getAllByTestId("stat-card");
      const firstCard = statCards[0];
      const label = firstCard.querySelector("p");

      expect(label).toHaveClass("text-base", "md:text-lg");
    });

    it("applies responsive top stats grid classes", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const topStatsGrid = statsGrids[1];
      expect(topStatsGrid).toHaveClass("grid-cols-1", "sm:grid-cols-3");
    });

    it("applies responsive bottom stats grid classes", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const bottomStatsGrid = statsGrids[2];
      expect(bottomStatsGrid).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    });

    it("applies responsive text classes", () => {
      render(<CateringAbout />);

      const paragraph = screen.getByText(/At Ready Set, we specialize in catering delivery logistics/);
      expect(paragraph).toHaveClass("text-base", "md:text-lg");
    });
  });

  describe("Content Accuracy", () => {
    it("displays all five stats with correct data", () => {
      render(<CateringAbout />);

      // Top row stats
      expect(screen.getByText("2019")).toBeInTheDocument();
      expect(screen.getByText("Founded")).toBeInTheDocument();
      expect(screen.getByText("350+")).toBeInTheDocument();
      expect(screen.getByText("Restaurants Served")).toBeInTheDocument();
      expect(screen.getByText("338K+")).toBeInTheDocument();
      expect(screen.getByText("Deliveries Completed")).toBeInTheDocument();

      // Bottom row stats
      expect(screen.getByText("200+")).toBeInTheDocument();
      expect(screen.getByText("Professional Drivers")).toBeInTheDocument();
      expect(screen.getByText("98%")).toBeInTheDocument();
      expect(screen.getByText("On-Time Delivery Rate")).toBeInTheDocument();
    });

    it("displays correct company description", () => {
      render(<CateringAbout />);

      expect(screen.getByText(/Since launching in 2019 in the San Francisco Bay Area/)).toBeInTheDocument();
      expect(screen.getByText(/we've expanded to Austin, Atlanta, and Dallas/)).toBeInTheDocument();
      expect(screen.getByText(/we specialize in catering delivery logistics/i)).toBeInTheDocument();
    });

    it("displays correct service description", () => {
      render(<CateringAbout />);

      expect(screen.getByText(/We're not a marketplace or broker/)).toBeInTheDocument();
      expect(screen.getByText(/we don't take customer orders or list you on apps/)).toBeInTheDocument();
      expect(screen.getByText(/we act as your behind-the-scenes delivery partner/)).toBeInTheDocument();
    });

    it("displays correct button text (How Our Service Works)", () => {
      render(<CateringAbout />);

      const button = screen.getByRole("button", { name: "How Our Service Works" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("How Our Service Works");
    });
  });

  describe("Stats Layout Structure", () => {
    it("renders stats in correct 3+2 grid layout", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");

      // Should have 3 grids total: main layout, top stats, bottom stats
      expect(statsGrids.length).toBeGreaterThanOrEqual(3);

      // Top stats grid should have 3-column layout on sm screens
      const topStatsGrid = statsGrids[1];
      expect(topStatsGrid).toHaveClass("sm:grid-cols-3");

      // Bottom stats grid should have 2-column layout on sm screens
      const bottomStatsGrid = statsGrids[2];
      expect(bottomStatsGrid).toHaveClass("sm:grid-cols-2");
    });

    it("bottom stats grid has max-width constraint", () => {
      const { container } = render(<CateringAbout />);

      const statsGrids = container.querySelectorAll(".grid");
      const bottomStatsGrid = statsGrids[2];

      expect(bottomStatsGrid).toHaveClass("sm:max-w-[66%]");
    });
  });
});
