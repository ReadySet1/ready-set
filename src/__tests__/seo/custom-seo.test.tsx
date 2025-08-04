/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import CustomNextSeo from "../../components/Blog/CustomSeo";
import type { SeoType } from "@/sanity/schemaTypes/seo";

// Mock Next.js Head component
jest.mock("next/head", () => {
  return function MockHead({ children }: { children: React.ReactNode }) {
    return <div data-testid="mock-head">{children}</div>;
  };
});

describe("CustomNextSeo Component", () => {
  const baseProps = {
    slug: "/test-blog-post",
  };

  beforeEach(() => {
    // Mock environment variable
    process.env.NEXT_PUBLIC_SITE_URL = "https://readysetllc.com";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render with null SEO data", () => {
    const { container } = render(
      <CustomNextSeo seo={null} slug={baseProps.slug} />,
    );

    expect(container).toBeInTheDocument();
  });

  it("should set correct robots meta tag when nofollowAttributes is false", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
      nofollowAttributes: false,
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    // Check that robots meta tag is set to follow,index
    const robotsMeta = container.querySelector('meta[name="robots"]');
    expect(robotsMeta).toHaveAttribute("content", "follow,index");
  });

  it("should set correct robots meta tag when nofollowAttributes is true", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
      nofollowAttributes: true,
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    // Check that robots meta tag is set to nofollow,noindex
    const robotsMeta = container.querySelector('meta[name="robots"]');
    expect(robotsMeta).toHaveAttribute("content", "nofollow,noindex");
  });

  it("should set correct robots meta tag when nofollowAttributes is undefined", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    // Check that robots meta tag defaults to follow,index
    const robotsMeta = container.querySelector('meta[name="robots"]');
    expect(robotsMeta).toHaveAttribute("content", "follow,index");
  });

  it("should render meta title correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Blog Post Title",
      metaDescription: "Test Description",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    const title = container.querySelector("title");
    expect(title).toHaveTextContent("Test Blog Post Title");
  });

  it("should render meta description correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "This is a test description for SEO",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    const description = container.querySelector('meta[name="description"]');
    expect(description).toHaveAttribute(
      "content",
      "This is a test description for SEO",
    );
  });

  it("should render canonical URL correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug="/blog/test-post" />,
    );

    const canonical = container.querySelector('link[rel="canonical"]');
    expect(canonical).toHaveAttribute(
      "href",
      "https://readysetllc.com/blog/test-post",
    );
  });

  it("should handle slug without leading slash", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug="blog/test-post" />,
    );

    const canonical = container.querySelector('link[rel="canonical"]');
    expect(canonical).toHaveAttribute(
      "href",
      "https://readysetllc.com/blog/test-post",
    );
  });

  it("should render OpenGraph meta tags correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
      openGraph: {
        _type: "openGraph",
        title: "OG Test Title",
        description: "OG Test Description",
        siteName: "Ready Set LLC",
        url: "https://readysetllc.com/test",
        image: {
          _type: "customImage",
          asset: {
            _id: "test-image",
            _type: "sanity.imageAsset",
            url: "https://example.com/image.jpg",
          },
        },
      },
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    expect(
      container.querySelector('meta[property="og:title"]'),
    ).toHaveAttribute("content", "OG Test Title");
    expect(
      container.querySelector('meta[property="og:description"]'),
    ).toHaveAttribute("content", "OG Test Description");
    expect(
      container.querySelector('meta[property="og:site_name"]'),
    ).toHaveAttribute("content", "Ready Set LLC");
    expect(container.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://readysetllc.com/test",
    );
    expect(
      container.querySelector('meta[property="og:image"]'),
    ).toHaveAttribute("content", "https://example.com/image.jpg");
  });

  it("should render Twitter meta tags correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
      twitter: {
        _type: "twitter",
        cardType: "summary_large_image",
        creator: "@readysetllc",
        site: "@readysetllc",
      },
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    expect(
      container.querySelector('meta[name="twitter:card"]'),
    ).toHaveAttribute("content", "summary_large_image");
    expect(
      container.querySelector('meta[name="twitter:creator"]'),
    ).toHaveAttribute("content", "@readysetllc");
    expect(
      container.querySelector('meta[name="twitter:site"]'),
    ).toHaveAttribute("content", "@readysetllc");
  });

  it("should render keywords meta tag correctly", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
      seoKeywords: ["catering", "delivery", "bay area", "food service"],
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    const keywords = container.querySelector('meta[name="keywords"]');
    expect(keywords).toHaveAttribute(
      "content",
      "catering, delivery, bay area, food service",
    );
  });

  it("should not render optional meta tags when data is missing", () => {
    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(
      <CustomNextSeo seo={seoData} slug={baseProps.slug} />,
    );

    // These should not be present
    expect(container.querySelector('meta[property="og:title"]')).toBeNull();
    expect(container.querySelector('meta[name="twitter:card"]')).toBeNull();
    expect(container.querySelector('meta[name="keywords"]')).toBeNull();
  });

  it("should handle missing base URL environment variable", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(<CustomNextSeo seo={seoData} slug="/test" />);

    const canonical = container.querySelector('link[rel="canonical"]');
    expect(canonical).toHaveAttribute("href", "/test");
  });

  it("should handle base URL with trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://readysetllc.com/";

    const seoData: SeoType = {
      metaTitle: "Test Title",
      metaDescription: "Test Description",
    };

    const { container } = render(<CustomNextSeo seo={seoData} slug="/test" />);

    const canonical = container.querySelector('link[rel="canonical"]');
    expect(canonical).toHaveAttribute("href", "https://readysetllc.com/test");
  });
});
