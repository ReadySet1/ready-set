"use client";

import React, { useState, useMemo, useEffect, useRef, ErrorInfo } from "react";
import Image from "next/image";
import { Clock, Truck, Shield } from "lucide-react";
import { getCloudinaryUrl } from "@/lib/cloudinary";

// Carousel imports
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ServiceErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ComponentType<{ error?: Error }> }>,
  ErrorBoundaryState
> {
  constructor(
    props: React.PropsWithChildren<{
      fallback: React.ComponentType<{ error?: Error }>;
    }>,
  ) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ServiceFeaturesSection Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Fallback component for error boundary
const ServiceFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-900">
    <div className="p-8 text-center text-white">
      <h2 className="mb-4 text-2xl font-bold">Something went wrong</h2>
      <p className="text-gray-300">
        {error?.message ||
          "An unexpected error occurred. Please try again later."}
      </p>
    </div>
  </div>
);

// Partner interface
interface Partner {
  name: string;
  logo: string;
}

// Service feature interface
interface ServiceFeature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

// Background image settings interface
interface BackgroundImageSettings {
  src: string;
  size: "cover" | "contain" | "auto" | string;
  position: string;
  repeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
  attachment?: "fixed" | "scroll" | "local";
}

// Viewport dimensions interface
interface ViewportDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

// Component props interface
interface ServiceFeaturesSectionProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  partners?: Partner[];
  features?: ServiceFeature[];
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  customSecondaryButton?: React.ReactNode;
  variant?: "logistics" | "bakery" | "flowers" | "default";
  className?: string;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Custom hook for responsive background
const useResponsiveBackground = (imageSrc: string): BackgroundImageSettings => {
  const [settings, setSettings] = useState<BackgroundImageSettings>({
    src: imageSrc,
    size: "cover",
    position: "center center",
    repeat: "no-repeat",
    attachment: "scroll", // Default to scroll for better mobile performance
  });

  useEffect(() => {
    const calculateBackgroundSettings = (): void => {
      const viewport: ViewportDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
        aspectRatio: window.innerWidth / window.innerHeight,
      };

      let newSettings: BackgroundImageSettings;

      // Fix: Use scroll attachment for mobile devices to prevent iOS issues
      const isMobile = viewport.width < 768;
      const isTablet = viewport.width >= 768 && viewport.width < 1024;

      // Optimize for 1920x1080 and similar widescreen resolutions
      if (viewport.width >= 1920 && viewport.aspectRatio >= 1.7) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 20%",
          repeat: "no-repeat",
          attachment: "fixed", // Fixed is safe for large desktop screens
        };
      } else if (viewport.width >= 1366 && viewport.aspectRatio > 1.5) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 18%",
          repeat: "no-repeat",
          attachment: "fixed",
        };
      } else if (isTablet) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 15%",
          repeat: "no-repeat",
          attachment: "scroll", // Use scroll for tablets for better performance
        };
      } else {
        // Mobile and portrait orientations - always use scroll
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 12%",
          repeat: "no-repeat",
          attachment: "scroll", // Fixed attachment causes issues on mobile
        };
      }

      setSettings(newSettings);
    };

    calculateBackgroundSettings();

    const debouncedResize = debounce(calculateBackgroundSettings, 150);
    window.addEventListener("resize", debouncedResize);

    return () => window.removeEventListener("resize", debouncedResize);
  }, [imageSrc]);

  return settings;
};

