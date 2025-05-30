import FormNextDay from "@/components/Templates/form-next-day";
import FormSameDay from "@/components/Templates/form-same-day";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Calendar, Clock } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ready Set | SMS Templates",
  description: "Templates for a helpdesk use. ",
};

const page = () => {
  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-amber-600" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            SMS Templates
          </h1>
        </div>
        <p className="text-gray-600">
          Generate SMS templates for driver confirmations and logistics coordination.
        </p>
      </div>

      {/* Main Content */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Template Generator</CardTitle>
          <CardDescription>
            Choose the type of confirmation message you need to send to drivers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tomorrow" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="tomorrow" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tomorrow Confirmation
              </TabsTrigger>
              <TabsTrigger value="today" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Today Confirmation
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="tomorrow" className="space-y-4">
              <div className="rounded-lg border bg-blue-50 p-4">
                <h3 className="font-medium text-blue-900 mb-1">Next Day Confirmation</h3>
                <p className="text-sm text-blue-700">
                  Send detailed order information to drivers for tomorrow's deliveries including pickup times, locations, and payment details.
                </p>
              </div>
              <FormNextDay />
            </TabsContent>
            
            <TabsContent value="today" className="space-y-4">
              <div className="rounded-lg border bg-green-50 p-4">
                <h3 className="font-medium text-green-900 mb-1">Same Day Confirmation</h3>
                <p className="text-sm text-green-700">
                  Send quick confirmation messages to drivers for today's routes with pickup schedules and important reminders.
                </p>
              </div>
              <FormSameDay />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default page;
