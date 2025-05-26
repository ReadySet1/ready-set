// src/app/(site)/free-resources/[slug]/page.tsx
import { notFound } from "next/navigation";
import { urlFor } from "@/sanity/lib/client";
import BackArrow from "@/components/Common/Back";
import React from "react";
import Logo from "@/components/ui/logo";
import type { Metadata } from "next";
import { DownloadButtonWrapper } from "./DownloadButtonWrapper";
import { fetchGuideData, Guide } from "./fetch-guides";

export const revalidate = 30;

// Define types for Portable Text blocks
interface PortableTextSpan {
  _key?: string;
  _type: string;
  marks?: string[];
  text: string;
}

interface PortableTextBlock {
  _key?: string;
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: any[];
}

// Helper function using our new safe fetch utility
async function getGuide(slug: string): Promise<Guide | null> {
  return await fetchGuideData(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);

  if (!guide) {
    return {
      title: "Guide Not Found",
    };
  }

  const { title, seo } = guide;
  const ogImage = seo?.openGraph?.image
    ? urlFor(seo.openGraph.image).url()
    : guide.coverImage
      ? urlFor(guide.coverImage).url()
      : undefined;

  return {
    title: seo?.metaTitle ?? `${title} | Ready Set LLC`,
    description: seo?.metaDescription ?? title,
    openGraph: {
      title: seo?.openGraph?.title ?? title,
      description: seo?.openGraph?.description ?? seo?.metaDescription ?? title,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: seo?.openGraph?.siteName ?? "Ready Set LLC",
      url: seo?.openGraph?.url,
    },
  };
}

