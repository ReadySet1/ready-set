// src/components/Dashboard/NavBar.tsx

"use client";

import React, { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import {
  ArchiveIcon,
  Car,
  CircleUser,
  Contact,
  Gauge,
  Home,
  LineChart,
  Menu,
  Package,
  Package2,
  Search,
  Settings,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { SupabaseClient } from "@supabase/supabase-js";

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const closeSheet = () => setIsOpen(false);
  const router = useRouter();
  
  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
        toast.error("Connection error. Please try again later.");
      }
    };

    initSupabase();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) {
      toast.error("Unable to connect to authentication service");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      toast.success("Successfully signed out");
      router.push("/");
      router.refresh(); // Refresh to update auth state across the app
    } catch (err: any) {
      console.error("Sign out error:", err);
      toast.error(err.message || "An unexpected error occurred while signing out");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <header className="bg-background sticky top-0 flex h-16 items-center gap-4 border-b px-4 md:px-6">
        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <Gauge className="h-6 w-6" />
                <span>Ready Set</span>
              </Link>
              <Link
                href="/admin"
                className="hover:text-foreground"
                onClick={closeSheet}
              >
                Home
              </Link>
              <Link
                href="/admin/catering-orders"
                className="text-muted-foreground hover:text-foreground"
                onClick={closeSheet}
              >
                Catering orders
              </Link>
              <Link
                href="/admin/on-demand-orders"
                className="text-muted-foreground hover:text-foreground"
                onClick={closeSheet}
              >
                On-demand orders
              </Link>
              <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
                onClick={closeSheet}
              >
                Users
              </Link>
              <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
                onClick={closeSheet}
              >
                Customers
              </Link>
              {/* <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
                onClick={closeSheet}
              >
                Settings
              </Link> */}
            </nav>
          </SheetContent>
        </Sheet>

        <aside className="bg-background fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r sm:flex">
          <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
            <TooltipProvider>
              <Link
                href="/"
                className="text-primary-foreground group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold md:h-8 md:w-8 md:text-base"
              >
                <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
                <span className="sr-only">Ready Set</span>
              </Link>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin"
                    className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <Home className="h-5 w-5" />
                    <span className="sr-only">Home</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Home</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/catering-orders"
                    className="bg-accent text-accent-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <Truck className="h-5 w-5" />
                    <span className="sr-only">Catering orders</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Catering orders</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/on-demand-orders"
                    className="bg-accent text-accent-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <Zap className="h-5 w-5" />
                    <span className="sr-only">On-demand orders</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">On-demand orders</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/users"
                    className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <Users className="h-5 w-5" />
                    <span className="sr-only">Users</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Users</TooltipContent>
              </Tooltip>
              {/* <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="#"
                    className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <LineChart className="h-5 w-5" />
                    <span className="sr-only">Analytics</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Analytics</TooltipContent>
              </Tooltip> */}
            </TooltipProvider>
          </nav>
          <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="#"
                    className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </nav>
        </aside>

        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <form className="ml-auto flex-1 sm:flex-initial">
            {/* <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search products..."
                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              />
            </div> */}
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/admin/settings">
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </Link>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} disabled={isLoading}>
                {isLoading ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
};

export default NavBar;