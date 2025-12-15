import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorServiceDrivers from "../VendorServiceDrivers";

describe("VendorServiceDrivers", () => {
  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<VendorServiceDrivers />);
      expect(container).toBeInTheDocument();
    });

    it("should render the section with correct aria-labelledby", () => {
      render(<VendorServiceDrivers />);
      const section = screen.getByRole("region");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute(
        "aria-labelledby",
        "vendor-service-drivers-heading",
      );
    });

    it("should render both card components", () => {
      const { container } = render(<VendorServiceDrivers />);
      const cards = container.querySelectorAll("article");
      expect(cards).toHaveLength(2);
    });
  });

  describe("Service Model Card", () => {
    it("should render the Service Model card title", () => {
      render(<VendorServiceDrivers />);
      expect(screen.getByText("Our Service Model")).toBeInTheDocument();
    });

    it("should render the main service description", () => {
      render(<VendorServiceDrivers />);
      expect(
        screen.getByText(/Our focus is on providing professional delivery/i),
      ).toBeInTheDocument();
    });

    it("should emphasize that the service is not a marketplace", () => {
      render(<VendorServiceDrivers />);
      expect(
        screen.getByText(/We are not a marketplace or broker/i),
      ).toBeInTheDocument();
    });

    it("should emphasize that the service does not take customer orders", () => {
      render(<VendorServiceDrivers />);
      expect(
        screen.getByText(
          /We do not take customer orders or list you on an app/i,
        ),
      ).toBeInTheDocument();
    });

    it("should render all service model points", () => {
      render(<VendorServiceDrivers />);

      const servicePoints = [
        "You receive and manage your own catering orders.",
        "When the order is ready, you book us for pickup and drop-off.",
        "You only pay a delivery fee. There are no commissions or marketplace charges.",
      ];

      servicePoints.forEach((point) => {
        expect(screen.getByText(point)).toBeInTheDocument();
      });
    });

    it("should render service points in a list", () => {
      const { container } = render(<VendorServiceDrivers />);
      const lists = container.querySelectorAll("ul");
      expect(lists.length).toBeGreaterThanOrEqual(1);
    });

    it("should render service points as list items", () => {
      const { container } = render(<VendorServiceDrivers />);
      const serviceCard = screen
        .getByText("Our Service Model")
        .closest("article");
      const listItems = serviceCard?.querySelectorAll("li");
      expect(listItems).toHaveLength(3);
    });
  });

  describe("Drivers Card", () => {
    it("should render the Drivers card title", () => {
      render(<VendorServiceDrivers />);
      expect(screen.getByText("Our Drivers")).toBeInTheDocument();
    });

    it("should render the main drivers description", () => {
      render(<VendorServiceDrivers />);
      expect(
        screen.getByText(
          /Our drivers are carefully vetted and thoroughly trained/i,
        ),
      ).toBeInTheDocument();
    });

    it("should render all driver qualification points", () => {
      render(<VendorServiceDrivers />);

      const driverPoints = [
        "Certified in proper food handling",
        "Required insulated bags & suitable vehicles",
        "Set up assistance as instructed",
        "Professional and customer-friendly",
        "GPS-tracked for on-time delivery",
      ];

      driverPoints.forEach((point) => {
        expect(screen.getByText(point)).toBeInTheDocument();
      });
    });

    it("should render driver points as list items", () => {
      const { container } = render(<VendorServiceDrivers />);
      const driversCard = screen.getByText("Our Drivers").closest("article");
      const listItems = driversCard?.querySelectorAll("li");
      expect(listItems).toHaveLength(5);
    });

    it("should display driver count information", () => {
      render(<VendorServiceDrivers />);
      expect(screen.getByText(/200\+/i)).toBeInTheDocument();
    });

    it("should list all service markets", () => {
      render(<VendorServiceDrivers />);
      const marketsText = screen.getByText(
        /SF Bay Area, Austin, Atlanta, and Dallas/i,
      );
      expect(marketsText).toBeInTheDocument();
    });

    it("should emphasize driver count with strong tag", () => {
      const { container } = render(<VendorServiceDrivers />);
      const driversCard = screen.getByText("Our Drivers").closest("article");
      const strongElements = driversCard?.querySelectorAll("strong");

      // Should have at least one strong element for "200+"
      expect(strongElements!.length).toBeGreaterThan(0);

      // Check that "200+" is in a strong element
      const has200Plus = Array.from(strongElements || []).some(
        (el) => el.textContent === "200+",
      );
      expect(has200Plus).toBe(true);
    });
  });

  describe("Card Component Structure", () => {
    it("should render cards as article elements", () => {
      const { container } = render(<VendorServiceDrivers />);
      const articles = container.querySelectorAll("article");
      expect(articles).toHaveLength(2);
    });

    it("should have correct card styling classes", () => {
      const { container } = render(<VendorServiceDrivers />);
      const cards = container.querySelectorAll("article");

      cards.forEach((card) => {
        expect(card).toHaveClass(
          "flex",
          "h-full",
          "flex-col",
          "rounded-[32px]",
          "border-4",
          "border-gray-300",
          "bg-white",
        );
      });
    });

    it("should have responsive padding on cards", () => {
      const { container } = render(<VendorServiceDrivers />);
      const cards = container.querySelectorAll("article");

      cards.forEach((card) => {
        expect(card).toHaveClass("p-8", "sm:p-10");
      });
    });

    it("should render card titles in styled containers", () => {
      const { container } = render(<VendorServiceDrivers />);

      const titleContainers = container.querySelectorAll(
        ".bg-\\[\\#333333\\].text-white",
      );

      expect(titleContainers.length).toBe(2);

      titleContainers.forEach((titleContainer) => {
        expect(titleContainer).toHaveClass(
          "rounded-2xl",
          "font-extrabold",
          "text-center",
        );
      });
    });

    it("should have responsive font sizes for card titles", () => {
      const { container } = render(<VendorServiceDrivers />);

      const titleContainers = container.querySelectorAll(
        ".bg-\\[\\#333333\\].text-white",
      );

      titleContainers.forEach((titleContainer) => {
        expect(titleContainer).toHaveClass("text-2xl", "sm:text-3xl");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic HTML structure", () => {
      const { container } = render(<VendorServiceDrivers />);

      // Check for section element
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();

      // Check for article elements
      const articles = section?.querySelectorAll("article");
      expect(articles?.length).toBe(2);
    });

    it("should have aria-labelledby attribute on section", () => {
      render(<VendorServiceDrivers />);

      const section = screen.getByRole("region");
      expect(section).toHaveAttribute(
        "aria-labelledby",
        "vendor-service-drivers-heading",
      );
    });

    it("should render lists with proper list markup", () => {
      const { container } = render(<VendorServiceDrivers />);

      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(2);

      lists.forEach((list) => {
        expect(list).toHaveClass("list-disc");
        const listItems = list.querySelectorAll("li");
        expect(listItems.length).toBeGreaterThan(0);
      });
    });

    it("should have semantic article elements for cards", () => {
      const { container } = render(<VendorServiceDrivers />);
      const articles = container.querySelectorAll("article");

      expect(articles).toHaveLength(2);

      articles.forEach((article) => {
        expect(article.tagName).toBe("ARTICLE");
      });
    });

    it("should use strong tags for emphasis appropriately", () => {
      const { container } = render(<VendorServiceDrivers />);
      const strongElements = container.querySelectorAll("strong");

      // Should have at least 4 strong elements (2 in service model, 1 in drivers)
      expect(strongElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Responsive Design", () => {
    it("should have responsive section padding", () => {
      const { container } = render(<VendorServiceDrivers />);
      const section = container.querySelector("section");

      expect(section).toHaveClass("py-14", "sm:py-16", "lg:py-20");
    });

    it("should have responsive grid layout", () => {
      const { container } = render(<VendorServiceDrivers />);
      const gridContainer = container.querySelector(".grid");

      expect(gridContainer).toHaveClass("md:grid-cols-2");
    });

    it("should have responsive gap classes", () => {
      const { container } = render(<VendorServiceDrivers />);
      const gridContainer = container.querySelector(".grid");

      expect(gridContainer).toHaveClass("gap-6", "md:gap-8");
    });

    it("should have responsive horizontal padding on container", () => {
      const { container } = render(<VendorServiceDrivers />);
      const mainContainer = container.querySelector(".max-w-6xl");

      expect(mainContainer).toHaveClass("px-4", "sm:px-6");
    });

    it("should have max-width constraint on container", () => {
      const { container } = render(<VendorServiceDrivers />);
      const mainContainer = container.querySelector(".max-w-6xl");

      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass("mx-auto");
    });

    it("should have responsive text sizes in card content", () => {
      const { container } = render(<VendorServiceDrivers />);
      const contentDivs = container.querySelectorAll(".text-\\[15px\\]");

      // Both cards should have responsive text
      expect(contentDivs.length).toBe(2);

      contentDivs.forEach((div) => {
        expect(div).toHaveClass("sm:text-base");
      });
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct background color on section", () => {
      const { container } = render(<VendorServiceDrivers />);
      const section = container.querySelector("section");

      expect(section).toHaveClass("bg-white");
    });

    it("should have full width section", () => {
      const { container } = render(<VendorServiceDrivers />);
      const section = container.querySelector("section");

      expect(section).toHaveClass("w-full");
    });

    it("should apply proper spacing between list items", () => {
      const { container } = render(<VendorServiceDrivers />);
      const lists = container.querySelectorAll("ul");

      lists.forEach((list) => {
        expect(list).toHaveClass("space-y-3");
      });
    });

    it("should have proper list indentation", () => {
      const { container } = render(<VendorServiceDrivers />);
      const lists = container.querySelectorAll("ul");

      lists.forEach((list) => {
        expect(list).toHaveClass("pl-5");
      });
    });

    it("should apply relaxed line height to content", () => {
      const { container } = render(<VendorServiceDrivers />);
      const contentDivs = container.querySelectorAll(".leading-relaxed");

      expect(contentDivs.length).toBe(2);
    });

    it("should center content in cards with max-width", () => {
      const { container } = render(<VendorServiceDrivers />);
      const contentDivs = container.querySelectorAll(".max-w-md");

      // Both cards should have max-width content
      expect(contentDivs.length).toBe(2);

      contentDivs.forEach((div) => {
        expect(div).toHaveClass("mx-auto");
      });
    });

    it("should apply shadow to cards", () => {
      const { container } = render(<VendorServiceDrivers />);
      const cards = container.querySelectorAll("article");

      cards.forEach((card) => {
        expect(card).toHaveClass("shadow-sm");
      });
    });
  });

  describe("Content Integrity", () => {
    it("should maintain correct number of service points", () => {
      const { container } = render(<VendorServiceDrivers />);
      const serviceCard = screen
        .getByText("Our Service Model")
        .closest("article");
      const listItems = serviceCard?.querySelectorAll("li");

      expect(listItems).toHaveLength(3);
    });

    it("should maintain correct number of driver qualification points", () => {
      const { container } = render(<VendorServiceDrivers />);
      const driversCard = screen.getByText("Our Drivers").closest("article");
      const listItems = driversCard?.querySelectorAll("li");

      expect(listItems).toHaveLength(5);
    });

    it("should render complete service model description", () => {
      render(<VendorServiceDrivers />);

      const description = screen.getByText(
        /Our focus is on providing professional delivery that keeps your customers happy/i,
      );

      expect(description).toBeInTheDocument();
    });

    it("should render complete drivers description", () => {
      render(<VendorServiceDrivers />);

      const description = screen.getByText(
        /Our drivers are carefully vetted and thoroughly trained to meet the demands of catering delivery/i,
      );

      expect(description).toBeInTheDocument();
    });
  });

  describe("Typography", () => {
    it("should apply correct text color to card content", () => {
      const { container } = render(<VendorServiceDrivers />);
      const contentDivs = container.querySelectorAll(".text-gray-800");

      expect(contentDivs.length).toBe(2);
    });

    it("should apply extrabold font weight to titles", () => {
      const { container } = render(<VendorServiceDrivers />);
      const titleContainers = container.querySelectorAll(".font-extrabold");

      expect(titleContainers.length).toBeGreaterThanOrEqual(2);
    });

    it("should have proper title padding", () => {
      const { container } = render(<VendorServiceDrivers />);
      const titleContainers = container.querySelectorAll(".bg-\\[\\#333333\\]");

      titleContainers.forEach((title) => {
        expect(title).toHaveClass("px-6", "py-4");
      });
    });

    it("should have proper title bottom margin", () => {
      const { container } = render(<VendorServiceDrivers />);
      const titleContainers = container.querySelectorAll(".bg-\\[\\#333333\\]");

      titleContainers.forEach((title) => {
        expect(title).toHaveClass("mb-8");
      });
    });
  });
});
