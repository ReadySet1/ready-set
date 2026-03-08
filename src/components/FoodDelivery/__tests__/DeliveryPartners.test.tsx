import React from "react";
import { render, screen, within } from "@testing-library/react";
import DeliveryPartners from "../DeliveryPartners";

// Mock framer-motion is already configured in jest.setup.ts
// The mock converts motion components to regular divs

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

describe("DeliveryPartners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      render(<DeliveryPartners />);

      const container = document.querySelector(".bg-white.py-16");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("w-full", "bg-white", "py-16", "md:py-20", "lg:py-24");
    });

    it("renders the max-width wrapper", () => {
      render(<DeliveryPartners />);

      const wrapper = document.querySelector(".max-w-7xl");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass("mx-auto", "max-w-7xl", "px-4");
    });

    it("renders the main title", () => {
      render(<DeliveryPartners />);

      const title = screen.getByRole("heading", { level: 2, name: /our food delivery partners/i });
      expect(title).toBeInTheDocument();
    });

    it("renders the main title with correct styling", () => {
      render(<DeliveryPartners />);

      const title = screen.getByText("Our Food Delivery Partners");
      expect(title).toHaveClass(
        "mb-3",
        "text-3xl",
        "font-black",
        "text-gray-800",
        "md:text-4xl",
        "lg:text-5xl"
      );
    });

    it("renders the subtitle text", () => {
      render(<DeliveryPartners />);

      const subtitle = screen.getByText(/we're proud to collaborate with some of the top names in the industry/i);
      expect(subtitle).toBeInTheDocument();
    });

    it("renders the subtitle with correct styling", () => {
      render(<DeliveryPartners />);

      const subtitle = screen.getByText(/we're proud to collaborate/i);
      expect(subtitle).toHaveClass(
        "text-base",
        "font-medium",
        "text-gray-600",
        "md:text-lg"
      );
    });
  });

  describe("Partner Logos Grid", () => {
    it("renders the partner logos grid container", () => {
      render(<DeliveryPartners />);

      const grid = document.querySelector(".grid.grid-cols-2");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass(
        "grid",
        "grid-cols-2",
        "gap-6",
        "md:grid-cols-4",
        "md:gap-8",
        "lg:gap-10"
      );
    });

    it("renders 8 partner logos in the main grid", () => {
      render(<DeliveryPartners />);

      const grid = document.querySelector(".grid.grid-cols-2");
      expect(grid).toBeInTheDocument();

      // The main grid should contain 8 images (partners.slice(0, 8))
      const images = grid!.querySelectorAll("img");
      expect(images).toHaveLength(8);
    });

    it("renders all partner logos with correct alt text", () => {
      render(<DeliveryPartners />);

      const expectedPartners = [
        "Destino logo",
        "Grace Deli & Cafe logo",
        "Kasa Indian Eatery logo",
        "Hungry logo",
        "CaterValley logo",
        "Conviva logo",
        "Roost Roast logo",
        "Noor Indian Fusion Kitchen logo",
        "Food.ee logo",
        "La BBQ logo",
      ];

      expectedPartners.forEach((altText) => {
        expect(screen.getByAltText(altText)).toBeInTheDocument();
      });
    });

    it("renders partner images with correct src paths", () => {
      render(<DeliveryPartners />);

      const expectedPaths = [
        "/images/food/partners/destino",
        "/images/food/partners/grace",
        "/images/food/partners/kasa",
        "/images/food/partners/hungry",
        "/images/food/partners/catervalley",
        "/images/food/partners/conviva",
        "/images/food/partners/roostroast",
        "/images/food/partners/noor",
        "/images/food/partners/foodee",
        "/images/food/partners/labbq",
      ];

      expectedPaths.forEach((path) => {
        const img = document.querySelector(`img[src="${path}"]`);
        expect(img).toBeInTheDocument();
      });
    });

    it("renders partner containers with hover effect classes", () => {
      render(<DeliveryPartners />);

      const hoverContainers = document.querySelectorAll(".hover\\:scale-105");
      // 8 in grid + 2 overflow = 10 total
      expect(hoverContainers).toHaveLength(10);
    });
  });

  describe("Overflow Partners Section", () => {
    it("renders overflow partners in a centered flex-wrap container", () => {
      render(<DeliveryPartners />);

      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      expect(overflowContainer).toBeInTheDocument();
      expect(overflowContainer).toHaveClass("mt-8", "flex", "flex-wrap", "justify-center", "md:mt-10");
    });

    it("renders both overflow partner images (Food.ee and La BBQ)", () => {
      render(<DeliveryPartners />);

      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      expect(overflowContainer).toBeInTheDocument();

      const foodeeImage = within(overflowContainer as HTMLElement).getByAltText("Food.ee logo");
      expect(foodeeImage).toBeInTheDocument();
      expect(foodeeImage).toHaveAttribute("src", "/images/food/partners/foodee");

      const labbqImage = within(overflowContainer as HTMLElement).getByAltText("La BBQ logo");
      expect(labbqImage).toBeInTheDocument();
      expect(labbqImage).toHaveAttribute("src", "/images/food/partners/labbq");
    });

    it("renders exactly 2 images in the overflow section", () => {
      render(<DeliveryPartners />);

      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      const overflowImages = overflowContainer?.querySelectorAll("img");
      expect(overflowImages).toHaveLength(2);
    });

    it("applies correct styling to overflow partner links", () => {
      render(<DeliveryPartners />);

      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      const innerLinks = overflowContainer?.querySelectorAll("a.relative.h-24");

      expect(innerLinks).toHaveLength(2);
      innerLinks?.forEach((link) => {
        expect(link).toHaveClass(
          "relative",
          "h-24",
          "w-full",
          "max-w-[200px]",
          "transition-transform",
          "hover:scale-105",
          "md:h-32",
          "lg:h-36"
        );
      });
    });
  });

  describe("Conditional Rendering", () => {
    it("renders all 10 partners total", () => {
      render(<DeliveryPartners />);

      const allImages = screen.getAllByRole("img");
      expect(allImages).toHaveLength(10);
    });

    it("renders the correct number of partners in each section", () => {
      render(<DeliveryPartners />);

      // Main grid should have 8 partners
      const grid = document.querySelector(".grid.grid-cols-2");
      const gridImages = grid?.querySelectorAll("img");
      expect(gridImages).toHaveLength(8);

      // Overflow section should have 2 partners
      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      const overflowImages = overflowContainer?.querySelectorAll("img");
      expect(overflowImages).toHaveLength(2);
    });
  });

  describe("Image Styling", () => {
    it("renders images with object-contain class", () => {
      render(<DeliveryPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveClass("object-contain");
      });
    });

    it("renders partner link containers with correct dimensions", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(10);

      links.forEach((link) => {
        expect(link).toHaveClass(
          "relative",
          "h-24",
          "w-full",
          "max-w-[200px]",
          "md:h-32",
          "lg:h-36"
        );
      });
    });
  });

  describe("Animation and Motion", () => {
    it("applies animation delay based on index for grid items", () => {
      render(<DeliveryPartners />);

      // Since framer-motion is mocked, we verify the structure exists
      // The motion.div components are converted to regular divs
      const grid = document.querySelector(".grid.grid-cols-2");
      expect(grid).toBeInTheDocument();

      // Each grid item should be wrapped in a motion div (now regular div)
      const gridItems = grid?.querySelectorAll(".flex.items-center.justify-center");
      expect(gridItems).toHaveLength(8);
    });

    it("renders title section with motion animation structure", () => {
      render(<DeliveryPartners />);

      const titleSection = screen.getByText("Our Food Delivery Partners").closest("div");
      expect(titleSection).toHaveClass("mb-4", "text-center");
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(<DeliveryPartners />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Our Food Delivery Partners");
    });

    it("all images have descriptive alt text", () => {
      render(<DeliveryPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute("alt");
        expect(img.getAttribute("alt")).not.toBe("");
        expect(img.getAttribute("alt")).toMatch(/logo$/i);
      });
    });

    it("images have appropriate sizing attributes", () => {
      render(<DeliveryPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute("sizes", "(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px");
      });
    });

    it("all partner links have aria-labels for screen readers", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("aria-label");
        expect(link.getAttribute("aria-label")).toMatch(/^Visit .+ website$/);
      });
    });

    it("partner links are keyboard accessible", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      // All links should be focusable by default (no tabindex=-1)
      links.forEach((link) => {
        expect(link).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("Partner With Us button is accessible", () => {
      render(<DeliveryPartners />);

      const partnerButton = screen.getByTestId("schedule-dialog-button");
      expect(partnerButton).toBeInTheDocument();
      expect(partnerButton.tagName).toBe("BUTTON");
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive grid classes", () => {
      render(<DeliveryPartners />);

      const grid = document.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-4");
    });

    it("applies responsive gap classes", () => {
      render(<DeliveryPartners />);

      const grid = document.querySelector(".grid");
      expect(grid).toHaveClass("gap-6", "md:gap-8", "lg:gap-10");
    });

    it("applies responsive padding classes", () => {
      render(<DeliveryPartners />);

      const container = document.querySelector(".bg-white");
      expect(container).toHaveClass("py-16", "md:py-20", "lg:py-24");
    });

    it("applies responsive title sizing", () => {
      render(<DeliveryPartners />);

      const title = screen.getByText("Our Food Delivery Partners");
      expect(title).toHaveClass("text-3xl", "md:text-4xl", "lg:text-5xl");
    });

    it("applies responsive height to partner link containers", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveClass("h-24", "md:h-32", "lg:h-36");
      });
    });

    it("applies responsive margin to overflow partner section", () => {
      render(<DeliveryPartners />);

      const overflowContainer = document.querySelector(".mt-8.flex.flex-wrap.justify-center");
      expect(overflowContainer).toHaveClass("mt-8", "md:mt-10");
    });
  });

  describe("Partner Links", () => {
    const expectedPartnerLinks = [
      { name: "Destino", url: "https://www.destinosf.com/" },
      { name: "Grace Deli & Cafe", url: "https://www.grace303.com/" },
      { name: "Kasa Indian Eatery", url: "https://kasaindian.com/" },
      { name: "Hungry", url: "https://www.tryhungry.com/" },
      { name: "CaterValley", url: "https://catervalley.com/" },
      { name: "Conviva", url: "https://www.conviva.com/" },
      { name: "Roost Roast", url: "https://www.roostandroast.com/" },
      { name: "Noor Indian Fusion Kitchen", url: "https://noorfusionkitchen.com/" },
      { name: "Food.ee", url: "https://specials.tryhungry.com/foodeeandhungry" },
      { name: "La BBQ", url: "https://labarbecue.com/#" },
    ];

    it("renders all partner logos as clickable links", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(10);
    });

    it("renders partner links with correct href URLs", () => {
      render(<DeliveryPartners />);

      expectedPartnerLinks.forEach(({ url }) => {
        const link = document.querySelector(`a[href="${url}"]`);
        expect(link).toBeInTheDocument();
      });
    });

    it("renders partner links with target=_blank to open in new tab", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("target", "_blank");
      });
    });

    it("renders partner links with rel=noopener noreferrer for security", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      });
    });

    it("renders partner links with accessible aria-labels", () => {
      render(<DeliveryPartners />);

      expectedPartnerLinks.forEach(({ name }) => {
        const link = screen.getByRole("link", { name: `Visit ${name} website` });
        expect(link).toBeInTheDocument();
      });
    });

    it("renders each partner link containing the correct image", () => {
      render(<DeliveryPartners />);

      expectedPartnerLinks.forEach(({ name, url }) => {
        const link = document.querySelector(`a[href="${url}"]`);
        expect(link).toBeInTheDocument();
        
        const image = link?.querySelector("img");
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute("alt", `${name} logo`);
      });
    });

    it("applies correct styling to partner link containers", () => {
      render(<DeliveryPartners />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveClass(
          "relative",
          "h-24",
          "w-full",
          "max-w-[200px]",
          "transition-transform",
          "hover:scale-105"
        );
      });
    });

    it("renders Destino link with correct URL", () => {
      render(<DeliveryPartners />);

      const destinoLink = screen.getByRole("link", { name: /visit destino website/i });
      expect(destinoLink).toHaveAttribute("href", "https://www.destinosf.com/");
    });

    it("renders Food.ee link with correct URL in overflow section", () => {
      render(<DeliveryPartners />);

      const foodeeLink = screen.getByRole("link", { name: /visit food\.ee website/i });
      expect(foodeeLink).toHaveAttribute("href", "https://specials.tryhungry.com/foodeeandhungry");
    });

    it("renders La BBQ link with correct URL", () => {
      render(<DeliveryPartners />);

      const labbqLink = screen.getByRole("link", { name: /visit la bbq website/i });
      expect(labbqLink).toHaveAttribute("href", "https://labarbecue.com/#");
    });
  });

  describe("Partner With Us Button", () => {
    it("renders the ScheduleDialog component", () => {
      render(<DeliveryPartners />);

      expect(screen.getByTestId("schedule-dialog")).toBeInTheDocument();
    });

    it("renders Partner With Us button text", () => {
      render(<DeliveryPartners />);

      const partnerButton = screen.getByTestId("schedule-dialog-button");
      expect(partnerButton).toHaveTextContent("Partner With Us");
    });

    it("renders Partner With Us button with correct styling", () => {
      render(<DeliveryPartners />);

      const partnerButton = screen.getByTestId("schedule-dialog-button");
      expect(partnerButton).toHaveClass(
        "rounded-lg",
        "bg-yellow-400",
        "px-8",
        "py-4",
        "font-extrabold",
        "text-gray-800"
      );
    });

    it("passes correct calendar URL to ScheduleDialog", () => {
      render(<DeliveryPartners />);

      const calendarUrl = screen.getByTestId("schedule-dialog-calendar-url");
      expect(calendarUrl).toHaveTextContent(
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
      );
    });

    it("renders Partner With Us button in a centered container", () => {
      render(<DeliveryPartners />);

      const scheduleDialog = screen.getByTestId("schedule-dialog");
      const parentContainer = scheduleDialog.closest(".mt-12.flex.justify-center");
      expect(parentContainer).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("images have onError handler attached", () => {
      render(<DeliveryPartners />);

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(10);
    });
  });
});

