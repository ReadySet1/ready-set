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
import { ChevronRight, Truck, Clock, DollarSign, TrendingUp, MapPin, Users, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CateringModal() {
  const router = useRouter();

  const handleApplyClick = () => {
    // Close the modal
    const escKeyEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escKeyEvent);

    // Scroll to the form after a brief delay to allow modal to close
    setTimeout(() => {
      const formElement = document.getElementById('apply-now');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-600 hover:to-amber-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl font-semibold">
          Learn More <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] mx-auto my-2 sm:my-4 overflow-y-auto max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-white border-0 shadow-2xl rounded-2xl z-[1001] p-0">
        <DialogHeader className="p-6 sm:p-8 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-t-2xl relative">
          <DialogClose className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors z-10">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm">
              Multiple Openings
            </Badge>
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-bold mb-3 text-left">
            Catering Deliveries
          </DialogTitle>
          <DialogDescription className="text-white/90 text-base sm:text-lg text-left">
            Join our team and help us deliver exceptional dining experiences to our clients throughout the Bay Area
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Hero Section */}
          <Card className="border-0 bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-3 text-slate-800">
                About Ready Set
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Ready Set has been your favorite restaurant's go-to logistics partner for catered delivery since 2019. Headquartered in the San Francisco-Bay Area, we're expanding across Atlanta, GA and Austin, TX with plans to scale to New York City.
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Star className="h-4 w-4" />
                <span className="font-medium">Trusted by 500+ restaurants</span>
              </div>
            </CardContent>
          </Card>

          {/* What We Do */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              What We Do
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Users, label: "Daily team lunches", color: "yellow" },
                { icon: MapPin, label: "Corporate events", color: "amber" },
                { icon: Star, label: "Special occasions", color: "orange" }
              ].map((item, index) => (
                <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 text-center">
                    <div className={`w-12 h-12 bg-${item.color}-100 rounded-xl flex items-center justify-center mx-auto mb-3`}>
                      <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                    </div>
                    <p className="font-medium text-slate-700">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-slate-600 leading-relaxed">
              We're proud to serve tech giants like Apple, Google, Facebook, and Netflix, delivering the highest quality food with impeccable timing.
            </p>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              Why Join Our Team?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Clock, label: "Flexible Schedule", description: "Work when it fits your life" },
                { icon: DollarSign, label: "Competitive Pay", description: "Fair compensation for your time" },
                { icon: TrendingUp, label: "Growth Opportunities", description: "Advance your career with us" }
              ].map((benefit, index) => (
                <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mb-3">
                      <benefit.icon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-2">{benefit.label}</h4>
                    <p className="text-sm text-slate-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="border-0 bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
            <CardContent className="p-6 text-center">
              <h4 className="text-xl font-bold mb-3">
                Ready to Start Your Journey?
              </h4>
              <p className="mb-6 text-white/90">
                Join our growing team and be part of delivering exceptional experiences across major tech hubs in the United States.
              </p>
              <Link href="/apply?role=Driver for Catering Deliveries">
                <Button 
                  onClick={handleApplyClick}
                  size="lg"
                  className="bg-white text-yellow-600 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-3 rounded-xl font-semibold"
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