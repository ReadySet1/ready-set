/**
 * Unified Email Notification Service
 *
 * This service provides a single, consistent interface for sending all types
 * of email notifications across the Ready Set platform. All emails use the
 * unified template system with the Ready Set logo and brand styling.
 *
 * Email Types:
 * - User Registration (all roles: vendor, client, driver, helpdesk, admin, super_admin)
 * - Order Notifications (catering and on-demand orders)
 * - Password Reset (customized Supabase template)
 */

import { Resend } from "resend";
import {
  generateUnifiedEmailTemplate,
  generateDetailsTable,
  generateOrderedList,
  generateInfoBox,
  BRAND_COLORS
} from "@/utils/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const fromEmail = process.env.EMAIL_FROM || "solutions@updates.readysetllc.com";
const adminEmail = process.env.ADMIN_EMAIL || "info@ready-set.co";

/**
 * User Registration Email Data
 */
interface UserRegistrationData {
  email: string;
  name: string;
  userType: 'vendor' | 'client' | 'driver' | 'helpdesk' | 'admin' | 'super_admin';
  temporaryPassword?: string;
  isAdminCreated?: boolean;
}

/**
 * Order Notification Email Data
 */
interface OrderNotificationData {
  orderNumber: string;
  orderType: 'catering' | 'on_demand';
  customerName: string;
  customerEmail: string;
  brokerage?: string | null;
  date: Date | null;
  pickupTime: Date | null;
  arrivalTime: Date | null;
  completeTime?: Date | null;
  orderTotal: number | string;
  clientAttention: string | null;
  status?: string | null;
  driverStatus?: string | null;
  pickupAddress: AddressData;
  deliveryAddress: AddressData;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  // Catering specific
  headcount?: string | null;
  needHost?: string | null;
  hoursNeeded?: string | null;
  numberOfHosts?: string | null;
  // On-demand specific
  itemDelivered?: string | null;
  vehicleType?: string | null;
  dimensions?: {
    length?: string | null;
    width?: string | null;
    height?: string | null;
  };
  weight?: string | null;
}

interface AddressData {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  county?: string | null;
}

/**
 * Customer Order Confirmation Email Data
 */
interface CustomerOrderConfirmationData {
  orderNumber: string;
  orderType: 'catering' | 'on_demand';
  customerName: string;
  customerEmail: string;
  pickupTime: Date | null;
  arrivalTime: Date | null;
  orderTotal: number | string;
  pickupAddress: AddressData;
  deliveryAddress: AddressData;
}

/**
 * Send welcome email to newly registered users (all roles)
 */
