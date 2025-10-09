// app/actions/send-email.ts
"use server";

import { Resend } from "resend";
import * as cheerio from "cheerio";
import { sendOrderConfirmationToCustomer } from "@/services/email-notification";
import { prisma } from "@/utils/prismaDB";

interface FormInputs {
  name: string;
  email: string;
  phone?: string;
  message: string;
  subject?: string;
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (data: FormInputs) => {
  if (data.message.length > 1000) {
    throw new Error("Message cannot exceed 1000 characters.");
  }

  // Validate recipient address
  const recipient = process.env.NOTIFICATION_RECIPIENT || "info@readysetllc.com";
  if (!recipient) {
    throw new Error("No recipient configured for emails");
  }

  const notificationType = determineNotificationType(data);
  const { subject, html } = await createEmailContent(data, notificationType);

  try {
    // Add this validation before sending
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error("Invalid recipient email address");
    }

    await resend.emails.send({
      to: recipient,
      from: "Ready Set Website <solutions@updates.readysetllc.com>",
      subject,
      html,
    });

    return "Your message was sent successfully.";
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("Error trying to send the message.");
  }
};

// Helper functions
const determineNotificationType = (data: FormInputs) => {
  if (data.subject?.includes("Vendor Registration")) return "vendor";
  if (data.subject?.includes("Client Registration")) return "client";
  if (data.subject?.includes("Food Delivery")) return "delivery";
  return !data.phone ? "job" : "general";
};

const createEmailContent = async (data: FormInputs, type: string) => {
  let subject = data.subject || "Website Message - Ready Set";
  let html = "";

  switch (type) {
    case "vendor":
    case "client":
      const registration = parseRegistration(data.message);
      subject = `New ${registration.userType} Registration - Ready Set`;
      html = createRegistrationHTML(registration);
      break;

    case "delivery":
      const deliveryData = parseDelivery(data.message);
      subject = "New Food Delivery Quote Request";
      html = createDeliveryHTML(deliveryData);
      break;

    case "job":
      subject = "New Job Application - Ready Set";
      html = createJobHTML(data);
      break;

    default:
      html = createGeneralHTML(data);
  }

  return { subject, html };
};

const parseRegistration = (message: string) => {
  const $ = cheerio.load(message);
  return {
    userType: $('p:contains("User Type:")').text().split(": ")[1],
    name: $('p:contains("Name:")').text().split(": ")[1],
    email: $('p:contains("Email:")').text().split(": ")[1],
    company: $('p:contains("Company:")').text().split(": ")[1],
  };
};

const parseDelivery = (message: string) => {
  const sections: { [key: string]: string } = {};
  let currentSection = "";

  message.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.endsWith(":")) {
      currentSection = trimmed.replace(":", "");
      sections[currentSection] = "";
    } else if (currentSection) {
      sections[currentSection] += trimmed + "\n";
    }
  });

  return sections;
};

// HTML templates
const createRegistrationHTML = (data: any) => `
  <h2>New ${data.userType} Registration</h2>
  <p>User Type: ${data.userType}</p>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  <p>Company: ${data.company}</p>
  <p>Please review this registration in the admin dashboard.</p>
`;

const createDeliveryHTML = (sections: any) => `
  <h2>New Food Delivery Quote Request</h2>
  ${Object.entries(sections)
    .map(
      ([title, content]) => `
    <h3>${title}</h3>
    <pre>${content}</pre>
  `,
    )
    .join("")}
`;

const createJobHTML = (data: FormInputs) => `
  <h2>New Job Application</h2>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  <p>Message: ${data.message}</p>
`;

const createGeneralHTML = (data: FormInputs) => `
  <h2>Website Message</h2>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  ${data.phone ? `<p>Phone: ${data.phone}</p>` : ""}
  <p>Message: ${data.message}</p>
`;

// Delivery notification functionality
interface DeliveryNotificationData {
  orderId: string;
  customerEmail: string | null;
  driverName?: string;
  estimatedDelivery?: Date;
}

/**
 * Send delivery/order notifications to customer
 * This function fetches the order details and sends a confirmation email
 */
export async function sendDeliveryNotifications(
  data: DeliveryNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Sending delivery notification for order:', data.orderId);

    // Fetch order details from database
    // Try catering first
    let order = await prisma.cateringRequest.findUnique({
      where: { id: data.orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    let orderType: 'catering' | 'on_demand' = 'catering';

    // If not found in catering, try on-demand
    if (!order) {
      order = await prisma.onDemand.findUnique({
        where: { id: data.orderId },
        include: {
          user: true,
          pickupAddress: true,
          deliveryAddress: true,
        },
      });
      orderType = 'on_demand';
    }

    if (!order || !order.user) {
      console.error('Order or user not found for ID:', data.orderId);
      return { success: false, error: 'Order not found' };
    }

    // Send confirmation email to customer
    const emailSuccess = await sendOrderConfirmationToCustomer({
      orderNumber: order.orderNumber,
      orderType,
      customerName: order.user.name || 'Valued Customer',
      customerEmail: data.customerEmail || order.user.email || '',
      pickupTime: order.pickupDateTime,
      arrivalTime: order.arrivalDateTime,
      orderTotal: order.orderTotal?.toString() || '0',
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
    });

    if (!emailSuccess) {
      return {
        success: false,
        error: 'Failed to send confirmation email'
      };
    }

    console.log('✅ Delivery notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default sendEmail;
