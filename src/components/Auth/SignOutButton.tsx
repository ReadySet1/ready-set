// src/components/Auth/SignOutButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonProps } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useUser } from "@/contexts/UserContext";

interface SignOutButtonProps extends ButtonProps {
  redirectTo?: string;
}

export default function SignOutButton({
  redirectTo = "/sign-in",
  children = "Sign Out",
  ...props
}: SignOutButtonProps) {
  const { signOut } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      // Optionally handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSignOut} disabled={isLoading} {...props}>
      {isLoading ? "Signing out..." : children}
    </Button>
  );
}
