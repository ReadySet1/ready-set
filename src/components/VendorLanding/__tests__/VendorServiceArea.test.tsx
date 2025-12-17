import { render, screen } from "@testing-library/react";
import VendorServiceArea from "../VendorServiceArea";

describe("VendorServiceArea", () => {
  describe("Component Rendering", () => {
    it("renders without crashing", () => {
      render(<VendorServiceArea />);
      expect(
        screen.getByRole("region", { name: /our service area/i })
      ).toBeInTheDocument();
    });

    it("renders the main heading", () => {
      render(<VendorServiceArea />);
      expect(
        screen.getByRole("heading", { name: /our service area/i, level: 2 })
      ).toBeInTheDocument();
    });

    it("renders all three service area columns", () => {
      render(<VendorServiceArea />);
      expect(
        screen.getByRole("heading", { name: /bay area california/i, level: 3 })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /austin texas/i, level: 3 })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /dallas area/i, level: 3 })
      ).toBeInTheDocument();
    });
  });

  describe("Bay Area California Locations", () => {
    beforeEach(() => {
      render(<VendorServiceArea />);
    });

    it("displays San Francisco", () => {
      expect(screen.getByText("SAN FRANCISCO")).toBeInTheDocument();
    });

    it("displays Marin", () => {
      expect(screen.getByText("MARIN")).toBeInTheDocument();
    });

    it("displays Contra Costa", () => {
      expect(screen.getByText("CONTRA COSTA")).toBeInTheDocument();
    });

    it("displays Alameda", () => {
      expect(screen.getByText("ALAMEDA")).toBeInTheDocument();
    });

    it("displays Santa Clara", () => {
      expect(screen.getByText("SANTA CLARA")).toBeInTheDocument();
    });

    it("displays San Mateo", () => {
      expect(screen.getByText("SAN MATEO")).toBeInTheDocument();
    });

    it("displays Santa Cruz", () => {
      expect(screen.getByText("SANTA CRUZ")).toBeInTheDocument();
    });

    it("displays all 7 Bay Area locations", () => {
      const bayAreaLocations = [
        "SAN FRANCISCO",
        "MARIN",
        "CONTRA COSTA",
        "ALAMEDA",
        "SANTA CLARA",
        "SAN MATEO",
        "SANTA CRUZ",
      ];

      bayAreaLocations.forEach((location) => {
        expect(screen.getByText(location)).toBeInTheDocument();
      });
    });
  });

  describe("Austin Texas Locations", () => {
    beforeEach(() => {
      render(<VendorServiceArea />);
    });

    it("displays Northwest Austin", () => {
      expect(screen.getByText("Northwest Austin")).toBeInTheDocument();
    });

    it("displays North Austin", () => {
      expect(screen.getByText("North Austin")).toBeInTheDocument();
    });

    it("displays Northeast Austin", () => {
      expect(screen.getByText("Northeast Austin")).toBeInTheDocument();
    });

    it("displays East Austin", () => {
      expect(screen.getByText("East Austin")).toBeInTheDocument();
    });

    it("displays Central Austin", () => {
      expect(screen.getByText("Central Austin")).toBeInTheDocument();
    });

    it("displays Southeast Austin", () => {
      expect(screen.getByText("Southeast Austin")).toBeInTheDocument();
    });

    it("displays South Austin", () => {
      expect(screen.getByText("South Austin")).toBeInTheDocument();
    });

    it("displays Southwest Austin", () => {
      expect(screen.getByText("Southwest Austin")).toBeInTheDocument();
    });

    it("displays West Austin", () => {
      expect(screen.getByText("West Austin")).toBeInTheDocument();
    });

    it("displays all 9 Austin locations", () => {
      const austinLocations = [
        "Northwest Austin",
        "North Austin",
        "Northeast Austin",
        "East Austin",
        "Central Austin",
        "Southeast Austin",
        "South Austin",
        "Southwest Austin",
        "West Austin",
      ];

      austinLocations.forEach((location) => {
        expect(screen.getByText(location)).toBeInTheDocument();
      });
    });
  });

  describe("Dallas Area Locations", () => {
    beforeEach(() => {
      render(<VendorServiceArea />);
    });

    it("displays Collin County", () => {
      expect(screen.getByText("Collin County")).toBeInTheDocument();
    });

    it("displays Dallas County", () => {
      expect(screen.getByText("Dallas County")).toBeInTheDocument();
    });

    it("displays Denton County", () => {
      expect(screen.getByText("Denton County")).toBeInTheDocument();
    });

    it("displays Rockwall County", () => {
      expect(screen.getByText("Rockwall County")).toBeInTheDocument();
    });

    it("displays Tarrant County", () => {
      expect(screen.getByText("Tarrant County")).toBeInTheDocument();
    });

    it("displays all 5 Dallas area locations", () => {
      const dallasLocations = [
        "Collin County",
        "Dallas County",
        "Denton County",
        "Rockwall County",
        "Tarrant County",
      ];

      dallasLocations.forEach((location) => {
        expect(screen.getByText(location)).toBeInTheDocument();
      });
    });
  });

  describe("Area Labels", () => {
    it("displays 'Areas' label for each service region", () => {
      render(<VendorServiceArea />);
      // There should be 3 "Areas" labels (one for each region)
      const areaLabels = screen.getAllByText("Areas");
      expect(areaLabels).toHaveLength(3);
    });
  });

  describe("Accessibility", () => {
    it("has proper aria-labelledby attribute on section", () => {
      render(<VendorServiceArea />);
      const section = screen.getByRole("region", { name: /our service area/i });
      expect(section).toHaveAttribute(
        "aria-labelledby",
        "vendor-service-area-heading"
      );
    });

    it("has correct heading hierarchy (h2 main, h3 regions)", () => {
      render(<VendorServiceArea />);
      // Main heading is h2
      expect(
        screen.getByRole("heading", { name: /our service area/i, level: 2 })
      ).toBeInTheDocument();

      // Region headings are h3
      expect(
        screen.getByRole("heading", { name: /bay area california/i, level: 3 })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /austin texas/i, level: 3 })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /dallas area/i, level: 3 })
      ).toBeInTheDocument();
    });

    it("uses semantic article elements for each service area", () => {
      const { container } = render(<VendorServiceArea />);
      const articles = container.querySelectorAll("article");
      expect(articles).toHaveLength(3);
    });

    it("uses semantic header elements within articles", () => {
      const { container } = render(<VendorServiceArea />);
      const headers = container.querySelectorAll("article > header");
      expect(headers).toHaveLength(3);
    });

    it("uses unordered lists for locations", () => {
      const { container } = render(<VendorServiceArea />);
      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(3);
    });

    it("has proper list structure with list items", () => {
      const { container } = render(<VendorServiceArea />);
      const listItems = container.querySelectorAll("ul > li");
      // Total locations: 7 (Bay Area) + 9 (Austin) + 5 (Dallas) = 21
      expect(listItems).toHaveLength(21);
    });
  });

  describe("Styling and Layout", () => {
    it("applies white background to section", () => {
      const { container } = render(<VendorServiceArea />);
      const section = container.querySelector("section");
      expect(section).toHaveClass("bg-white");
    });

    it("applies grid layout classes", () => {
      const { container } = render(<VendorServiceArea />);
      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("gap-6", "md:grid-cols-2", "lg:grid-cols-3");
    });

    it("applies rounded corners to article cards", () => {
      const { container } = render(<VendorServiceArea />);
      const articles = container.querySelectorAll("article");
      articles.forEach((article) => {
        expect(article).toHaveClass("rounded-2xl");
      });
    });

    it("applies border styling to article cards", () => {
      const { container } = render(<VendorServiceArea />);
      const articles = container.querySelectorAll("article");
      articles.forEach((article) => {
        expect(article).toHaveClass("border", "border-gray-200");
      });
    });
  });

  describe("Data Integrity", () => {
    it("renders exactly 21 total locations across all regions", () => {
      render(<VendorServiceArea />);
      const allLocations = [
        // Bay Area (7)
        "SAN FRANCISCO",
        "MARIN",
        "CONTRA COSTA",
        "ALAMEDA",
        "SANTA CLARA",
        "SAN MATEO",
        "SANTA CRUZ",
        // Austin (9)
        "Northwest Austin",
        "North Austin",
        "Northeast Austin",
        "East Austin",
        "Central Austin",
        "Southeast Austin",
        "South Austin",
        "Southwest Austin",
        "West Austin",
        // Dallas (5)
        "Collin County",
        "Dallas County",
        "Denton County",
        "Rockwall County",
        "Tarrant County",
      ];

      allLocations.forEach((location) => {
        expect(screen.getByText(location)).toBeInTheDocument();
      });
    });

    it("renders regions in correct order: Bay Area, Austin, Dallas", () => {
      const { container } = render(<VendorServiceArea />);
      const headings = container.querySelectorAll("article > header > h3");
      expect(headings[0]).toHaveTextContent("Bay Area California");
      expect(headings[1]).toHaveTextContent("Austin Texas");
      expect(headings[2]).toHaveTextContent("Dallas Area");
    });
  });

  describe("Structural Integrity", () => {
    it("should maintain consistent DOM structure", () => {
      const { container } = render(<VendorServiceArea />);
      
      // Verify main section structure
      const section = container.querySelector("section.bg-white");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("aria-labelledby", "vendor-service-area-heading");
      
      // Verify main container structure
      const mainContainer = section?.querySelector(".mx-auto.max-w-6xl");
      expect(mainContainer).toBeInTheDocument();
      
      // Verify heading structure
      const heading = mainContainer?.querySelector("h2#vendor-service-area-heading");
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Our Service Area");
      
      // Verify grid structure
      const grid = mainContainer?.querySelector(".grid.gap-6.md\\:grid-cols-2.lg\\:grid-cols-3");
      expect(grid).toBeInTheDocument();
      
      // Verify article cards
      const articles = grid?.querySelectorAll("article");
      expect(articles).toHaveLength(3);
    });

    it("should maintain consistent article card structure", () => {
      const { container } = render(<VendorServiceArea />);
      const articles = container.querySelectorAll("article");
      
      expect(articles).toHaveLength(3);
      
      articles.forEach((article) => {
        // Each article should have proper classes
        expect(article).toHaveClass("rounded-2xl", "border", "border-gray-200", "bg-white");
        
        // Each article should have a header with h3
        const header = article.querySelector("header");
        expect(header).toBeInTheDocument();
        
        const h3 = header?.querySelector("h3");
        expect(h3).toBeInTheDocument();
        expect(h3?.textContent).not.toBe("");
        
        // Each article should have "Areas" label (in the content div, not header)
        const contentDiv = article.querySelector(".flex-1.space-y-4");
        expect(contentDiv).toBeInTheDocument();
        
        const areasLabel = contentDiv?.querySelector(".text-sm.font-semibold");
        expect(areasLabel).toBeInTheDocument();
        expect(areasLabel).toHaveTextContent("Areas");
        
        // Each article should have a list
        const list = article.querySelector("ul");
        expect(list).toBeInTheDocument();
        
        const listItems = list?.querySelectorAll("li");
        expect(listItems && listItems.length).toBeGreaterThan(0);
      });
    });

    it("should maintain consistent location list item structure", () => {
      const { container } = render(<VendorServiceArea />);
      const allListItems = container.querySelectorAll("ul > li");
      
      // Total should be 21 locations
      expect(allListItems).toHaveLength(21);
      
      allListItems.forEach((item) => {
        // Each item should be a list item
        expect(item.tagName).toBe("LI");
        
        // Each item should contain a div with the location
        const locationDiv = item.querySelector("div");
        expect(locationDiv).toBeInTheDocument();
        expect(locationDiv).toHaveClass("rounded-md", "bg-gray-50");
        
        // Each item should have text content
        expect(item.textContent).not.toBe("");
        expect(item.textContent?.trim().length).toBeGreaterThan(0);
      });
    });

    it("should maintain correct region distribution", () => {
      const { container } = render(<VendorServiceArea />);
      const articles = container.querySelectorAll("article");
      
      // Bay Area (7 locations)
      const bayAreaList = articles[0]?.querySelector("ul");
      expect(bayAreaList?.children).toHaveLength(7);
      
      // Austin (9 locations)
      const austinList = articles[1]?.querySelector("ul");
      expect(austinList?.children).toHaveLength(9);
      
      // Dallas (5 locations)
      const dallasList = articles[2]?.querySelector("ul");
      expect(dallasList?.children).toHaveLength(5);
    });

    it("should maintain semantic HTML structure", () => {
      const { container } = render(<VendorServiceArea />);
      
      // Should use section element
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section?.tagName).toBe("SECTION");
      
      // Should use article elements
      const articles = container.querySelectorAll("article");
      expect(articles).toHaveLength(3);
      articles.forEach(article => {
        expect(article.tagName).toBe("ARTICLE");
      });
      
      // Should use header elements
      const headers = container.querySelectorAll("article > header");
      expect(headers).toHaveLength(3);
      headers.forEach(header => {
        expect(header.tagName).toBe("HEADER");
      });
      
      // Should use proper heading hierarchy
      const h2 = container.querySelector("h2");
      expect(h2).toBeInTheDocument();
      
      const h3Elements = container.querySelectorAll("h3");
      expect(h3Elements).toHaveLength(3);
      
      // Should use unordered lists
      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(3);
      lists.forEach(list => {
        expect(list.tagName).toBe("UL");
      });
    });
  });
});

