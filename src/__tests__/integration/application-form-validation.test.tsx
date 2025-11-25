// src/__tests__/integration/application-form-validation.test.tsx
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobApplicationForm from '@/components/Apply/ApplyForm';
import { ApplicationSessionProvider } from '@/contexts/ApplicationSessionContext';
import React from 'react';

// Mock session functions
const mockCreateSession = jest.fn();
const mockMarkSessionCompleted = jest.fn();
const mockResetSession = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null)
  })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  })),
  usePathname: jest.fn(() => '/apply')
}));

// Mock the upload hook
jest.mock('@/hooks/use-job-application-upload', () => ({
  useJobApplicationUpload: jest.fn(() => ({
    uploadedFiles: [],
    setUploadedFiles: jest.fn(),
    onUpload: jest.fn(),
    deleteFile: jest.fn(),
    isUploading: false,
    progresses: {}
  }))
}));

// Mock ApplicationSessionContext
jest.mock('@/contexts/ApplicationSessionContext', () => {
  const React = require('react');
  const mockCreateSession = jest.fn();
  const mockMarkSessionCompleted = jest.fn();
  const mockResetSession = jest.fn();

  const mockContext = {
    session: {
      sessionId: 'test-session-id',
      uploadToken: 'test-upload-token',
      expiresAt: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
      uploadCount: 0,
      maxUploads: 10
    },
    isLoading: false,
    error: null,
    createSession: mockCreateSession,
    markSessionCompleted: mockMarkSessionCompleted,
    resetSession: mockResetSession
  };

  return {
    useApplicationSession: () => mockContext,
    ApplicationSessionProvider: ({ children }: any) => {
      // Create a proper context provider for testing
      const ApplicationSessionContext = React.createContext(mockContext);
      return React.createElement(
        ApplicationSessionContext.Provider,
        { value: mockContext },
        children
      );
    }
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

describe('Application Form Validation Timing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onBlur Validation Mode (REA-54 Fix)', () => {
    it('should NOT show validation errors while user is typing', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Select a position to enable form fields
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      // Start typing in first name field
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      await user.type(firstNameInput, 'J');

      // Validation error should NOT appear while typing
      expect(screen.queryByText(/first name must be at least 2 characters/i)).not.toBeInTheDocument();

      // Continue typing
      await user.type(firstNameInput, 'o');

      // Error should still not appear
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
    });

    it('should show validation errors only on blur', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Select a position
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      // Type invalid input (too short)
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      await user.type(firstNameInput, 'J');

      // No error while typing
      expect(screen.queryByText(/first name must be at least 2 characters/i)).not.toBeInTheDocument();

      // Blur the field
      await user.tab();

      // Error should appear after blur
      await waitFor(() => {
        expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate on submit even if fields were not touched', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Try to navigate to next step without filling anything
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/please select a position/i)).toBeInTheDocument();
      });
    });

    it('should validate email format only on blur', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Select position
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      // Type invalid email
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      await user.type(emailInput, 'invalid-email');

      // No error while typing
      expect(screen.queryByText(/invalid email address/i)).not.toBeInTheDocument();

      // Blur the field
      await user.tab();

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user corrects input', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Select position
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      // Type short first name and blur
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      await user.type(firstNameInput, 'J');
      await user.tab();

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
      });

      // Clear and type valid input
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'John');
      await user.tab();

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/first name must be at least 2 characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Step Navigation Validation', () => {
    it('should validate current step before allowing navigation to next step', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Try to go to next step without filling step 1
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should show validation toast
      await waitFor(() => {
        expect(screen.getByText(/please select a position/i)).toBeInTheDocument();
      });

      // Should remain on step 1
      expect(screen.getByText(/Position & Personal Info/i)).toBeInTheDocument();
    });

    it('should allow navigation to next step when current step is valid', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Fill step 1 completely
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      await user.type(screen.getByRole('textbox', { name: /first name/i }), 'John');
      await user.type(screen.getByRole('textbox', { name: /last name/i }), 'Doe');
      await user.type(screen.getByRole('textbox', { name: /email/i }), 'john@example.com');
      await user.type(screen.getByRole('textbox', { name: /phone/i }), '555-1234');

      // Fill address fields
      const streetInput = screen.getByPlaceholderText(/street address/i);
      const cityInput = screen.getByPlaceholderText(/city/i);
      const stateInput = screen.getByPlaceholderText(/state/i);
      const zipInput = screen.getByPlaceholderText(/zip code/i);

      await user.type(streetInput, '123 Main St');
      await user.type(cityInput, 'Springfield');
      await user.type(stateInput, 'IL');
      await user.type(zipInput, '62701');

      // Navigate to next step
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should move to step 2
      await waitFor(() => {
        expect(screen.getByText(/Experience & Skills/i)).toBeInTheDocument();
      });
    });

    it('should allow navigation back to previous steps without validation', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      // Fill minimal data to get to step 2
      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Driver for Catering Deliveries');

      await user.type(screen.getByRole('textbox', { name: /first name/i }), 'John');
      await user.type(screen.getByRole('textbox', { name: /last name/i }), 'Doe');
      await user.type(screen.getByRole('textbox', { name: /email/i }), 'john@example.com');
      await user.type(screen.getByRole('textbox', { name: /phone/i }), '555-1234');

      const streetInput = screen.getByPlaceholderText(/street address/i);
      await user.type(streetInput, '123 Main St');
      await user.type(screen.getByPlaceholderText(/city/i), 'Springfield');
      await user.type(screen.getByPlaceholderText(/state/i), 'IL');
      await user.type(screen.getByPlaceholderText(/zip code/i), '62701');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Move to step 2
      await waitFor(() => {
        expect(screen.getByText(/Experience & Skills/i)).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      // Should return to step 1 without validation errors
      await waitFor(() => {
        expect(screen.getByText(/Position & Personal Info/i)).toBeInTheDocument();
      });
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate phone number format', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      const phoneInput = screen.getByRole('textbox', { name: /phone/i });
      await user.type(phoneInput, 'abc123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid phone number format/i)).toBeInTheDocument();
      });
    });

    it('should accept valid phone number formats', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      const phoneInput = screen.getByRole('textbox', { name: /phone/i });

      // Test various valid formats
      const validFormats = ['555-1234', '(555) 123-4567', '+1 555 123 4567'];

      for (const format of validFormats) {
        await user.clear(phoneInput);
        await user.type(phoneInput, format);
        await user.tab();

        // Should not show error
        await waitFor(() => {
          expect(screen.queryByText(/invalid phone number format/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('ZIP Code Validation', () => {
    it('should validate ZIP code format', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      const zipInput = screen.getByPlaceholderText(/zip code/i);
      await user.type(zipInput, '123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid zip code format/i)).toBeInTheDocument();
      });
    });

    it('should accept valid ZIP code formats', async () => {
      const user = userEvent.setup();
      render(
        <ApplicationSessionProvider>
          <JobApplicationForm />
        </ApplicationSessionProvider>
      );

      const roleSelect = screen.getByRole('combobox', { name: /select position/i });
      await user.selectOptions(roleSelect, 'Virtual Assistant');

      const zipInput = screen.getByPlaceholderText(/zip code/i);

      // Test 5-digit format
      await user.type(zipInput, '62701');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByText(/invalid zip code format/i)).not.toBeInTheDocument();
      });

      // Test 9-digit format
      await user.clear(zipInput);
      await user.type(zipInput, '62701-1234');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByText(/invalid zip code format/i)).not.toBeInTheDocument();
      });
    });
  });
});
