"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

/**
 * Below the `md` breakpoint the admin sidebar is an off-canvas sheet, and
 * this bar holds the only control that opens it. It also closes the sheet
 * after navigation, since sidebar links do not close it themselves.
 */
export function AdminMobileTopBar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
      <SidebarTrigger className="h-9 w-9" aria-label="Open menu" />
      <span className="text-base font-semibold text-slate-900">Ready Set Admin</span>
    </header>
  );
}
