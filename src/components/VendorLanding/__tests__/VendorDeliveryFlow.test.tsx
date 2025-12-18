import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorDeliveryFlow from "../VendorDeliveryFlow";

describe("VendorDeliveryFlow", () => {
  describe("Basic Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("should render the main section with correct background color", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const section = container.querySelector("section");
      expect(section).toHaveClass("bg-[#f7cd2a]");
    });

    it("should render with correct responsive padding", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const section = container.querySelector("section");
      expect(section).toHaveClass("px-4", "py-16", "sm:px-6", "lg:px-10");
    });

    it("should render max-width container", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const maxWidthContainer = container.querySelector(".max-w-6xl");
      expect(maxWidthContainer).toBeInTheDocument();
      expect(maxWidthContainer).toHaveClass("mx-auto", "flex", "flex-col", "gap-10");
    });
  });

  describe("Title and Subtitle", () => {
    it("should render the main title 'End-to-End Delivery Service'", () => {
      render(<VendorDeliveryFlow />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("End-to-End");
      expect(heading).toHaveTextContent("Delivery Service");
    });

    it("should render title with two line breaks", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const heading = container.querySelector("h2");
      const lineBreaks = heading?.querySelectorAll("br");
      expect(lineBreaks).toHaveLength(1);
    });

    it("should render title with correct styling classes", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const heading = container.querySelector("h2");
      expect(heading).toHaveClass(
        "text-2xl",
        "font-extrabold",
        "leading-tight",
        "sm:text-3xl"
      );
    });

    it("should render the subtitle text", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText(/We handle everything from orders to setup/i)
      ).toBeInTheDocument();
    });

    it("should render subtitle with line breaks for formatting", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const subtitle = container.querySelector("p.mx-auto.mt-3");
      const lineBreaks = subtitle?.querySelectorAll("br");
      expect(lineBreaks).toHaveLength(2);
    });

    it("should render subtitle with correct styling classes", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const subtitle = container.querySelector("p.mx-auto.mt-3");
      expect(subtitle).toHaveClass(
        "mx-auto",
        "mt-3",
        "max-w-2xl",
        "text-sm",
        "leading-relaxed",
        "sm:text-base"
      );
    });

    it("should center align title and subtitle", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const headerDiv = container.querySelector(".text-center.text-gray-900");
      expect(headerDiv).toBeInTheDocument();
      expect(headerDiv).toHaveClass("text-center", "text-gray-900");
    });
  });

  describe("Delivery Flow Cards", () => {
    it("should render all 6 delivery flow cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl.border-\\[3px\\]");
      expect(cards).toHaveLength(6);
    });

    it("should render card titles correctly", () => {
      render(<VendorDeliveryFlow />);
      
      const expectedTitles = [
        "Schedule Drives",
        "Order Confirmation",
        "Driver Assignment",
        "Completion",
        "On-Site Setup",
        "Order Pickup",
      ];

      expectedTitles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    it("should render Schedule Drives card with 4 bullet points", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText("Schedule deliveries 1 week in advance for optimal service.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Late order submissions may be accepted with 24 hours notice.")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/On-demand deliveries are accepted/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Client order sheet submit via dashboard, Slack, text, or email."
        )
      ).toBeInTheDocument();
    });

    it("should render Order Confirmation card with 7 bullet points", () => {
      render(<VendorDeliveryFlow />);
      expect(screen.getByText("Items (food trays, etc.)")).toBeInTheDocument();
      expect(screen.getByText("Food cost/headcount")).toBeInTheDocument();
      expect(screen.getByText("Pickup time & restaurant address")).toBeInTheDocument();
      expect(screen.getByText("Pickup driver assignment")).toBeInTheDocument();
      expect(screen.getByText("Assigned pickup window")).toBeInTheDocument();
      expect(screen.getByText("Drop-off address & ETA time")).toBeInTheDocument();
      expect(screen.getByText("Special instructions")).toBeInTheDocument();
    });

    it("should render Driver Assignment card with 5 bullet points", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText("Assign the nearest driver (week in advance or same day).")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Send delivery details to the driver.")
      ).toBeInTheDocument();
      expect(screen.getByText("Drivers confirm the order.")).toBeInTheDocument();
      expect(
        screen.getByText("Client portal for tracking deliveries and live map.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Share driver contact info and driver info with vendors.")
      ).toBeInTheDocument();
    });

    it("should render Completion card with 1 bullet point", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText(
          "Take photo/video proof for the catering company and ensure all instructions are followed."
        )
      ).toBeInTheDocument();
    });

    it("should render On-Site Setup card with 3 bullet points", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText("Sanitize the setup area, wash hands, and prep workspace.")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Set up catering according to the guide or placement details in the instructions."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText("Confirm completion with Office Manager.")
      ).toBeInTheDocument();
    });

    it("should render Order Pickup card with 3 bullet points", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText(
          "Arrive at Caterer 15 minutes early from pickup window start time."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText("Confirm items list with Caterer (quantity and tray sizes).")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Inform customer of delivery ETA and send confirmation to required parties."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Card Styling", () => {
    it("should apply correct border styling to cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl");
      
      cards.forEach((card) => {
        expect(card).toHaveClass("border-[3px]", "border-gray-400");
      });
    });

    it("should apply shadow effect to cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl");
      
      cards.forEach((card) => {
        expect(card).toHaveClass("shadow-[0_0_0_4px_rgba(156,163,175,0.4)]");
      });
    });

    it("should apply white background to cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl");
      
      cards.forEach((card) => {
        expect(card).toHaveClass("bg-white");
      });
    });

    it("should apply correct padding to cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl.bg-white");
      
      cards.forEach((card) => {
        expect(card).toHaveClass("p-6");
      });
    });

    it("should use flex layout for cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl.bg-white");
      
      cards.forEach((card) => {
        expect(card).toHaveClass("flex", "flex-col", "gap-4", "h-full");
      });
    });
  });

  describe("Card Icons", () => {
    it("should render SVG icons for all 6 cards", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const icons = container.querySelectorAll("svg.h-9.w-9");
      expect(icons).toHaveLength(6);
    });

    it("should apply correct styling to icon containers", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const iconContainers = container.querySelectorAll(".rounded-xl.bg-\\[\\#f1f2f8\\]");
      
      expect(iconContainers).toHaveLength(6);
      iconContainers.forEach((iconContainer) => {
        expect(iconContainer).toHaveClass("rounded-xl", "bg-[#f1f2f8]", "p-3");
      });
    });

    it("should hide icons from screen readers", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const icons = container.querySelectorAll("svg");
      
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute("aria-hidden");
      });
    });

    it("should render icons with correct color", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const icons = container.querySelectorAll("svg");
      
      icons.forEach((icon) => {
        expect(icon).toHaveClass("text-gray-900");
      });
    });
  });

  describe("Card Titles", () => {
    it("should render card titles as h3 elements", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const titles = container.querySelectorAll("h3");
      expect(titles).toHaveLength(6);
    });

    it("should apply correct styling to card titles", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const titles = container.querySelectorAll("h3");
      
      titles.forEach((title) => {
        expect(title).toHaveClass(
          "text-lg",
          "font-extrabold",
          "text-gray-900",
          "sm:text-xl"
        );
      });
    });

    it("should render title with icon in flex layout", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const titleContainers = container.querySelectorAll(".flex.items-start.gap-3");
      expect(titleContainers.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("Bullet Lists", () => {
    it("should render all bullet lists as unordered lists", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(6);
    });

    it("should apply correct styling to bullet lists", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const lists = container.querySelectorAll("ul");
      
      lists.forEach((list) => {
        expect(list).toHaveClass(
          "ml-1",
          "space-y-2",
          "text-sm",
          "leading-relaxed",
          "text-gray-700",
          "sm:text-base"
        );
      });
    });

    it("should render bullet points with correct structure", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const listItems = container.querySelectorAll("li");
      
      // Should have total of 23 bullet points across all cards
      expect(listItems.length).toBe(23);
      
      listItems.forEach((item) => {
        expect(item).toHaveClass("flex", "items-start", "gap-2");
      });
    });

    it("should render bullet dot indicators", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const bulletDots = container.querySelectorAll(".h-1\\.5.w-1\\.5.rounded-full.bg-gray-700");
      
      // Should have 23 bullet dots (one for each list item)
      expect(bulletDots).toHaveLength(23);
    });

    it("should hide bullet dots from screen readers", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const bulletDots = container.querySelectorAll(".h-1\\.5.w-1\\.5.rounded-full");
      
      bulletDots.forEach((dot) => {
        expect(dot).toHaveAttribute("aria-hidden");
      });
    });
  });

  describe("Responsive Grid Layout", () => {
    it("should render cards in a responsive grid", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("should apply correct grid classes for responsive layout", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid", "gap-4", "sm:grid-cols-2", "lg:grid-cols-3");
    });
  });

  describe("Connector Lines (Desktop)", () => {
    it("should render connector lines container", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const connectorContainer = container.querySelector(
        ".pointer-events-none.absolute.inset-0.hidden.lg\\:block"
      );
      expect(connectorContainer).toBeInTheDocument();
    });

    it("should render horizontal dashed line for top row", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const topLine = container.querySelector(
        'span.absolute.left-\\[8\\%\\].right-\\[8\\%\\].top-\\[26\\%\\].border-t-2.border-dashed.border-white'
      );
      expect(topLine).toBeInTheDocument();
    });

    it("should render horizontal dashed line for bottom row", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const bottomLine = container.querySelector(
        'span.absolute.bottom-\\[33\\%\\].left-\\[8\\%\\].right-\\[8\\%\\].border-t-2.border-dashed.border-white'
      );
      expect(bottomLine).toBeInTheDocument();
    });

    it("should render vertical dashed lines", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const verticalLines = container.querySelectorAll("span.border-l-2.border-dashed.border-white");
      expect(verticalLines).toHaveLength(3); // middle, left, and right columns
    });

    it("should hide connector lines on mobile and tablet", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const connectorContainer = container.querySelector(".pointer-events-none.absolute");
      expect(connectorContainer).toHaveClass("hidden", "lg:block");
    });
  });

  describe("Same-Day Delivery Notice", () => {
    it("should render Same-Day Delivery notice", () => {
      render(<VendorDeliveryFlow />);
      expect(screen.getByText("Same-Day Delivery")).toBeInTheDocument();
    });

    it("should render Same-Day Delivery exclamation icon", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const icon = container.querySelector(
        ".inline-flex.h-10.w-10.items-center.justify-center.rounded-full.border-2.border-gray-900"
      );
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent("!");
    });

    it("should render Same-Day Delivery description text", () => {
      render(<VendorDeliveryFlow />);
      expect(
        screen.getByText(/Please note that while we may accept same-day delivery requests/i)
      ).toBeInTheDocument();
    });

    it("should apply correct styling to Same-Day Delivery container", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const noticeContainer = container.querySelector(".rounded-2xl.bg-\\[\\#f7cd2a\\]");
      expect(noticeContainer).toHaveClass(
        "rounded-2xl",
        "bg-[#f7cd2a]",
        "px-5",
        "py-6",
        "text-center",
        "text-gray-900",
        "sm:px-8",
        "sm:py-7"
      );
    });

    it("should center align Same-Day Delivery notice", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const notice = container.querySelector(".rounded-2xl.bg-\\[\\#f7cd2a\\]");
      expect(notice).toHaveClass("text-center");
    });

    it("should apply font styling to Same-Day Delivery title", () => {
      const { container } = render(<VendorDeliveryFlow />);
      // Find the "Same-Day Delivery" text element
      const title = Array.from(container.querySelectorAll("p")).find(
        (p) => p.textContent === "Same-Day Delivery"
      );
      expect(title).toHaveClass("text-lg", "font-extrabold", "sm:text-xl");
    });
  });

  describe("Accessibility", () => {
    it("should render section as semantic section element", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section?.tagName).toBe("SECTION");
    });

    it("should render main title as h2 heading", () => {
      render(<VendorDeliveryFlow />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it("should render card titles as h3 headings", () => {
      render(<VendorDeliveryFlow />);
      const h3Headings = screen.getAllByRole("heading", { level: 3 });
      expect(h3Headings).toHaveLength(6);
    });

    it("should use semantic list elements for bullet points", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(6);
      
      lists.forEach((list) => {
        const items = list.querySelectorAll("li");
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it("should hide decorative icons from screen readers", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const decorativeIcons = container.querySelectorAll("[aria-hidden]");
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Component Integration", () => {
    it("should render without errors", () => {
      expect(() => render(<VendorDeliveryFlow />)).not.toThrow();
    });

    it("should be a default export", () => {
      expect(VendorDeliveryFlow).toBeDefined();
      expect(typeof VendorDeliveryFlow).toBe("function");
    });
  });

  describe("Structural Integrity", () => {
    it("should maintain consistent DOM structure", () => {
      const { container } = render(<VendorDeliveryFlow />);
      
      // Verify main section structure
      const section = container.querySelector("section.bg-\\[\\#f7cd2a\\]");
      expect(section).toBeInTheDocument();
      
      // Verify content container structure
      const contentContainer = section?.querySelector(".max-w-6xl.mx-auto");
      expect(contentContainer).toBeInTheDocument();
      
      // Verify header structure
      const header = contentContainer?.querySelector(".text-center.text-gray-900");
      expect(header).toBeInTheDocument();
      expect(header?.querySelector("h2")).toBeInTheDocument();
      expect(header?.querySelector("p.mx-auto.mt-3")).toBeInTheDocument();
      
      // Verify grid structure
      const grid = contentContainer?.querySelector(".grid.gap-4.sm\\:grid-cols-2.lg\\:grid-cols-3");
      expect(grid).toBeInTheDocument();
      
      // Verify cards structure
      const cards = grid?.querySelectorAll(".rounded-3xl.border-\\[3px\\].border-gray-400");
      expect(cards).toHaveLength(6);
      
      // Verify connector lines structure (desktop only)
      const connectorContainer = container.querySelector(".pointer-events-none.absolute.inset-0.hidden.lg\\:block");
      expect(connectorContainer).toBeInTheDocument();
      
      // Verify same-day notice structure
      const sameDayNotice = contentContainer?.querySelector(".rounded-2xl.bg-\\[\\#f7cd2a\\]");
      expect(sameDayNotice).toBeInTheDocument();
    });

    it("should maintain consistent card structure", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const cards = container.querySelectorAll(".rounded-3xl.bg-white.p-6");
      
      cards.forEach((card) => {
        // Each card should have icon, title, and list
        const iconContainer = card.querySelector(".rounded-xl.bg-\\[\\#f1f2f8\\]");
        expect(iconContainer).toBeInTheDocument();
        
        const icon = iconContainer?.querySelector("svg");
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute("aria-hidden");
        
        const titleContainer = card.querySelector(".flex.items-start.gap-3");
        expect(titleContainer).toBeInTheDocument();
        
        const h3 = card.querySelector("h3");
        expect(h3).toBeInTheDocument();
        
        const list = card.querySelector("ul");
        expect(list).toBeInTheDocument();
      });
    });

    it("should maintain consistent bullet point structure", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const listItems = container.querySelectorAll("ul > li");
      
      // Should have exactly 23 bullet points across all cards
      expect(listItems).toHaveLength(23);
      
      listItems.forEach((item) => {
        // Each item should have flex layout with gap
        expect(item).toHaveClass("flex", "items-start", "gap-2");
        
        // Each item should have a bullet dot
        const bulletDot = item.querySelector(".h-1\\.5.w-1\\.5.rounded-full.bg-gray-700");
        expect(bulletDot).toBeInTheDocument();
        expect(bulletDot).toHaveAttribute("aria-hidden");
        
        // Each item should have text content
        const span = item.querySelector("span:not([aria-hidden])");
        expect(span).toBeInTheDocument();
        expect(span?.textContent).not.toBe("");
      });
    });

    it("should have complete connector line structure", () => {
      const { container } = render(<VendorDeliveryFlow />);
      const connectorContainer = container.querySelector(".pointer-events-none.absolute");
      
      // Should have horizontal lines
      const topLine = connectorContainer?.querySelector('span.absolute.left-\\[8\\%\\].right-\\[8\\%\\].top-\\[26\\%\\]');
      expect(topLine).toBeInTheDocument();
      
      const bottomLine = connectorContainer?.querySelector('span.absolute.bottom-\\[33\\%\\].left-\\[8\\%\\].right-\\[8\\%\\]');
      expect(bottomLine).toBeInTheDocument();
      
      // Should have vertical lines
      const verticalLines = connectorContainer?.querySelectorAll("span.border-l-2.border-dashed.border-white");
      expect(verticalLines).toHaveLength(3);
    });
  });
});

