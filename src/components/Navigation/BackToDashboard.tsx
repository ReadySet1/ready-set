"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { getDashboardRouteByRole } from "@/utils/navigation";

interface BackToDashboardProps {
  className?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "lg";
}

export const BackToDashboard: React.FC<BackToDashboardProps> = ({
  className = "hover:bg-accent flex items-center gap-2",
  variant = "ghost",
  size = "sm",
}) => {
  const router = useRouter();
  const { userRole, isLoading } = useUser();

  const handleBackClick = () => {
    if (!userRole) {
      // Fallback to home if no role detected
      router.push("/");
      return;
    }

    const dashboardRoute = getDashboardRouteByRole(userRole);
    router.push(dashboardRoute.path);
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <ArrowLeftIcon className="h-4 w-4" />
        Loading...
      </Button>
    );
  }

  const dashboardName = userRole
    ? getDashboardRouteByRole(userRole).name
    : "Dashboard";

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleBackClick}
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Back to {dashboardName}
    </Button>
  );
};
