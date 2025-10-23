"use client";

import Link from 'next/link';
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
import { ChevronRight, Headphones, Clock, Target, Brain, BarChart, Globe, Zap, CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function VAModal() {
  const router = useRouter();

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation

    // Close the modal first
    const escKeyEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escKeyEvent);

    // Wait for modal to close, then navigate if needed
    setTimeout(() => {
      // Check if we're already on the apply page
      if (window.location.pathname === '/apply') {
        // Already on apply page, just scroll to form
        const formElement = document.getElementById('apply-now');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        // Navigate to apply page with role parameter, then scroll
        router.push('/apply?role=Virtual Assistant');
        // Wait for navigation and DOM to be ready
        setTimeout(() => {
          const formElement = document.getElementById('apply-now');
          if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    }, 150);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl font-semibold">
          Learn More <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] mx-auto my-2 sm:my-4 overflow-y-auto max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-white border-0 shadow-2xl rounded-2xl z-[1001] p-0">
        <DialogHeader className="p-6 sm:p-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-2xl relative">
          <DialogClose className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors z-10">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm">
              Remote Position
            </Badge>
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-bold mb-3 text-left">
            Virtual Assistant
          </DialogTitle>
          <DialogDescription className="text-white/90 text-base sm:text-lg text-left">
            Help businesses thrive while growing your career in a fully remote environment
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Hero Section */}
          <Card className="border-0 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-3 text-slate-800">
                Be Part of Something Great
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Join our team of skilled virtual assistants helping businesses across the US achieve sustainable growth and success. With over 50,000 project hours delivered, we're looking for dedicated professionals to help expand our impact.
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Globe className="h-4 w-4" />
                <span className="font-medium">100% Remote • Flexible Hours</span>
              </div>
            </CardContent>
          </Card>

          {/* What We're Looking For */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              What We're Looking For
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Clock,
                  title: "Time Management",
                  description: "Excellent organizational skills and ability to handle multiple tasks efficiently",
                  color: "amber"
                },
                {
                  icon: Target,
                  title: "Problem Solving",
                  description: "Creative problem-solver who can develop efficient workflows",
                  color: "orange"
                },
                {
                  icon: Brain,
                  title: "Initiative",
                  description: "Self-motivated with strong initiative and attention to detail",
                  color: "yellow"
                },
                {
                  icon: BarChart,
                  title: "Business Acumen",
                  description: "Understanding of business operations and growth strategies",
                  color: "red"
                }
              ].map((item, index) => (
                <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-3">
                      <div className={`w-10 h-10 bg-${item.color}-100 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300`}>
                        <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                      </div>
                      <h4 className="font-semibold text-slate-800">{item.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* What You'll Do */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              What You'll Do
            </h3>
            <div className="space-y-3">
              {[
                "Help businesses streamline their operations and create efficient workflows",
                "Manage daily tasks and priorities for business owners",
                "Implement systems and processes for sustainable growth",
                "Contribute to the success of businesses across various industries"
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              Why Choose Us?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Globe, label: "Remote Work", description: "Work from anywhere" },
                { icon: Clock, label: "Flexible Hours", description: "Set your own schedule" },
                { icon: Zap, label: "Professional Development", description: "Grow your skills" }
              ].map((benefit, index) => (
                <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                      <benefit.icon className="h-5 w-5 text-amber-600" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-2">{benefit.label}</h4>
                    <p className="text-sm text-slate-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <CardContent className="p-6 text-center">
              <h4 className="text-xl font-bold mb-3">
                Ready to Help Businesses Thrive?
              </h4>
              <p className="mb-6 text-white/90">
                Join our team and help businesses achieve sustainable growth while advancing your own career in a supportive remote environment.
              </p>
              <Link href="/apply?role=Virtual Assistant">
                <Button 
                  onClick={handleApplyClick}
                  size="lg"
                  className="bg-white text-amber-600 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-3 rounded-xl font-semibold"
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