import Breadcrumb from "@/components/Common/Breadcrumb";
import VirtualAssistantServices from "@/components/VirtualAssistant";
import { Metadata } from "next";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Virtual Assistant Services for Businesses",
  description:
    "Trained virtual assistants for delivery and back-office operations. Scale your business affordably. Request a quote today.", // DRAFT — review copy
  keywords: [
    "virtual assistant services",
    "business VA",
    "back-office support",
    "remote assistant",
  ],
  openGraph: {
    title: "Virtual Assistant Services for Businesses | Ready Set",
    description:
      "Trained virtual assistants for delivery and back-office operations. Scale your business affordably. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
    images: [
      {
        url: getCloudinaryUrl("og-image"),
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Assistant Services for Businesses | Ready Set",
    description:
      "Trained virtual assistants for delivery and back-office operations. Scale your business affordably. Request a quote today.",
    images: [getCloudinaryUrl("og-image")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/virtual-assistant",
  },
};

const AboutPage = () => {
  return (
    <main>
      <Breadcrumb pageName="Virtual Assistant Services" pagePath="/virtual-assistant" />
      <VirtualAssistantServices />
    </main>
  );
};

export default AboutPage;
