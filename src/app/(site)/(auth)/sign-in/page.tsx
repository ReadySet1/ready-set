import Signin from "@/components/Auth/SignIn";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthErrorRecovery from "@/components/Auth/SignIn/AuthErrorRecovery";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { getDashboardRouteByRole } from "@/utils/routing";
import type { UserType } from "@/types/user";

export const metadata: Metadata = {
  title:
    "Sign In | Ready Set",
};

interface SearchParams {
  error?: string;
  message?: string;
  returnTo?: string;
  cookieError?: string;
}

const SigninPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams | null>
}) => {
  const params = await searchParams;

  // Show error recovery if cookie error is detected
  const showErrorRecovery = params?.cookieError === 'true';

  // Already-authenticated visitors don't belong on the sign-in page — bounce
  // them to their dashboard (or a same-origin returnTo). This also self-heals
  // the native driver shell: when the WebView lands here despite a live
  // session (the "looks logged-out" divergence), it now returns to /driver
  // instead of stranding the driver on the marketing chrome.
  if (!showErrorRecovery) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true, deletedAt: true },
      });
      if (profile && !profile.deletedAt) {
        const returnTo = params?.returnTo;
        // Same-origin paths only — never redirect off-site.
        const safeReturnTo =
          returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
            ? returnTo
            : null;
        redirect(safeReturnTo ?? getDashboardRouteByRole(profile.type as UserType));
      }
    }
  }

  // Extract only the props that Signin component expects
  const signinParams = params ? {
    error: params.error,
    message: params.message,
    returnTo: params.returnTo
  } as any : undefined;

  return (
    <>
      <Breadcrumb pageName="Sign In Page" />

      {showErrorRecovery ? (
        <div className="container mx-auto py-8">
          <AuthErrorRecovery />
        </div>
      ) : (
        <Signin searchParams={signinParams} />
      )}
    </>
  );
};

export default SigninPage;
