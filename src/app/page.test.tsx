// __tests__/page.test.tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Home, { metadata } from "@/app/page";
import { Metadata } from "next";

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: (component: string) => component,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Home Page", () => {
  describe("Metadata", () => {
    const typedMetadata = metadata as Metadata;

    it("has correct basic metadata", () => {
      expect(typedMetadata.title).toBe(
        "Ready Set | Catering Delivery & Virtual Assistant Services",
      );
      expect(
        typeof typedMetadata.description === "string" &&
          typedMetadata.description,
      ).toContain(
        "Since 2019, Ready Set has been the trusted delivery partner",
      );
    });

    it("has correct OpenGraph metadata", () => {
      const og = typedMetadata.openGraph;
      expect(og?.title).toBe(
        "Ready Set Group LLC | Bay Area's Premier Business Solutions Provider",
      );
      expect(og?.siteName).toBe("Ready Set Group LLC");
      // Access other OpenGraph properties that are defined in the Metadata type
    });

    it("has correct Twitter metadata", () => {
      const twitter = typedMetadata.twitter;
      expect(twitter?.title).toBe(
        "Ready Set Group LLC | Catering Delivery & Virtual Assistant Services",
      );
      // Access other Twitter properties that are defined in the Metadata type
    });

    it("has correct robot settings", () => {
      if (typeof typedMetadata.robots === "object") {
        const robots = typedMetadata.robots;
        expect(robots).toMatchObject({
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        });
      }
    });

    it("has correct keywords", () => {
      const expectedKeywords = [
        "catering delivery",
        "virtual assistant services",
        "Bay Area logistics",
      ];

      const keywords = typedMetadata.keywords;
      if (Array.isArray(keywords)) {
        expectedKeywords.forEach((keyword) => {
          expect(keywords).toContain(keyword);
        });
      }
    });
  });
});
