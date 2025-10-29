/**
 * Reusable Mock for Email Notification Service
 *
 * This mock can be used in any test that needs to mock email notification functions.
 *
 * Usage:
 * ```typescript
 * jest.mock('@/services/email-notification');
 *
 * import {
 *   sendUserWelcomeEmail,
 *   sendOrderNotificationToAdmin,
 *   sendOrderConfirmationToCustomer,
 * } from '@/services/email-notification';
 *
 * // In your test:
 * expect(sendUserWelcomeEmail).toHaveBeenCalledWith(expectedData);
 * ```
 */

/**
 * Mock for sendUserWelcomeEmail
 * Returns: Promise<boolean>
 */
export const sendUserWelcomeEmail = jest.fn().mockResolvedValue(true);

/**
 * Mock for sendOrderNotificationToAdmin
 * Returns: Promise<boolean>
 */
export const sendOrderNotificationToAdmin = jest.fn().mockResolvedValue(true);

/**
 * Mock for sendOrderConfirmationToCustomer
 * Returns: Promise<boolean>
 */
export const sendOrderConfirmationToCustomer = jest.fn().mockResolvedValue(true);

/**
 * Helper to reset all email notification mocks
 */
export const resetEmailNotificationMocks = () => {
  sendUserWelcomeEmail.mockClear();
  sendOrderNotificationToAdmin.mockClear();
  sendOrderConfirmationToCustomer.mockClear();
};

/**
 * Helper to mock email sending failure
 */
export const mockEmailFailure = () => {
  sendUserWelcomeEmail.mockResolvedValue(false);
  sendOrderNotificationToAdmin.mockResolvedValue(false);
  sendOrderConfirmationToCustomer.mockResolvedValue(false);
};

/**
 * Helper to mock email sending errors (throws)
 */
export const mockEmailError = (error = new Error("Email sending failed")) => {
  sendUserWelcomeEmail.mockRejectedValue(error);
  sendOrderNotificationToAdmin.mockRejectedValue(error);
  sendOrderConfirmationToCustomer.mockRejectedValue(error);
};

/**
 * Helper to restore successful email sending
 */
export const mockEmailSuccess = () => {
  sendUserWelcomeEmail.mockResolvedValue(true);
  sendOrderNotificationToAdmin.mockResolvedValue(true);
  sendOrderConfirmationToCustomer.mockResolvedValue(true);
};
