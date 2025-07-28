import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddAddressForm from '@/components/AddressManager/AddAddressForm';

// Mock the COUNTIES data
jest.mock('@/components/Auth/SignUp/ui/FormData', () => ({
  COUNTIES: [
    { label: 'San Francisco', value: 'San Francisco' },
    { label: 'San Mateo', value: 'San Mateo' },
    { label: 'Santa Clara', value: 'Santa Clara' },
    { label: 'Alameda', value: 'Alameda' },
  ],
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch for county API
global.fetch = jest.fn();

describe('AddAddressForm - CA State Validation Fix', () => {
  const mockOnSubmit = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful fetch response for counties
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ counties: ['San Francisco', 'San Mateo'] }),
    });
  });

  const fillRequiredFields = async (user: any, stateValue: string) => {
    // Fill required fields
    await user.click(screen.getByRole('combobox', { name: /county/i }));
    await user.click(screen.getByText('San Francisco'));
    
    await user.type(screen.getByLabelText(/street address/i), '123 Main St');
    await user.type(screen.getByLabelText(/city/i), 'San Francisco');
    await user.type(screen.getByLabelText(/state/i), stateValue);
    await user.type(screen.getByLabelText(/zip code/i), '94103');
  };

  it('should render state input with proper placeholder and help text', () => {
    render(<AddAddressForm {...defaultProps} />);
    
    const stateInput = screen.getByLabelText(/state/i);
    expect(stateInput).toBeInTheDocument();
    expect(stateInput).toHaveAttribute('placeholder', 'CA or California');
    
    // Check for help text
    expect(screen.getByText(/Enter "CA" or "California" \(will be normalized to CA\)/)).toBeInTheDocument();
  });

  it('should accept "CA" as valid state input', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'CA');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
        })
      );
    });
  });

  it('should normalize "California" to "CA"', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'California');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
        })
      );
    });
  });

  it('should normalize "CALIFORNIA" (uppercase) to "CA"', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'CALIFORNIA');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
        })
      );
    });
  });

  it('should normalize "CALIF" to "CA"', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'CALIF');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
        })
      );
    });
  });

  it('should handle state input with extra whitespace', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, '  California  ');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
        })
      );
    });
  });

  it('should preserve non-California state values as-is', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'NY');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'NY',
        })
      );
    });
  });

  it('should show validation error for empty state', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    // Fill all fields except state
    await user.click(screen.getByRole('combobox', { name: /county/i }));
    await user.click(screen.getByText('San Francisco'));
    
    await user.type(screen.getByLabelText(/street address/i), '123 Main St');
    await user.type(screen.getByLabelText(/city/i), 'San Francisco');
    await user.type(screen.getByLabelText(/zip code/i), '94103');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('State is required')).toBeInTheDocument();
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'California');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
    
    // Form should be reset
    const stateInput = screen.getByLabelText(/state/i);
    expect(stateInput).toHaveValue('');
  });

  it('should handle form submission errors gracefully', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValueOnce(new Error('Submission failed'));
    
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'CA');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Submission failed')).toBeInTheDocument();
    });
  });

  it('should disable submit button during form submission', async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: any) => void = () => {};
    const submitPromise = new Promise((resolve) => {
      resolveSubmit = resolve;
    });
    mockOnSubmit.mockReturnValue(submitPromise);
    
    render(<AddAddressForm {...defaultProps} />);
    
    await fillRequiredFields(user, 'CA');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
    
    // Resolve the submission
    resolveSubmit(undefined);
    
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should populate form with initial values including state', () => {
    const initialValues = {
      county: 'San Francisco',
      street1: '456 Oak Ave',
      city: 'San Francisco',
      state: 'California',
      zip: '94103',
    };
    
    render(<AddAddressForm {...defaultProps} initialValues={initialValues} />);
    
    const stateInput = screen.getByLabelText(/state/i);
    expect(stateInput).toHaveValue('California');
  });

  it('should maintain all other form data during state normalization', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    // Fill form with complete data
    await user.click(screen.getByRole('combobox', { name: /county/i }));
    await user.click(screen.getByText('San Francisco'));
    
    await user.type(screen.getByLabelText(/name/i), 'Home Address');
    await user.type(screen.getByLabelText(/street address/i), '123 Main St');
    await user.type(screen.getByLabelText(/street address 2/i), 'Apt 4B');
    await user.type(screen.getByLabelText(/city/i), 'San Francisco');
    await user.type(screen.getByLabelText(/state/i), 'California');
    await user.type(screen.getByLabelText(/zip code/i), '94103');
    await user.type(screen.getByLabelText(/location phone number/i), '415-555-0123');
    await user.type(screen.getByLabelText(/parking\/loading instructions/i), 'Street parking available');
    
    // Check checkboxes
    await user.click(screen.getByLabelText(/restaurant or food business/i));
    await user.click(screen.getByLabelText(/shared address/i));
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          county: 'San Francisco',
          name: 'Home Address',
          street1: '123 Main St',
          street2: 'Apt 4B',
          city: 'San Francisco',
          state: 'CA', // Should be normalized
          zip: '94103',
          locationNumber: '415-555-0123',
          parkingLoading: 'Street parking available',
          isRestaurant: true,
          isShared: true,
        })
      );
    });
  });

  it('should show state help text in addition to validation errors', async () => {
    const user = userEvent.setup();
    render(<AddAddressForm {...defaultProps} />);
    
    // Fill some fields but leave state empty
    await user.type(screen.getByLabelText(/street address/i), '123 Main St');
    
    const submitButton = screen.getByRole('button', { name: /save address/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      // Both help text and validation error should be visible
      expect(screen.getByText(/Enter "CA" or "California" \(will be normalized to CA\)/)).toBeInTheDocument();
      expect(screen.getByText('State is required')).toBeInTheDocument();
    });
  });
}); 