export async function sendUserWelcomeEmail(data: UserRegistrationData): Promise<boolean> {
  const userTypeLabel = data.userType.charAt(0).toUpperCase() + data.userType.slice(1).replace('_', ' ');

  // Build account details
  const accountDetails = generateDetailsTable([
    { label: 'Email', value: data.email },
    { label: 'Account Type', value: userTypeLabel },
  ]);

  let content = '';
  let ctaText = 'Go to Login Page';
  let ctaUrl = `${siteUrl}/sign-in`;

  // Different content based on whether admin created the account or self-registration
  if (data.isAdminCreated && data.temporaryPassword) {
    // Admin-created account with temporary password
    const loginDetails = generateDetailsTable([
      { label: 'Email', value: data.email },
      { label: 'Temporary Password', value: data.temporaryPassword },
    ]);

    content = `
      <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
        Welcome to Ready Set Platform! Your account has been successfully created by an administrator.
      </p>

      <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Your Login Credentials:</h3>
      ${loginDetails}

      ${generateInfoBox(
        '<strong>🔒 Security Notice:</strong> For security reasons, you will be required to change your password upon your first login.',
        'warning'
      )}

      ${generateOrderedList([
        'Click the login button below to access your account',
        'Use the credentials provided above',
        'You\'ll be prompted to create a new, secure password',
        'After changing your password, you can start using the platform'
      ], 'Next Steps:')}
    `;
    ctaText = 'Login to Your Account';
  } else {
    // Self-registration
    content = `
      <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
        Thank you for registering as a <strong>${userTypeLabel}</strong> with Ready Set Platform.
      </p>

      <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Your account has been created successfully!</h3>
      ${accountDetails}

      ${generateOrderedList([
        'Check your email for the confirmation link from Supabase',
        'Click the confirmation link to verify your email address',
        'Once verified, you can log in to your account'
      ], 'Next Steps:')}
    `;
  }

  const emailBody = generateUnifiedEmailTemplate({
    title: 'Welcome to Ready Set!',
    greeting: `Hello ${data.name}! 👋`,
    content,
    ctaUrl,
    ctaText,
  });

  try {
    await resend.emails.send({
      to: data.email,
      from: fromEmail,
      subject: `Welcome to Ready Set - Your ${userTypeLabel} Account is Ready!`,
      html: emailBody,
    });
    console.log(`✅ Welcome email sent successfully to ${data.email}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return false;
  }
}

/**
 * Send order notification to admin when new order is created
 */
export async function sendOrderNotificationToAdmin(data: OrderNotificationData): Promise<boolean> {
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (time: Date | null) => {
    if (!time) return "N/A";
    return new Date(time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  const formatAddress = (address: AddressData) => {
    const parts = [
      address.street1,
      address.street2,
      address.city,
      address.state,
      address.zip
    ].filter(part => part);
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const formatOrderTotal = (total: number | string) => {
    const numericTotal = typeof total === 'number' ? total : parseFloat(total);
    return isNaN(numericTotal) ? "0.00" : numericTotal.toFixed(2);
  };

  // Build order details
  const orderDetails = [
    { label: 'Order Number', value: data.orderNumber },
    { label: 'Order Type', value: data.orderType === 'catering' ? 'Catering' : 'On-Demand' },
    { label: 'Brokerage', value: data.brokerage || "N/A" },
    { label: 'Customer Name', value: data.customerName },
    { label: 'Customer Email', value: data.customerEmail },
    { label: 'Date', value: formatDate(data.date) },
    { label: 'Pickup Time', value: formatTime(data.pickupTime) },
    { label: 'Arrival Time', value: formatTime(data.arrivalTime) },
  ];

  if (data.completeTime) {
    orderDetails.push({ label: 'Complete Time', value: formatTime(data.completeTime) });
  }

  orderDetails.push(
    { label: 'Order Total', value: `$${formatOrderTotal(data.orderTotal)}` },
    { label: 'Client Attention', value: data.clientAttention || "N/A" },
    { label: 'Status', value: data.status || "N/A" }
  );

  if (data.driverStatus) {
    orderDetails.push({ label: 'Driver Status', value: data.driverStatus });
  }

  // Address details
  const addressDetails = [
    { label: 'Pickup Address', value: formatAddress(data.pickupAddress) },
    { label: 'Drop-off Address', value: formatAddress(data.deliveryAddress) },
  ];

  // Order-type specific details
  let specificDetails: Array<{ label: string; value: string }> = [];

  if (data.orderType === 'catering') {
    specificDetails = [
      { label: 'Headcount', value: data.headcount || "N/A" },
      { label: 'Need Host', value: data.needHost || "N/A" },
      { label: 'Hours Needed', value: data.hoursNeeded || "N/A" },
      { label: 'Number of Hosts', value: data.numberOfHosts || "N/A" },
    ];
  } else {
    specificDetails = [
      { label: 'Item Delivered', value: data.itemDelivered || "N/A" },
      { label: 'Vehicle Type', value: data.vehicleType || "N/A" },
      {
        label: 'Dimensions (L x W x H)',
        value: data.dimensions
          ? `${data.dimensions.length || "N/A"} x ${data.dimensions.width || "N/A"} x ${data.dimensions.height || "N/A"}`
          : "N/A"
      },
      { label: 'Weight', value: data.weight || "N/A" },
    ];
  }

  // Build content
  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
      A new ${data.orderType} order has been placed and requires your attention.
    </p>

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Order Information</h3>
    ${generateDetailsTable(orderDetails)}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Address Information</h3>
    ${generateDetailsTable(addressDetails)}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">${data.orderType === 'catering' ? 'Catering' : 'Delivery'} Details</h3>
    ${generateDetailsTable(specificDetails)}

    ${data.pickupNotes ? `
      <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Pickup Notes</h3>
      <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary}; background: ${BRAND_COLORS.background.secondary}; padding: 15px; border-radius: 6px;">
        ${data.pickupNotes}
      </p>
    ` : ''}

    ${data.specialNotes ? `
      <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Special Notes</h3>
      <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary}; background: ${BRAND_COLORS.background.secondary}; padding: 15px; border-radius: 6px;">
        ${data.specialNotes}
      </p>
    ` : ''}
  `;

  const emailBody = generateUnifiedEmailTemplate({
    title: `New ${data.orderType === 'catering' ? 'Catering' : 'On-Demand'} Order`,
    greeting: `Order #${data.orderNumber} 📦`,
    content,
    ctaUrl: `${siteUrl}/admin/orders`,
    ctaText: 'View Order in Dashboard',
    infoMessage: 'Please review and process this order as soon as possible.',
    infoType: 'info'
  });

  try {
    await resend.emails.send({
      to: adminEmail,
      from: fromEmail,
      subject: `New ${data.orderType === 'catering' ? 'Catering' : 'On-Demand'} Order - ${data.orderNumber}`,
      html: emailBody,
    });
    console.log(`✅ Order notification email sent successfully to admin for order ${data.orderNumber}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending order notification email:", error);
    return false;
  }
}

/**
 * Send order confirmation to customer
 */
export async function sendOrderConfirmationToCustomer(data: CustomerOrderConfirmationData): Promise<boolean> {
  const formatTime = (time: Date | null) => {
    if (!time) return "N/A";
    return new Date(time).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: AddressData) => {
    const parts = [
      address.street1,
      address.street2,
      address.city,
      address.state,
      address.zip
    ].filter(part => part);
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const formatOrderTotal = (total: number | string) => {
    const numericTotal = typeof total === 'number' ? total : parseFloat(total);
    return isNaN(numericTotal) ? "0.00" : numericTotal.toFixed(2);
  };

  const orderSummary = generateDetailsTable([
    { label: 'Order Number', value: data.orderNumber },
    { label: 'Order Type', value: data.orderType === 'catering' ? 'Catering' : 'On-Demand Delivery' },
    { label: 'Pickup Time', value: formatTime(data.pickupTime) },
    { label: 'Estimated Arrival', value: formatTime(data.arrivalTime) },
    { label: 'Order Total', value: `$${formatOrderTotal(data.orderTotal)}` },
  ]);

  const addressInfo = generateDetailsTable([
    { label: 'Pickup Address', value: formatAddress(data.pickupAddress) },
    { label: 'Delivery Address', value: formatAddress(data.deliveryAddress) },
  ]);

  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
      Thank you for your order! We've received your ${data.orderType} request and it's being processed.
    </p>

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Order Summary</h3>
    ${orderSummary}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Delivery Information</h3>
    ${addressInfo}

    ${generateInfoBox(
      'You will receive updates about your order status via email. You can also track your order in your dashboard.',
      'info'
    )}
  `;

  const emailBody = generateUnifiedEmailTemplate({
    title: 'Order Confirmation',
    greeting: `Hello ${data.customerName}! 👋`,
    content,
    ctaUrl: `${siteUrl}/dashboard/orders`,
    ctaText: 'View Order Status',
  });

  try {
    await resend.emails.send({
      to: data.customerEmail,
      from: fromEmail,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html: emailBody,
    });
    console.log(`✅ Order confirmation email sent successfully to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending order confirmation email:", error);
    return false;
  }
}
