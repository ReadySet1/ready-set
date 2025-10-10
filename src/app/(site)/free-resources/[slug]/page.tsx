// src/app/(site)/free-resources/[slug]/page.tsx
import { notFound } from "next/navigation";
import { client, urlFor } from "@/sanity/lib/client";
import BackArrow from "@/components/Common/Back";
import React from "react";
import Logo from "@/components/ui/logo";
import type { Metadata } from "next";
import { DownloadButtonWrapper } from "./DownloadButtonWrapper";
export const revalidate = 30;
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
// Updated query to match the new schema structure
const guideQuery = `*[_type == "guide" && slug.current == $slug][0]{
  _id,
  _type,
  _updatedAt,
  title,
  subtitle,
  slug,
  
  // CONTENIDO PRINCIPAL - Campos exactos de Sanity
  introduction,
  mainContent[] {
    title,
    content
  },
  listSections[] {
    title,
    items[] {
      title,
      content
    }
  },
  
  // CTAs y otros campos
  callToAction,
  calendarUrl,
  downloadCtaText,
  consultationCtaText,
  
  // Archivos descargables
  downloadableFiles[] {
    _key,
    asset-> {
      _id,
      url,
      originalFilename
    }
  },
  
  // Imagen de portada
  coverImage,
  
  // Categoría
  category-> {
    _id,
    title,
    slug
  },
  
  // SEO
  seo{
    metaTitle,
    metaDescription,
    metaImage,
    nofollowAttributes,
    seoKeywords,
    openGraph{
      siteName,
      url,
      description,
      title,
      image
    },
    twitter{
      site,
      creator,
      cardType,
      handle
    }
  }
}`;
interface GuideDocument {
    _id: string;
    title: string;
    subtitle?: string;
    slug: {
        current: string;
    };
    introduction?: PortableTextBlock[];
    coverImage?: any;
    mainContent?: Array<{
        title: string;
        content: PortableTextBlock[];
    }>;
    listSections?: Array<{
        title: string;
        items: Array<{
            title?: string;
            content: string;
        }>;
    }>;
    callToAction?: string;
    calendarUrl?: string;
    downloadCtaText?: string;
    consultationCtaText?: string;
    _updatedAt: string;
    category?: {
        _id: string;
        title: string;
        slug: {
            current: string;
        };
    };
    downloadableFiles?: Array<{
        _key: string;
        asset: {
            _id: string;
            url: string;
            originalFilename: string;
        };
    }>;
    seo?: {
        metaTitle?: string;
        metaDescription?: string;
        openGraph?: {
            title?: string;
            description?: string;
            image?: any;
            siteName?: string;
            url?: string;
        };
    };
}
// Helper function using direct Sanity client
async function getGuide(slug: string): Promise<GuideDocument | null> {
    if (!slug)
        return null;
    try {
        const guide = await client.fetch(guideQuery, { slug });
        // Only log during development, not during build
        if (process.env.NODE_ENV === 'development') {
            if (guide) {
            }
            else {
            }
        }
        return guide;
    }
    catch (error) {
        // Handle specific build-time errors gracefully
        if (error instanceof TypeError && error.message.includes('arrayBuffer')) {
            // This is a known issue during build with Sanity client, return null gracefully
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`⚠️ [Build] Sanity client error during build for ${slug}, this is expected during static generation`);
            }
            return null;
        }
        // Only log errors during development
        if (process.env.NODE_ENV === 'development') {
            console.error(`🔥 [Direct Sanity] Error fetching guide ${slug}:`, error);
        }
        return null;
    }
}
export async function generateMetadata({ params, }: {
    params: Promise<{
        slug: string;
    }>;
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
const renderPortableText = (blocks: PortableTextBlock[] | undefined): string => {
    if (!blocks || !Array.isArray(blocks))
        return "";
    return blocks
        .map((block) => {
        if (!block.children)
            return "";
        return block.children
            .map((child: PortableTextSpan) => child.text || "")
            .join("");
    })
        .join("<br/>");
};
export default async function GuidePage({ params, }: {
    params: Promise<{
        slug: string;
    }>;
}) {
    const { slug } = await params;
    const guide = await getGuide(slug);
    if (!guide)
        notFound();
    // Get the image URL from coverImage
    const imageUrl = guide.coverImage
        ? urlFor(guide.coverImage).url()
        : "https://placehold.co/600x400/FCD34D/333333?text=Guide";
    // Create downloadable files section if files exist
    const hasDownloadableFiles = guide.downloadableFiles && guide.downloadableFiles.length > 0;
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
    return (<div className="min-h-screen">
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
                {guide.introduction && (<div className="text-gray-600">
                    <div dangerouslySetInnerHTML={{
                __html: renderPortableText(guide.introduction),
            }}/>
                  </div>)}

                {/* Main Content Sections */}
                {guide.mainContent && guide.mainContent.length > 0 && (<div className="mt-8 space-y-6">
                    {guide.mainContent.map((section, index) => (<div key={index} className="space-y-3">
                        <h2 className="text-2xl font-bold text-gray-800">
                          {section.title}
                        </h2>
                        {section.content && (<div className="text-gray-600">
                            <div dangerouslySetInnerHTML={{
                        __html: renderPortableText(section.content),
                    }}/>
                          </div>)}
                      </div>))}
                  </div>)}

                {/* List Sections */}
                {guide.listSections && guide.listSections.length > 0 && (<div className="mt-8 space-y-6">
                    {guide.listSections.map((section, index) => (<div key={index} className="space-y-3">
                        <h2 className="text-2xl font-bold text-gray-800">
                          {section.title}
                        </h2>
                        {section.items && section.items.length > 0 && (<ul className="list-disc space-y-2 pl-5 text-gray-600">
                            {section.items.map((item, itemIndex) => (<li key={itemIndex}>
                                {item.title ? (<>
                                    <span className="font-bold">
                                      {item.title}:
                                    </span>{" "}
                                    {item.content}
                                  </>) : (item.content)}
                              </li>))}
                          </ul>)}
                      </div>))}
                  </div>)}

                {/* Call to action */}
                {guide.callToAction && (<div className="mt-8 space-y-4">
                    <p className="font-medium text-gray-700"></p>
                    <p className="text-gray-600">
                      If you found this guide helpful, share it with your
                      network or schedule a consultation call with us. Ready to
                      take the next step? Contact{" "}
                      <a href="/contact" className="font-bold text-blue-500 underline hover:text-blue-700">
                        Ready Set Group
                      </a>{" "}
                      now!
                    </p>
                  </div>)}
              </div>

              {/* Right Column - Image and Card */}
              <div className="space-y-6">
                {/* Resource Card with Image */}
                <div className="overflow-hidden rounded-lg bg-yellow-400">
                  <div className="relative">
                    <img src={imageUrl} alt={guide.title} className="h-auto w-full object-cover"/>
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
                {hasDownloadableFiles && (<DownloadButtonWrapper files={guide.downloadableFiles || []} guideTitle={guide.title}/>)}

                {/* Consultation button with custom text */}
                {guide.calendarUrl && (<div className="mt-4 text-center">
                    <a href={guide.calendarUrl} target="_blank" rel="noopener noreferrer" className="w-full rounded-lg bg-yellow-400 px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-yellow-500">
                      {guide.consultationCtaText || "Schedule a Consultation"}
                    </a>
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="container mx-auto px-4 py-4">
        <BackArrow />
      </div>
    </div>);
}
export async function generateStaticParams() {
    try {
        // During build, use a simpler approach to avoid edge runtime issues
        const guides = await client.fetch(`*[_type == "guide" && defined(slug.current)]{
      "slug": slug.current
    }`);
        // Add null check for guides
        if (!guides || !Array.isArray(guides)) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ No guides found or invalid response from Sanity, using fallback slugs');
            }
            throw new Error('Invalid guides response');
        }
        if (process.env.NODE_ENV !== 'production') {
        }
        return guides.map((guide: {
            slug: string;
        }) => ({
            slug: guide.slug,
        }));
    }
    catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error("❌ Error in generateStaticParams:", error);
        }
        // Fallback to static slugs if Sanity fetch fails
        const staticGuideSlugs = [
            "what-is-email-marketing",
            "your-guide-to-delegation",
            "building-a-reliable-delivery-network",
            "the-complete-guide-to-choosing-the-right-delivery-partner",
            "how-to-hire-the-right-virtual-assistant",
            "how-to-start-social-media-marketing-made-simple",
            "why-email-metrics-matter",
            "addressing-key-issues-in-delivery-logistics",
            "email-testing-made-simple",
            "social-media-strategy-guide-and-template",
        ];
        if (process.env.NODE_ENV !== 'production') {
        }
        return staticGuideSlugs.map((slug) => ({
            slug: slug,
        }));
    }
}
