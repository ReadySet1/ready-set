"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronRight,
  Headphones,
  Clock,
  Target,
  Brain,
  BarChart,
  Globe,
  Zap,
  CheckCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

export function VAModal() {
  const router = useRouter();

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation

    // Close the modal first
    const escKeyEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escKeyEvent);

    // Wait for modal to close, then navigate if needed
    setTimeout(() => {
      // Check if we're already on the apply page
      if (window.location.pathname === "/apply") {
        // Already on apply page, just scroll to form
        const formElement = document.getElementById("apply-now");
        if (formElement) {
          formElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        // Navigate to apply page with role parameter, then scroll
        router.push("/apply?role=Virtual Assistant");
        // Wait for navigation and DOM to be ready
        setTimeout(() => {
          const formElement = document.getElementById("apply-now");
          if (formElement) {
            formElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 500);
      }
    }, 150);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-amber-300 font-semibold text-slate-900 shadow-lg transition-all duration-300 hover:from-amber-400 hover:to-amber-400 hover:shadow-xl">
          Learn More <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[1001] mx-auto my-2 max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="relative rounded-t-2xl bg-gradient-to-r from-amber-300 to-amber-300 p-6 text-slate-900 sm:p-8">
          <DialogClose className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/10 p-2 text-slate-900 transition-colors hover:bg-slate-900/20">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/10 backdrop-blur-sm">
              <Headphones className="h-6 w-6 text-slate-900" />
            </div>
            <Badge className="bg-slate-900/10 text-slate-900 backdrop-blur-sm hover:bg-slate-900/20">
              Remote Position
            </Badge>
          </div>
          <DialogTitle className="mb-3 text-left text-2xl font-bold text-slate-900 sm:text-3xl">
            Virtual Assistant
          </DialogTitle>
          <DialogDescription className="text-left text-base text-slate-800 sm:text-lg">
            Help businesses thrive while growing your career in a fully remote
            environment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6 sm:space-y-8 sm:p-8">
          {/* Hero Section */}
          <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-50">
            <CardContent className="p-6">
              <h3 className="mb-3 text-xl font-bold text-slate-800">
                Be Part of Something Great
              </h3>
              <p className="mb-4 leading-relaxed text-slate-600">
                Join our team of skilled virtual assistants helping businesses
                across the US achieve sustainable growth and success. With over
                50,000 project hours delivered, we're looking for dedicated
                professionals to help expand our impact.
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Globe className="h-4 w-4" />
                <span className="font-medium">
                  100% Remote • Flexible Hours
                </span>
              </div>
            </CardContent>
          </Card>

          {/* What We're Looking For */}
          <div>
            <h3 className="mb-4 text-xl font-bold text-slate-800">
              What We're Looking For
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Clock,
                  title: "Time Management",
                  description:
                    "Excellent organizational skills and ability to handle multiple tasks efficiently",
                  color: "amber",
                },
                {
                  icon: Target,
                  title: "Problem Solving",
                  description:
                    "Creative problem-solver who can develop efficient workflows",
                  color: "orange",
                },
                {
                  icon: Brain,
                  title: "Initiative",
                  description:
                    "Self-motivated with strong initiative and attention to detail",
                  color: "yellow",
                },
                {
                  icon: BarChart,
                  title: "Business Acumen",
                  description:
                    "Understanding of business operations and growth strategies",
                  color: "red",
                },
              ].map((item, index) => (
                <Card
                  key={index}
                  className="group border-0 shadow-md transition-all duration-300 hover:shadow-lg"
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center">
                      <div
                        className={`mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 transition-transform duration-300 group-hover:scale-110`}
                      >
                        <item.icon className={`h-5 w-5 text-amber-300`} />
                      </div>
                      <h4 className="font-semibold text-slate-800">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* What You'll Do */}
          <div>
            <h3 className="mb-4 text-xl font-bold text-slate-800">
              What You'll Do
            </h3>
            <div className="space-y-3">
              {[
                "Help businesses streamline their operations and create efficient workflows",
                "Manage daily tasks and priorities for business owners",
                "Implement systems and processes for sustainable growth",
                "Contribute to the success of businesses across various industries",
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                >
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="mb-4 text-xl font-bold text-slate-800">
              Why Choose Us?
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Globe,
                  label: "Remote Work",
                  description: "Work from anywhere",
                },
                {
                  icon: Clock,
                  label: "Flexible Hours",
                  description: "Set your own schedule",
                },
                {
                  icon: Zap,
                  label: "Professional Development",
                  description: "Grow your skills",
                },
              ].map((benefit, index) => (
                <Card
                  key={index}
                  className="border-0 shadow-md transition-shadow hover:shadow-lg"
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                      <benefit.icon className="h-5 w-5 text-amber-300" />
                    </div>
                    <h4 className="mb-2 font-semibold text-slate-800">
                      {benefit.label}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="border-0 bg-gradient-to-r from-amber-300 to-amber-300 text-slate-900">
            <CardContent className="p-6 text-center">
              <h4 className="mb-3 text-xl font-bold text-slate-900">
                Ready to Help Businesses Thrive?
              </h4>
              <p className="mb-6 text-slate-800">
                Join our team and help businesses achieve sustainable growth
                while advancing your own career in a supportive remote
                environment.
              </p>
              <Link href="/apply?role=Virtual Assistant">
                <Button
                  onClick={handleApplyClick}
                  size="lg"
                  className="rounded-xl bg-white px-8 py-3 font-semibold text-amber-300 shadow-xl transition-all duration-300 hover:bg-gray-50 hover:shadow-2xl"
                >
                  Apply Now <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
