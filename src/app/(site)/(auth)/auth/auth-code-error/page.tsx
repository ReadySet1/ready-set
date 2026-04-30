import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthCodeErrorPage() {
  return (
    <section className="bg-auth-tint pb-14 pt-page-y dark:bg-dark sm:pt-page-y-lg md:pt-page-y-xl lg:pb-20 lg:pt-page-y-2xl">
      <div className="container">
        <div className="flex justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Authentication Error</CardTitle>
              <CardDescription>
                There was a problem with the authentication link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                The link you used may be expired or invalid. Please try requesting a
                new link.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/forgot-password">Reset Password</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-in">Back to Sign In</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}