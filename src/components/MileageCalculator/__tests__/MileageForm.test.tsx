import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MileageForm from '../MileageForm';

jest.mock('@/components/RouteOptimizer/LocationInput', () => {
  return function MockLocationInput({
    label,
    placeholder,
    value,
    onChange,
    onCoordinatesResolved,
    icon,
    error,
    disabled,
  }: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (address: string) => void;
    onCoordinatesResolved?: (lat: number, lng: number) => void;
    icon?: string;
    error?: string;
    disabled?: boolean;
  }) {
    return (
      <div data-testid={`location-input-${icon}`}>
        <label>{label}</label>
        <input
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.length > 5 && onCoordinatesResolved) {
              onCoordinatesResolved(30.2672, -97.7431);
            }
          }}
          disabled={disabled}
        />
        {error && <span role="alert">{error}</span>}
      </div>
    );
  };
});

describe('MileageForm', () => {
  const mockOnCalculate = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pickup and drop-off inputs', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText('Pickup Location')).toBeInTheDocument();
    expect(screen.getByText('Drop-off 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /calculate mileage/i }),
    ).toBeInTheDocument();
  });

  it('renders the Add Stop button with correct count', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    const addButton = screen.getByRole('button', { name: /add stop/i });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent('1/5');
  });

  it('adds a new drop-off when Add Stop is clicked', async () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    const addButton = screen.getByRole('button', { name: /add stop/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Drop-off 2')).toBeInTheDocument();
    });
  });

  it('shows remove button when there are multiple drop-offs', async () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /remove drop-off/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add stop/i }));

    await waitFor(() => {
      const removeButtons = screen.getAllByRole('button', {
        name: /remove drop-off/i,
      });
      expect(removeButtons).toHaveLength(2);
    });
  });

  it('disables submit button when addresses are too short', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /calculate mileage/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={true}
        error={null}
      />,
    );

    expect(screen.getByText('Calculating...')).toBeInTheDocument();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error="Google Maps API key not configured"
      />,
    );

    expect(
      screen.getByText('Google Maps API key not configured'),
    ).toBeInTheDocument();
  });

  it('does not show error alert when error is null', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    expect(
      screen.queryByText('Google Maps API key not configured'),
    ).not.toBeInTheDocument();
  });

  it('limits drop-offs to maximum of 5', async () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    const addButton = screen.getByRole('button', { name: /add stop/i });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(addButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Drop-off 5')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /add stop/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onCalculate with form data when submitted with valid addresses', async () => {
    const user = userEvent.setup();

    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={false}
        error={null}
      />,
    );

    const pickupInput = screen.getByLabelText('Pickup Location');
    const dropoffInput = screen.getByLabelText('Drop-off 1');

    await user.type(pickupInput, '123 Main St, Austin TX');
    await user.type(dropoffInput, '456 Oak Ave, Dallas TX');

    const submitButton = screen.getByRole('button', {
      name: /calculate mileage/i,
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnCalculate).toHaveBeenCalledTimes(1);
      const [pickup, dropoffs] = mockOnCalculate.mock.calls[0];
      expect(pickup.address).toBe('123 Main St, Austin TX');
      expect(dropoffs).toHaveLength(1);
      expect(dropoffs[0].address).toBe('456 Oak Ave, Dallas TX');
    });
  });

  it('disables submit while loading', () => {
    render(
      <MileageForm
        onCalculate={mockOnCalculate}
        isLoading={true}
        error={null}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /calculating/i,
    });
    expect(submitButton).toBeDisabled();
  });
});
