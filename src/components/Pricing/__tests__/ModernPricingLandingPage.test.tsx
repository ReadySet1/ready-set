import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModernPricingLandingPage from "../ModernPricingLandingPage";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
}));

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("ModernPricingLandingPage", () => {
  describe("Component Rendering", () => {
    it("should render the component without crashing", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("Pricing That Works For You")).toBeInTheDocument();
    });

    it("should render the logo", () => {
      render(<ModernPricingLandingPage />);
      const logo = screen.getByAltText("Ready Set Logo");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/images/logo/logo.png");
    });

    it("should render tab navigation", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("Delivery Pricing")).toBeInTheDocument();
      expect(screen.getByText("Hosting Services")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("should default to delivery tab", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("Delivery Rate Chart")).toBeInTheDocument();
    });

    it("should switch to hosting tab when clicked", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      expect(screen.getByText("Catering Hosting Services")).toBeInTheDocument();
    });

    it("should switch back to delivery tab when clicked", () => {
      render(<ModernPricingLandingPage />);
      
      // Switch to hosting
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      expect(screen.getByText("Catering Hosting Services")).toBeInTheDocument();
      
      // Switch back to delivery
      const deliveryButton = screen.getByRole("button", { name: /Delivery Pricing/i });
      fireEvent.click(deliveryButton);
      expect(screen.getByText("Delivery Rate Chart")).toBeInTheDocument();
    });
  });

  describe("Delivery Pricing Table", () => {
    it("should render all pricing tiers", () => {
      render(<ModernPricingLandingPage />);
      
      // Check for some sample headcount values
      expect(screen.getByText("0-24")).toBeInTheDocument();
      expect(screen.getByText("25-49")).toBeInTheDocument();
      expect(screen.getByText("100-124")).toBeInTheDocument();
      expect(screen.getByText("300+")).toBeInTheDocument();
    });

    it("should render table headers", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("Headcount")).toBeInTheDocument();
      expect(screen.getByText("Food Cost")).toBeInTheDocument();
      expect(screen.getByText("Delivery Cost")).toBeInTheDocument();
    });

    it("should display correct delivery costs", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("$60")).toBeInTheDocument(); // 0-24 headcount
      expect(screen.getByText("$70")).toBeInTheDocument(); // 25-49 headcount
    });
  });

  describe("Hosting Options - Critical Delivery Fee Logic", () => {
    beforeEach(() => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
    });

    it("should render all four hosting options", () => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Option B")).toBeInTheDocument();
      expect(screen.getByText("Option C")).toBeInTheDocument();
      expect(screen.getByText("Option D")).toBeInTheDocument();
    });

    it("should show delivery fee for Option A (includesDelivery: true)", () => {
      const optionA = screen.getByText("Option A").closest("div");
      expect(optionA).toBeInTheDocument();
      
      // Find all delivery fee texts and verify at least one exists
      const deliveryFees = screen.getAllByText("+ Delivery Fee");
      expect(deliveryFees.length).toBeGreaterThan(0);
    });

    it("should show delivery fee for Option B (includesDelivery: true)", () => {
      const optionB = screen.getByText("Option B").closest("div");
      expect(optionB).toBeInTheDocument();
      
      const deliveryFees = screen.getAllByText("+ Delivery Fee");
      expect(deliveryFees.length).toBeGreaterThan(0);
    });

    it("should show delivery fee for Option C (includesDelivery: true)", () => {
      const optionC = screen.getByText("Option C").closest("div");
      expect(optionC).toBeInTheDocument();
      
      const deliveryFees = screen.getAllByText("+ Delivery Fee");
      expect(deliveryFees.length).toBeGreaterThan(0);
    });

    it("should NOT show delivery fee for Option D (includesDelivery: false)", () => {
      // Get all delivery fee texts (should be 3, not 4)
      const deliveryFees = screen.getAllByText("+ Delivery Fee");
      expect(deliveryFees).toHaveLength(3);
    });

    it("should display correct prices for all options", () => {
      // Option A & C both have $90, so use getAllByText
      const prices90 = screen.getAllByText("$90");
      expect(prices90.length).toBe(2); // Option A and Option C
      
      expect(screen.getByText("$190")).toBeInTheDocument(); // Option B
      expect(screen.getByText("$110")).toBeInTheDocument(); // Option D
    });

    it("should mark Option B as most popular", () => {
      expect(screen.getByText("MOST POPULAR")).toBeInTheDocument();
      
      // Verify it's associated with Option B by finding Option B's card first
      const optionBTitle = screen.getByText("Option B");
      const optionBCard = optionBTitle.closest("div")?.parentElement;
      
      // Verify the card contains both the badge and the subtitle
      expect(within(optionBCard!).getByText("MOST POPULAR")).toBeInTheDocument();
      expect(within(optionBCard!).getByText("Premium Full Service")).toBeInTheDocument();
    });

    it("should display correct subtitles", () => {
      expect(screen.getByText("Delivery + Basic Hosting")).toBeInTheDocument();
      expect(screen.getByText("Premium Full Service")).toBeInTheDocument();
      expect(screen.getByText("Multi-Vendor Service")).toBeInTheDocument();
      expect(screen.getByText("Hosting Only")).toBeInTheDocument();
    });

    it("should display max headcount for all options", () => {
      expect(screen.getByText("50 Max (Rec. <35 if serving)")).toBeInTheDocument(); // Option A
      
      // Option B & C both have "100 Max", so use getAllByText
      const headcount100 = screen.getAllByText("100 Max");
      expect(headcount100.length).toBe(2); // Option B and Option C
      
      expect(screen.getByText("50 Max per Contractor")).toBeInTheDocument(); // Option D
    });
  });

  describe("Hosting Options Features", () => {
    beforeEach(() => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
    });

    it("should display Option A features", () => {
      expect(screen.getByText("1 Contractor Delivery + Hosting")).toBeInTheDocument();
      expect(screen.getByText("Delivery Fee = $45/hr")).toBeInTheDocument();
      expect(screen.getByText("2 hours minimum hosting")).toBeInTheDocument();
    });

    it("should display Option B features", () => {
      expect(screen.getByText("2 Contractors (3rd optional >80 headcount)")).toBeInTheDocument();
      expect(screen.getByText("Pick Up & Professional Set Up")).toBeInTheDocument();
      expect(screen.getByText("Protein Serving & Refills")).toBeInTheDocument();
    });

    it("should display Option C features", () => {
      expect(screen.getByText("2 Contractors + 2 Delivery Fees")).toBeInTheDocument();
      expect(screen.getByText("Multiple Vendor Pick Up & Set Up")).toBeInTheDocument();
      expect(screen.getByText("Protein Serving & Tray Refills")).toBeInTheDocument();
    });

    it("should display Option D features", () => {
      expect(screen.getByText("1-3 Contractors Available")).toBeInTheDocument();
      expect(screen.getByText("Arrive 15-30 min early for prep")).toBeInTheDocument();
      expect(screen.getByText("Professional Food Serving")).toBeInTheDocument();
      expect(screen.getByText("3 hours minimum @$55/hr")).toBeInTheDocument();
    });

    it("should display checkmarks for all features", () => {
      // There should be many checkmarks (4 options × ~5-6 features each)
      const allText = screen.getByText("1-3 Contractors Available").closest("section");
      const checkIcons = allText!.querySelectorAll("svg");
      expect(checkIcons.length).toBeGreaterThan(15);
    });
  });

  describe("Additional Services Section", () => {
    it("should display additional services information", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);

      expect(screen.getByText("Additional Services Available")).toBeInTheDocument();
      expect(screen.getByText(/Bartenders, Brand Ambassadors, and Event Coordinators/)).toBeInTheDocument();
    });
  });

  describe("Terms and Conditions", () => {
    it("should display delivery terms and conditions", () => {
      render(<ModernPricingLandingPage />);
      
      expect(screen.getByText("Headcount vs Food Cost")).toBeInTheDocument();
      expect(screen.getByText("Mileage Rate")).toBeInTheDocument();
      expect(screen.getByText(/Daily Drive Discount/)).toBeInTheDocument();
    });

    it("should display specific mileage rate", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("$3.00 per mile after 10 miles")).toBeInTheDocument();
    });

    it("should display daily drive discounts", () => {
      render(<ModernPricingLandingPage />);
      expect(screen.getByText("2 Drives/Day-$5/drive")).toBeInTheDocument();
      expect(screen.getByText("3 Drives/Day-$10/drive")).toBeInTheDocument();
      expect(screen.getByText("4 Drives/Day-$15/drive")).toBeInTheDocument();
    });
  });

  describe("Contact Footer", () => {
    it("should render contact information", () => {
      render(<ModernPricingLandingPage />);
      
      expect(screen.getByText("Get In Touch")).toBeInTheDocument();
      expect(screen.getByText("info@readysetllc.com")).toBeInTheDocument();
      expect(screen.getByText("(415) 226-6872")).toBeInTheDocument();
      expect(screen.getByText("readysetllc.com")).toBeInTheDocument();
    });

    it("should have correct contact links", () => {
      render(<ModernPricingLandingPage />);
      
      const emailLink = screen.getByText("info@readysetllc.com").closest("a");
      expect(emailLink).toHaveAttribute("href", "mailto:info@readysetllc.com");
      
      const phoneLink = screen.getByText("(415) 226-6872").closest("a");
      expect(phoneLink).toHaveAttribute("href", "tel:+14152266872");
      
      const websiteLink = screen.getByText("readysetllc.com").closest("a");
      expect(websiteLink).toHaveAttribute("href", "https://readysetllc.com");
      expect(websiteLink).toHaveAttribute("target", "_blank");
    });
  });

  describe("Accessibility", () => {
    it("should have proper alt text for images", () => {
      render(<ModernPricingLandingPage />);
      const logo = screen.getByAltText("Ready Set Logo");
      expect(logo).toBeInTheDocument();
    });

    it("should have proper heading hierarchy", () => {
      render(<ModernPricingLandingPage />);
      
      // Main heading
      const mainHeading = screen.getByText("Pricing That Works For You");
      expect(mainHeading.tagName).toBe("H1");
      
      // Secondary headings
      const deliveryHeading = screen.getByText("Delivery Rate Chart");
      expect(deliveryHeading.tagName).toBe("H2");
    });

    it("should have clickable buttons", () => {
      render(<ModernPricingLandingPage />);
      
      // Use getByRole to find buttons by their accessible role
      const deliveryButton = screen.getByRole("button", { name: /Delivery Pricing/i });
      expect(deliveryButton.tagName).toBe("BUTTON");
      
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      expect(hostingButton.tagName).toBe("BUTTON");
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid tab switching", () => {
      render(<ModernPricingLandingPage />);
      
      const deliveryButton = screen.getByRole("button", { name: /Delivery Pricing/i });
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      
      // Rapidly switch tabs
      fireEvent.click(hostingButton);
      fireEvent.click(deliveryButton);
      fireEvent.click(hostingButton);
      fireEvent.click(deliveryButton);
      
      // Should end on delivery tab
      expect(screen.getByText("Delivery Rate Chart")).toBeInTheDocument();
    });

    it("should maintain consistent pricing display format", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      
      // Verify all main prices follow the format $XXX
      // Option A & C both have $90
      const prices90 = screen.getAllByText("$90");
      expect(prices90.length).toBe(2); // Option A and Option C
      
      const price190 = screen.getByText("$190"); // Option B
      const price110 = screen.getByText("$110"); // Option D
      
      // Verify each price element contains only the price format (not feature text)
      // Check that prices are in the correct format by verifying their text content
      [prices90[0], prices90[1], price190, price110].forEach((priceElement) => {
        const priceText = priceElement.textContent?.trim() || '';
        // Verify the price format is exactly $ followed by digits (no extra text)
        expect(priceText).toMatch(/^\$\d+$/);
      });
    });
  });

  describe("Conditional Rendering Logic Verification", () => {
    it("should verify includesDelivery flag controls delivery fee display", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      
      // There should be exactly 3 "+" Delivery Fee" texts
      // (Options A, B, C have it; Option D does not)
      const deliveryFees = screen.getAllByText("+ Delivery Fee");
      expect(deliveryFees).toHaveLength(3);
    });

    it("should verify Option D explicitly does not have delivery fee", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      
      // Find Option D card
      const optionDTitle = screen.getByText("Option D");
      const optionDCard = optionDTitle.closest("div")?.parentElement;
      
      // Verify Option D card exists
      expect(optionDCard).toBeInTheDocument();
      
      // Verify "+ Delivery Fee" is NOT in Option D card
      const deliveryFeeInOptionD = within(optionDCard!).queryByText("+ Delivery Fee");
      expect(deliveryFeeInOptionD).not.toBeInTheDocument();
    });

    it("should verify all other options have delivery fee", () => {
      render(<ModernPricingLandingPage />);
      const hostingButton = screen.getByRole("button", { name: /Hosting Services/i });
      fireEvent.click(hostingButton);
      
      // Check Options A, B, C each have delivery fee
      ["Option A", "Option B", "Option C"].forEach((optionTitle) => {
        const optionElement = screen.getByText(optionTitle);
        const optionCard = optionElement.closest("div")?.parentElement;
        expect(optionCard).toBeInTheDocument();
        
        const deliveryFeeInCard = within(optionCard!).getByText("+ Delivery Fee");
        expect(deliveryFeeInCard).toBeInTheDocument();
      });
    });
  });
});


