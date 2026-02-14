// src/app/layout.tsx
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import ClientLayout from "@/components/Clients/ClientLayout";
import "../styles/index.css";
import "../styles/prism-vsc-dark-plus.css";
import GlobalErrorBoundary from "@/components/ErrorBoundary/GlobalErrorBoundary";
import CookieConsentBanner from "../components/Cookies/Banner";
import { UserProvider } from "@/contexts/UserContext";
import { ApplicationSessionProvider } from "@/contexts/ApplicationSessionContext";
import { SessionTimeoutWarning } from "@/components/Auth/SessionTimeoutWarning";
import { ActivityTracker } from "@/components/Auth/ActivityTracker";
import { Toaster } from "@/components/ui/toaster";
import { CONSTANTS } from "@/constants";
import UmamiAnalytics from "@/components/Analytics/UmamiAnalytics";
import QueryProvider from "@/providers/QueryProvider";
import type { Metadata } from "next";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://readysetllc.com";
const ogImageUrl = getCloudinaryUrl("og-image");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ready Set LLC - Always Ready",
    template: "%s | Ready Set LLC",
  },
  description:
    "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPAA Certified. Our team can meet all your Bay Area delivery needs.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Ready Set LLC",
    title: "Ready Set LLC - Always Ready",
    description:
      "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPAA Certified. Our team can meet all your Bay Area delivery needs.",
    images: [
      {
        url: ogImageUrl,
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
      "On-demand courier that specializes in delivery for all your needs. We are Food Safety, and HIPAA Certified.",
    images: [ogImageUrl],
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
      <head></head>
      <body className="overflow-x-hidden">
        <GlobalErrorBoundary>
          <QueryProvider>
            <UserProvider>
              <ApplicationSessionProvider>
                <ActivityTracker />
                <ClientLayout>{children}</ClientLayout>
                <SessionTimeoutWarning warningTime={2} />
              </ApplicationSessionProvider>
            </UserProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
        <Toaster />
        {/* {process.env.NODE_ENV === "development" && <VercelToolbar />} */}
        <Analytics />
        <UmamiAnalytics />

        {/* Perception Company Analytics Script */}
        <Script
          id="perception-company-analytics"
          strategy="afterInteractive"
          src="https://www.perception-company.com/js/803213.js"
        />
        <noscript>
          <img
            src="https://www.perception-company.com/803213.png"
            alt="Perception Company Analytics"
            style={{ display: "none" }}
          />
        </noscript>

        <CookieConsentBanner
          metricoolHash="5e4d77df771777117a249111f4fc9683"
          gaMeasurementId="G-PHGL28W4NP"
        />
      </body>
    </html>
  );
}