// Helper function to render portable text blocks
const renderPortableText = (
  blocks: PortableTextBlock[] | undefined,
): string => {
  if (!blocks || !Array.isArray(blocks)) return "";

  return blocks
    .map((block) => {
      if (!block.children) return "";
      return block.children
        .map((child: PortableTextSpan) => child.text || "")
        .join("");
    })
    .join("<br/>");
};

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);

  if (!guide) notFound();

  // Get the image URL from coverImage
  const imageUrl = guide.coverImage
    ? urlFor(guide.coverImage).url()
    : "https://placehold.co/600x400/FCD34D/333333?text=Guide";

  // Create downloadable files section if files exist
  const hasDownloadableFiles =
    guide.downloadableFiles && guide.downloadableFiles.length > 0;

  // Function to handle multiple file types with appropriate icons
  const getFileIcon = (filename: string): string => {
    const extension = filename.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📝";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📑";
      case "zip":
        return "🗜️";
      default:
        return "📄";
    }
  };

  return (
    <div className="min-h-screen">
      {/* Main content section */}
      <div className="px-6 pb-12 pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg bg-white p-8 shadow-lg">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Left Column - Content */}
              <div className="space-y-6">
                <h1 className="text-4xl font-bold text-gray-800">
                  {guide.title}
                </h1>
                <h2 className="text-xl text-gray-600">
                  {guide.subtitle || "A Business Owner's Guide"}
                </h2>

                {/* Introduction */}
                {guide.introduction && (
                  <div className="text-gray-600">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderPortableText(guide.introduction),
                      }}
                    />
                  </div>
                )}

                {/* Main Content Sections */}
                {guide.mainContent && guide.mainContent.length > 0 && (
                  <div className="mt-8 space-y-6">
                    {guide.mainContent.map((section, index) => (
                      <div key={index} className="space-y-3">
                        <h2 className="text-2xl font-bold text-gray-800">
                          {section.title}
                        </h2>
                        {section.content && (
                          <div className="text-gray-600">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: renderPortableText(section.content),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* List Sections */}
                {guide.listSections && guide.listSections.length > 0 && (
                  <div className="mt-8 space-y-6">
                    {guide.listSections.map((section, index) => (
                      <div key={index} className="space-y-3">
                        <h2 className="text-2xl font-bold text-gray-800">
                          {section.title}
                        </h2>
                        {section.items && section.items.length > 0 && (
                          <ul className="list-disc space-y-2 pl-5 text-gray-600">
                            {section.items.map((item, itemIndex) => (
                              <li key={itemIndex}>
                                {item.title ? (
                                  <>
                                    <span className="font-bold">
                                      {item.title}:
                                    </span>{" "}
                                    {item.content}
                                  </>
                                ) : (
                                  item.content
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Call to action */}
                {guide.callToAction && (
                  <div className="mt-8 space-y-4">
                    <p className="font-medium text-gray-700">
                      
                    </p>
                    <p className="text-gray-600">
                      If you found this guide helpful, share it with your
                      network or schedule a consultation call with us. Ready to
                      take the next step? Contact{" "}
                      <a
                        href="/contact"
                        className="font-bold text-blue-500 underline hover:text-blue-700"
                      >
                        Ready Set Group
                      </a>{" "}
                      now!
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column - Image and Card */}
              <div className="space-y-6">
                {/* Resource Card with Image */}
                <div className="overflow-hidden rounded-lg bg-yellow-400">
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt={guide.title}
                      className="h-auto w-full object-cover"
                    />
                    <div className="p-6">
                      <h2 className="mb-2 text-center text-2xl font-bold">
                        {guide.title}
                      </h2>
                      <div className="mx-auto my-4 h-px w-32 bg-black"></div>
                      <p className="text-center text-sm">
                        {guide.subtitle || "A Business Owner's Guide"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Logo */}
                <Logo />

                {/* Download Button - Using client component wrapper */}
                {hasDownloadableFiles && (
                  <DownloadButtonWrapper
                    files={guide.downloadableFiles || []}
                    guideTitle={guide.title}
                  />
                )}

                {/* Consultation button with custom text */}
                {guide.calendarUrl && (
                  <div className="mt-4 text-center">
                    <a
                      href={guide.calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full rounded-lg bg-yellow-400 px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-yellow-500"
                    >
                      {guide.consultationCta || "Schedule a Consultation"}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="container mx-auto px-4 py-4">
        <BackArrow />
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  try {
    // During build time, use static list to avoid fetch issues
    const isStaticGeneration = typeof window === 'undefined' && !process.env.VERCEL_URL;
    const isNextBuild = process.env.npm_lifecycle_event === 'build';
    
    if (isStaticGeneration || isNextBuild) {
      // Return static guide slugs to avoid fetch operations during build
      const staticGuideSlugs = [
        'what-is-email-marketing',
        'your-guide-to-delegation', 
        'building-a-reliable-delivery-network',
        'the-complete-guide-to-choosing-the-right-delivery-partner',
        'how-to-hire-the-right-virtual-assistant',
        'how-to-start-social-media-marketing-made-simple',
        'why-email-metrics-matter',
        'addressing-key-issues-in-delivery-logistics',
        'email-testing-made-simple',
        'social-media-strategy-guide-and-template'
      ];
      
      return staticGuideSlugs.map((slug) => ({
        slug: slug,
      }));
    }
    
    // Runtime: Try to fetch from Sanity
    const { getGuides } = await import("@/sanity/lib/queries");
    const guides = await getGuides();
    
    // Make sure we return objects with slug as string
    return guides.map((guide) => ({
      slug: guide.slug.current,
    }));
  } catch (error) {
    console.error("Error generating static params:", error);
    // Fallback to static guide slugs if Sanity fetch fails
    const staticGuideSlugs = [
      'what-is-email-marketing',
      'your-guide-to-delegation', 
      'building-a-reliable-delivery-network',
      'the-complete-guide-to-choosing-the-right-delivery-partner',
      'how-to-hire-the-right-virtual-assistant',
      'how-to-start-social-media-marketing-made-simple',
      'why-email-metrics-matter',
      'addressing-key-issues-in-delivery-logistics',
      'email-testing-made-simple',
      'social-media-strategy-guide-and-template'
    ];
    
    return staticGuideSlugs.map((slug) => ({
      slug: slug,
    }));
  }
}
