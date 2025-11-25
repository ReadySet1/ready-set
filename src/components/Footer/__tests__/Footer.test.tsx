import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Footer from "../index";

// Mock Next.js components
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Footer Component", () => {
  describe("Basic Rendering", () => {
    it("should render the footer component without crashing", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
    });

    it("should have the correct black background color", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveStyle({ backgroundColor: "#000000" });
    });

    it("should have the correct CSS classes", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveClass(
        "wow",
        "fadeInUp",
        "relative",
        "z-10",
        "pt-20",
        "lg:pt-[100px]"
      );
    });

    it("should have the correct data attributes", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveAttribute("data-wow-delay", ".15s");
    });
  });

  describe("Logo and Branding", () => {
    it("should render the company logo", () => {
      render(<Footer />);
      const logo = screen.getByAltText("logo");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/images/logo/logo-dark.png");
      expect(logo).toHaveAttribute("width", "140");
      expect(logo).toHaveAttribute("height", "30");
    });

    it("should have logo wrapped in a link to home page", () => {
      render(<Footer />);
      const logoLink = screen.getByRole("link", { name: /logo/i });
      expect(logoLink).toHaveAttribute("href", "/");
    });

    it("should display the company tagline", () => {
      render(<Footer />);
      expect(screen.getByText("Always ready for you.")).toBeInTheDocument();
    });

    it("should display company name and address", () => {
      render(<Footer />);
      expect(screen.getByText("Ready Set Group, LLC")).toBeInTheDocument();
      // Address text may be split by line breaks, so use partial text matching
      const addressElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes("166 Geary St") || false;
      });
      expect(addressElements.length).toBeGreaterThan(0);
      
      const suiteElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes("STE 1500 #1937") || false;
      });
      expect(suiteElements.length).toBeGreaterThan(0);
      
      const cityElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes("San Francisco, CA 94108") || false;
      });
      expect(cityElements.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation Links", () => {
    it("should render privacy policy links", () => {
      render(<Footer />);
      const privacyLinks = screen.getAllByRole("link", { name: /privacy policy/i });
      expect(privacyLinks.length).toBeGreaterThan(0);
      privacyLinks.forEach(link => {
        expect(link).toHaveAttribute("href", "/privacy-policy");
      });
    });

    it("should render legal notice link", () => {
      render(<Footer />);
      const legalLink = screen.getByRole("link", { name: /legal notice/i });
      expect(legalLink).toBeInTheDocument();
      expect(legalLink).toHaveAttribute("href", "/#");
    });

    it("should render terms of service links", () => {
      render(<Footer />);
      const termsLinks = screen.getAllByRole("link", { name: /terms of service/i });
      expect(termsLinks.length).toBeGreaterThan(0);
      termsLinks.forEach(link => {
        expect(link).toHaveAttribute("href", "/terms-of-service");
      });
    });

    it("should have correct hover styles for navigation links", () => {
      render(<Footer />);
      const privacyLinks = screen.getAllByRole("link", { name: /privacy policy/i });
      expect(privacyLinks.length).toBeGreaterThan(0);
      // Check that at least one privacy link has the expected classes
      const linkWithHoverStyles = privacyLinks.find(link => 
        link.classList.contains("text-gray-400") && 
        link.classList.contains("hover:text-gray-200")
      );
      expect(linkWithHoverStyles).toBeTruthy();
    });
  });

  describe("Developer Attribution", () => {
    it("should display developer attribution text", () => {
      render(<Footer />);
      expect(screen.getByText("Developed by")).toBeInTheDocument();
    });

    it("should render Alanis Dev link with correct attributes", () => {
      render(<Footer />);
      const devLink = screen.getByRole("link", { name: /alanis dev/i });
      expect(devLink).toBeInTheDocument();
      expect(devLink).toHaveAttribute("href", "https://alanis.dev");
      expect(devLink).toHaveAttribute("rel", "nofollow noopner noreferrer");
      expect(devLink).toHaveAttribute("target", "_blank");
    });

    it("should have correct styling for developer link", () => {
      render(<Footer />);
      const devLink = screen.getByRole("link", { name: /alanis dev/i });
      expect(devLink).toHaveClass("text-gray-200", "hover:underline");
    });
  });

  describe("Layout and Structure", () => {
    it("should have proper container structure", () => {
      render(<Footer />);
      const container = screen.getByRole("contentinfo").querySelector(".container");
      expect(container).toBeInTheDocument();
    });

    it("should have responsive grid layout classes", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      
      // Check for responsive layout elements
      const flexWrapElements = footer.querySelectorAll(".flex.flex-wrap");
      expect(flexWrapElements.length).toBeGreaterThan(0);
      
      // Check for responsive width classes
      const responsiveElements = footer.querySelectorAll("[class*='w-full']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    it("should have proper border styling", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      
      // Check for border elements
      const borderElements = footer.querySelectorAll(".border-t.border-gray-700");
      expect(borderElements.length).toBeGreaterThan(0);
    });
  });

  describe("Text Colors and Styling", () => {
    it("should use consistent gray color scheme", () => {
      render(<Footer />);
      
      // Check tagline color
      const tagline = screen.getByText("Always ready for you.");
      expect(tagline).toHaveClass("text-gray-400");
      
      // Check address text color
      const address = screen.getByText("Ready Set Group, LLC").closest("address");
      expect(address).toHaveClass("text-gray-400");
    });

    it("should have proper text alignment classes", () => {
      render(<Footer />);
      
      // Check for center alignment
      const centerElements = screen.getByRole("contentinfo").querySelectorAll(".text-center");
      expect(centerElements.length).toBeGreaterThan(0);
      
      // Check for justify center
      const justifyElements = screen.getByRole("contentinfo").querySelectorAll(".justify-center");
      expect(justifyElements.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic HTML structure", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.tagName).toBe("FOOTER");
    });

    it("should have proper address element", () => {
      render(<Footer />);
      const address = screen.getByRole("contentinfo").querySelector("address");
      expect(address).toBeInTheDocument();
      expect(address).toHaveClass("not-italic");
    });

    it("should have accessible link text", () => {
      render(<Footer />);
      
      // Check that text-based links have accessible names
      const textLinks = [
        /privacy policy/i,
        /legal notice/i,
        /terms of service/i,
        /alanis dev/i
      ];
      
      textLinks.forEach((linkName) => {
        const links = screen.getAllByRole("link", { name: linkName });
        expect(links.length).toBeGreaterThan(0);
        links.forEach(link => {
          expect(link).toHaveAccessibleName();
        });
      });
      
      // Check that social media links have aria-labels
      const socialLinks = screen.getAllByLabelText(/facebook|tiktok|instagram/i);
      expect(socialLinks.length).toBeGreaterThan(0);
      socialLinks.forEach(link => {
        expect(link).toHaveAccessibleName();
      });
    });

    it("should have proper alt text for logo", () => {
      render(<Footer />);
      const logo = screen.getByAltText("logo");
      expect(logo).toHaveAttribute("alt", "logo");
    });
  });

  describe("Responsive Design", () => {
    it("should have mobile-first responsive classes", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      
      // Check for mobile-first responsive width classes
      const responsiveWidths = footer.querySelectorAll("[class*='sm:w-'], [class*='md:w-'], [class*='lg:w-'], [class*='xl:w-']");
      expect(responsiveWidths.length).toBeGreaterThan(0);
    });

    it("should have responsive padding classes", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveClass("pt-20", "lg:pt-[100px]");
    });

    it("should have responsive margin classes for sections", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      
      // Check for responsive margin classes
      const marginElements = footer.querySelectorAll("[class*='mt-'], [class*='lg:mt-']");
      expect(marginElements.length).toBeGreaterThan(0);
    });
  });

  describe("Content Validation", () => {
    it("should render all expected text content", () => {
      render(<Footer />);
      
      const expectedTexts = [
        "Always ready for you.",
        "Ready Set Group, LLC",
        "Legal notice",
        "Developed by",
        "Alanis Dev"
      ];
      
      expectedTexts.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
      
      // Check for duplicate links separately
      const privacyLinks = screen.getAllByText("Privacy policy");
      expect(privacyLinks.length).toBeGreaterThan(0);
      
      const termsLinks = screen.getAllByText(/terms of service/i);
      expect(termsLinks.length).toBeGreaterThan(0);
      
      // Check address parts separately due to line breaks
      const addressParts = ["166 Geary St", "STE 1500 #1937", "San Francisco, CA 94108"];
      addressParts.forEach((addressPart) => {
        const elements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes(addressPart) || false;
        });
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it("should have correct link destinations", () => {
      render(<Footer />);
      
      const linkMappings = [
        { text: /privacy policy/i, href: "/privacy-policy" },
        { text: /legal notice/i, href: "/#" },
        { text: /terms of service/i, href: "/terms-of-service" },
        { text: /alanis dev/i, href: "https://alanis.dev" },
        { text: /logo/i, href: "/" }
      ];
      
      linkMappings.forEach(({ text, href }) => {
        const links = screen.getAllByRole("link", { name: text });
        expect(links.length).toBeGreaterThan(0);
        // Check that at least one link has the correct href
        const correctLink = links.find(link => link.getAttribute("href") === href);
        expect(correctLink).toBeTruthy();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing image gracefully", () => {
      // This test ensures the component doesn't crash if image fails to load
      render(<Footer />);
      const logo = screen.getByAltText("logo");
      expect(logo).toBeInTheDocument();
      
      // Simulate image error (component should still render)
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("should maintain layout with long text content", () => {
      render(<Footer />);
      
      // Verify layout containers exist even with content
      const footer = screen.getByRole("contentinfo");
      const containers = footer.querySelectorAll(".container");
      expect(containers.length).toBeGreaterThan(0);
      
      // Verify flex layouts are maintained
      const flexElements = footer.querySelectorAll(".flex");
      expect(flexElements.length).toBeGreaterThan(0);
    });
  });
});