const ServiceFeaturesSection: React.FC<ServiceFeaturesSectionProps> = ({
  title = "Premium Services",
  subtitle = "Your trusted partner since 2019",
  backgroundImage = getCloudinaryUrl("logistics/bg-hero"),
  partners = [],
  features = [],
  primaryButtonText = "Get Quote",
  secondaryButtonText = "Schedule Call",
  onPrimaryClick,
  onSecondaryClick,
  customSecondaryButton,
  variant = "default",
  className = "",
}) => {
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Responsive background hook
  const backgroundSettings = useResponsiveBackground(backgroundImage);

  // Default partners list
  const defaultPartners: Partner[] = useMemo(
    () => [
      { name: "Deli", logo: getCloudinaryUrl("food/partners/Deli") },
      { name: "Bobcha", logo: getCloudinaryUrl("food/partners/bobcha") },
      { name: "Foodee", logo: getCloudinaryUrl("food/partners/foodee") },
      { name: "Destino", logo: getCloudinaryUrl("food/partners/destino") },
      { name: "Conviva", logo: getCloudinaryUrl("food/partners/conviva") },
      { name: "Kasa Indian Eatery", logo: getCloudinaryUrl("food/partners/kasa") },
      { name: "CaterValley", logo: getCloudinaryUrl("food/partners/catervalley") },
    ],
    [],
  );

  // Default features list
  const defaultFeatures: ServiceFeature[] = useMemo(
    () => [
      {
        icon: Truck,
        title: "Specialized Delivery",
        description:
          "Expert handling of your needs with temperature-controlled vehicles and trained professionals.",
      },
      {
        icon: Clock,
        title: "Time-Critical Delivery",
        description:
          "Guaranteed on-time delivery for your events with real-time tracking and dedicated route optimization.",
      },
      {
        icon: Shield,
        title: "Quality Guaranteed",
        description:
          "Trusted by leading tech companies including Apple, Google, Facebook, and Netflix for reliable service.",
      },
    ],
    [],
  );

  // Use provided or default data
  const displayPartners = partners.length > 0 ? partners : defaultPartners;
  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  // Mobile state
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Autoplay plugin reference
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );

  // Client-side check
  const isClient = typeof window !== "undefined";

  // Mobile detection with debouncing
  useEffect(() => {
    const checkIfMobile = (): void => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    checkIfMobile();
    const debouncedCheck = debounce(checkIfMobile, 150);
    window.addEventListener("resize", debouncedCheck);
    return () => window.removeEventListener("resize", debouncedCheck);
  }, []);

  // Loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Background style object
  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `url('${backgroundSettings.src}')`,
    backgroundSize: backgroundSettings.size,
    backgroundPosition: backgroundSettings.position,
    backgroundRepeat: backgroundSettings.repeat,
    backgroundAttachment: backgroundSettings.attachment,
  };

  // Handle image load
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Loading component
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div
          className="h-32 w-32 animate-spin rounded-full border-b-2 border-yellow-400"
          data-testid="loading-spinner"
        ></div>
      </div>
    );
  }

  return (
    <ServiceErrorBoundary fallback={ServiceFallback}>
      <div className={`min-h-screen bg-gray-900 ${className}`}>
        {/* Hero Section */}
        <div className="relative min-h-screen">
          {/* Background Image with Responsive Settings */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={backgroundStyle}
              data-testid="background-container"
            >
              {/* Preload the background image */}
              <Image
                src={backgroundSettings.src}
                alt="Background"
                fill
                className="opacity-0"
                priority
                onLoad={handleImageLoad}
              />
            </div>
            <div className="absolute inset-0 bg-black/10" />
            {/* Loading overlay */}
            {!imageLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-gray-800"
                data-testid="image-loading-overlay"
              >
                <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-yellow-400"></div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="relative z-10 flex min-h-screen flex-col">
            {/* Centered Card */}
            <div className="relative z-30 flex flex-1 items-center justify-center px-4 pb-8 pt-48 md:pt-60">
              <div className="w-full max-w-2xl rounded-2xl bg-white/95 p-4 text-center shadow-lg backdrop-blur-sm md:p-10">
                <h1 className="mb-3 text-2xl font-bold text-gray-900 md:text-4xl">
                  {title}
                </h1>
                <p className="mb-6 text-sm text-gray-600 md:mb-8 md:text-lg">
                  {subtitle}
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row md:gap-4">
                  {onPrimaryClick && (
                    <button
                      onClick={onPrimaryClick}
                      className="rounded-lg bg-yellow-400 px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
                      aria-label={primaryButtonText}
                    >
                      {primaryButtonText}
                    </button>
                  )}
                  {customSecondaryButton ||
                    (onSecondaryClick && (
                      <button
                        onClick={onSecondaryClick}
                        className="rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                        aria-label={secondaryButtonText}
                      >
                        {secondaryButtonText}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Partners Carousel */}
            {displayPartners.length > 0 && (
              <div className="z-40 px-4 pb-16 pt-2 md:pb-24 md:pt-4">
                <div className="mx-auto max-w-[90%] md:max-w-[80%]">
                  <Carousel
                    opts={{
                      align: "center",
                      loop: true,
                      dragFree: false,
                      containScroll: false,
                      slidesToScroll: 3,
                    }}
                    plugins={isClient ? [autoplayPlugin.current] : []}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-0 -mr-0">
                      {displayPartners.map((partner) => (
                        <CarouselItem
                          key={partner.name}
                          className="basis-1/3 pl-0 pr-0"
                        >
                          <div className="mx-1 md:mx-2">
                            <div className="relative h-20 w-full overflow-hidden rounded-2xl border-4 border-yellow-400 bg-white shadow-lg md:h-24">
                              <Image
                                src={partner.logo}
                                alt={partner.name}
                                fill
                                className="object-contain p-2"
                                loading="lazy"
                              />
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service Cards Section */}
        {displayFeatures.length > 0 && (
          <div className="bg-gray-900 px-4 py-8 md:py-16">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                {displayFeatures.map((feature, index) => {
                  const IconComponent = feature.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-xl bg-white p-5 shadow-lg transition-transform hover:scale-105"
                    >
                      <div className="mb-2">
                        <IconComponent className="h-5 w-5 text-yellow-400" />
                      </div>
                      <h3 className="mb-2 text-base font-semibold">
                        {feature.title}
                      </h3>
                      <p className="mb-4 text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </ServiceErrorBoundary>
  );
};

export default ServiceFeaturesSection;
