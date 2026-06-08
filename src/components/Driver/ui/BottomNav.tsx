"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, History, Home, Navigation, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes too (e.g. /driver/history/...). */
  match: (path: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: "/driver", label: "Home", icon: Home, match: (p) => p === "/driver" },
  {
    href: "/driver/tracking",
    label: "Track",
    icon: Navigation,
    match: (p) => p.startsWith("/driver/tracking"),
  },
  {
    href: "/driver/history",
    label: "History",
    icon: History,
    match: (p) => p.startsWith("/driver/history"),
  },
  {
    href: "/driver/training",
    label: "Learn",
    icon: GraduationCap,
    match: (p) => p.startsWith("/driver/training"),
  },
];

/** Global bottom navigation for the driver app. Hidden on the pushed Delivery
 *  Detail view (which has its own back button). */
export function BottomNav() {
  const pathname = usePathname() ?? "/driver";
  // Detail is a pushed view — no bottom nav there.
  if (pathname.startsWith("/driver/deliveries/")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-driver-border bg-driver-glass backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Driver navigation"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-1.5">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-driver-control flex-1 flex-col items-center justify-center gap-1 rounded-xl"
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active ? "bg-driver-brand/15" : "bg-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "h-driver-node w-driver-node",
                    active ? "text-driver-on-brand" : "text-driver-subtle",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-extrabold",
                  active ? "text-driver-on-brand" : "text-driver-subtle",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
