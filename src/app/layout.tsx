// src/app/layout.tsx
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import ClientLayout from "@/components/Clients/ClientLayout";
import "../styles/index.css";
import "../styles/prism-vsc-dark-plus.css";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import CookieConsentBanner from "../components/Cookies/Banner";
import { UserProvider } from "@/contexts/UserContext";
import { Toaster } from "@/components/ui/toaster";
import { HighlightInit } from "@highlight-run/next/client";
import { H } from "highlight.run";
import { CONSTANTS } from "@/constants";
import { HighlightErrorBoundary } from "@/components/ErrorBoundary/HighlightErrorBoundary";
import UmamiAnalytics from "@/components/Analytics/UmamiAnalytics";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://readysetllc.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ready Set LLC - Always Ready",
    template: "%s | Ready Set LLC",
  },
  description:
    "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPPA Certified. Our team can meet all your Bay Area delivery needs.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Ready Set LLC",
    title: "Ready Set LLC - Always Ready",
    description:
      "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPPA Certified. Our team can meet all your Bay Area delivery needs.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Ready Set LLC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ready Set LLC - Always Ready",
    description:
      "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPPA Certified.",
    images: ["/images/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// Expose Highlight globally for easier debugging
if (typeof window !== "undefined") {
  window.H = H;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      suppressHydrationWarning={true}
      className={`!scroll-smooth ${montserrat.variable} ${montserrat.className}`}
      lang="en"
    >
      <head>
        {/* Directly include Highlight.js script for more reliable loading */}
        <Script id="highlight-init" strategy="beforeInteractive">
          {`
            window.HIGHLIGHT_DEBUG = true;
            window.HIGHLIGHT_PROJECT_ID = "${CONSTANTS.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}";
          `}
        </Script>
      </head>
      <body className="overflow-x-hidden">
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
          <UserProvider>
            <HighlightInit
              projectId={CONSTANTS.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}
              serviceName="ready-set-frontend"
              debug={process.env.NODE_ENV === "development"}
              networkRecording={{
                enabled: true,
                recordHeadersAndBody: true,
                urlBlocklist: [
                  // Add sensitive URLs here that shouldn't be recorded
                  "/api/auth",
                  "/api/login",
                  "/api/user",
                  "/api/users",
                  "sanity.io", // Don't record Sanity API requests
                ],
              }}
              tracingOrigins={[
                "localhost",
                "readysetllc.com",
                "ready-set.vercel.app",
                "vercel.app", // Match all Vercel preview deployments
              ]}
            />
            <HighlightErrorBoundary>
              <ClientLayout>{children}</ClientLayout>
            </HighlightErrorBoundary>
          </UserProvider>
        </ErrorBoundary>
        <Toaster />
        {/* {process.env.NODE_ENV === "development" && <VercelToolbar />} */}
        <Analytics />
        <UmamiAnalytics />
        <CookieConsentBanner
          metricoolHash="5e4d77df771777117a249111f4fc9683"
          gaMeasurementId="G-PHGL28W4NP"
        />
      </body>
    </html>
  );
}
