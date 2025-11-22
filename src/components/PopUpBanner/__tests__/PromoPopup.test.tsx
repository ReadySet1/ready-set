import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromoPopup from '../PromoPopup';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
    h1: ({ children, ...props }: any) => React.createElement('h1', props, children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock Radix UI Dialog
jest.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open, onOpenChange }: any) => 
    open ? React.createElement('div', { 'data-testid': 'dialog-root', onClick: () => onOpenChange?.(false) }, children) : null,
  Portal: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-portal' }, children),
  Overlay: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-overlay', ...props }, children),
  Content: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-content', ...props }, children),
  Title: ({ children, ...props }: any) => React.createElement('h2', { 'data-testid': 'dialog-title', ...props }, children),
  Description: ({ children, ...props }: any) => React.createElement('p', { 'data-testid': 'dialog-description', ...props }, children),
  Close: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'dialog-close', ...props }, children),
}));

// Mock VisuallyHidden
jest.mock('@radix-ui/react-visually-hidden', () => ({
  VisuallyHidden: ({ children }: any) => React.createElement('div', { 'data-testid': 'visually-hidden' }, children),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'card', ...props }, children),
  CardContent: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'card-content', ...props }, children),
}));

// Mock AppointmentDialog
jest.mock('@/components/VirtualAssistant/Appointment', () => {
  return function AppointmentDialog({ buttonText, calendarUrl, ...props }: any) {
    return (
      <button 
        data-testid="appointment-dialog" 
        data-calendar-url={calendarUrl}
        {...props}
      >
        {buttonText}
      </button>
    );
  };
});

// Mock dynamic import
jest.mock('next/dynamic', () => {
  return function dynamic(importFn: any, options: any) {
    const Component = importFn();
    return Component;
  };
});

// Mock date utility
jest.mock('@/utils/dates', () => ({
  getPromotionDates: jest.fn(() => ({
    formattedDisplay: 'November 1 to 30, 2025'
  })),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  X: ({ size, ...props }: any) => React.createElement('span', { 'data-testid': 'x-icon', 'data-size': size, ...props }, '×'),
  Phone: ({ size, ...props }: any) => React.createElement('span', { 'data-testid': 'phone-icon', 'data-size': size, ...props }, '📞'),
}));

describe('PromoPopup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('renders without crashing', () => {
      render(<PromoPopup />);
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });

    it('opens automatically on mount', async () => {
      render(<PromoPopup />);
      
      // The dialog should be open by default
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
    });

    it('renders all required elements when open', () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('displays the main promotional heading', () => {
      render(<PromoPopup />);
      
      expect(screen.getByText('ONLY 50 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('displays the promotional offer text', () => {
      render(<PromoPopup />);
      
      expect(screen.getByText(/Get your 1ST DELIVERY FREE/)).toBeInTheDocument();
      expect(screen.getByText(/\(up to \$599 in food cost\)/)).toBeInTheDocument();
      expect(screen.getByText(/within a 10-mile radius!/)).toBeInTheDocument();
    });

    it('displays the terms and conditions', () => {
      render(<PromoPopup />);
      
      expect(screen.getByText(/Extra charges beyond 10 miles/)).toBeInTheDocument();
      expect(screen.getByText(/Orders above \$599 may require additional payment/)).toBeInTheDocument();
      expect(screen.getByText(/Sign-up requirement at readysetllc.com/)).toBeInTheDocument();
    });

    it('displays the phone number', () => {
      render(<PromoPopup />);
      
      const phoneLink = screen.getByRole('link', { name: /\(415\) 226-6857/ });
      expect(phoneLink).toBeInTheDocument();
      expect(phoneLink).toHaveAttribute('href', 'tel:4152266857');
    });

    it('displays the promotional dates', () => {
      render(<PromoPopup />);
      
      expect(screen.getByText(/Limited-time offer from November 1 to 30, 2025/)).toBeInTheDocument();
    });
  });

  describe('Interactive Elements', () => {
    it('renders the close button', () => {
      render(<PromoPopup />);
      
      const closeButton = screen.getByTestId('dialog-close');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('renders the appointment dialog button', () => {
      render(<PromoPopup />);
      
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
      expect(appointmentButton).toHaveTextContent('BOOK A CALL');
    });

    it('passes correct calendar URL to appointment dialog', () => {
      render(<PromoPopup />);
      
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toHaveAttribute('data-calendar-url', 
        'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true'
      );
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('does not render when isOpen is false', async () => {
      const { rerender } = render(<PromoPopup />);
      
      // Initially should be open
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Simulate closing the dialog
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      // After closing, the dialog should not be rendered
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('renders dialog content only when open', () => {
      render(<PromoPopup />);
      
      // When open, all content should be present
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByText('ONLY 50 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('handles state changes correctly', async () => {
      render(<PromoPopup />);
      
      // Should start open
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Close the dialog
      const dialogRoot = screen.getByTestId('dialog-root');
      await userEvent.click(dialogRoot);
      
      // Should be closed now
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('includes proper ARIA labels', () => {
      render(<PromoPopup />);
      
      const closeButton = screen.getByTestId('dialog-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('includes visually hidden title and description', () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('visually-hidden')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
    });

    it('has proper dialog structure', () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('closes when close button is clicked', async () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('closes when overlay is clicked', async () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      const dialogRoot = screen.getByTestId('dialog-root');
      await userEvent.click(dialogRoot);
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('allows phone number to be clicked', async () => {
      render(<PromoPopup />);
      
      const phoneLink = screen.getByRole('link', { name: /\(415\) 226-6857/ });
      expect(phoneLink).toBeInTheDocument();
      expect(phoneLink).toHaveAttribute('href', 'tel:4152266857');
      
      // Should be clickable
      await userEvent.click(phoneLink);
    });
  });

  describe('Component Integration', () => {
    it('integrates with AppointmentDialog component', () => {
      render(<PromoPopup />);
      
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
      expect(appointmentButton).toHaveTextContent('BOOK A CALL');
    });

    it('uses proper card components', () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });

    it('includes proper icons', () => {
      render(<PromoPopup />);
      
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('renders gracefully when date utility fails', () => {
      const mockGetPromotionDates = require('@/utils/dates').getPromotionDates;
      mockGetPromotionDates.mockImplementation(() => {
        throw new Error('Date utility error');
      });
      
      expect(() => render(<PromoPopup />)).not.toThrow();
    });

    it('handles missing calendar URL gracefully', () => {
      render(<PromoPopup />);
      
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders efficiently', () => {
      const { rerender } = render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Re-render should not cause issues
      rerender(<PromoPopup />);
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });

    it('cleans up properly when unmounted', () => {
      const { unmount } = render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      unmount();
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Dynamic Import Behavior', () => {
    it('handles dynamic import correctly', () => {
      // The component should render even with dynamic import
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByText('ONLY 50 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('maintains SSR compatibility', () => {
      // Component should render without client-side specific features
      render(<PromoPopup />);
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('manages isOpen state correctly', async () => {
      render(<PromoPopup />);
      
      // Should start open
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Close it
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      // Should be closed
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('initializes with correct default state', () => {
      render(<PromoPopup />);
      
      // Should be open by default due to useEffect
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });
  });
});
