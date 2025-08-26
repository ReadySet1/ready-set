// src/components/Clients/ClientLayout.tsx

"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header/index";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ToasterContext from "@/app/api/contex/ToastContext";
import toast from "react-hot-toast";
import { useUser } from "@/contexts/UserContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState<boolean>(true);
  const pathname = usePathname();
  const { user, userRole, isLoading } = useUser();

  const isBackendAdminRoute = pathname?.startsWith("/admin");
  const isStudioRoute = pathname?.startsWith("/studio");
  const isHomePage = pathname === "/";
  const isProfilePage = pathname === "/profile";

  // Create a unique key for Header component that changes when auth state changes
  const headerKey = `header-${user?.id || "anonymous"}-${userRole || "no-role"}-${isLoading ? "loading" : "loaded"}`;

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  // Debug header rendering
  useEffect(() => {
    console.log("🎯 ClientLayout: Header should be rendered?", {
      shouldRenderHeader:
        !isBackendAdminRoute && !isStudioRoute && !isHomePage && !isProfilePage,
      pathname,
      headerKey,
      hasUser: !!user,
      userRole,
      isLoading,
    });
  }, [
    pathname,
    headerKey,
    user,
    userRole,
    isLoading,
    isBackendAdminRoute,
    isStudioRoute,
    isHomePage,
    isProfilePage,
  ]);

  return (
    <ThemeProvider attribute="class" enableSystem={true} defaultTheme="light">
      <ToasterContext />
      {!isBackendAdminRoute &&
        !isStudioRoute &&
        !isHomePage &&
        !isProfilePage && <Header key={headerKey} />}
      <main className="flex-grow">{children}</main>
      {!isBackendAdminRoute && !isStudioRoute && <Footer />}
      <ScrollToTop />
    </ThemeProvider>
  );
}
