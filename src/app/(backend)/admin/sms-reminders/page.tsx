import { Metadata } from "next";
import SmsRemindersClient from "./sms-reminders-client";

export const metadata: Metadata = {
  title: "Ready Set | SMS Reminders",
  description: "Automated SMS reminders for driver deliveries",
};

export default function SmsRemindersPage() {
  return <SmsRemindersClient />;
}
