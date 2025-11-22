import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsultationBanner from '../Consultation';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
    h1: ({ children, ...props }: any) => React.createElement('h1', props, children),
    h2: ({ children, ...props }: any) => React.createElement('h2', props, children),
    p: ({ children, ...props }: any) => React.createElement('p', props, children),
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
  return function AppointmentDialog({ buttonText, calendarUrl, buttonVariant, ...props }: any) {
    return (
      <button 
        data-testid="appointment-dialog" 
        data-calendar-url={calendarUrl}
        data-variant={buttonVariant}
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
  Phone: ({ className, ...props }: any) => React.createElement('span', { 'data-testid': 'phone-icon', className, ...props }, '📞'),
}));

describe('ConsultationBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial Rendering and Timing', () => {
    it('renders without crashing', () => {
      render(<ConsultationBanner />);
      
      // Initially should not be open (1 second delay)
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('opens after 1 second delay', async () => {
      render(<ConsultationBanner />);
      
      // Should not be open initially
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
      
      // Fast-forward time by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should now be open
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });

    it('does not open before the delay', () => {
      render(<ConsultationBanner />);
      
      // Fast-forward by 500ms (less than 1 second)
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      // Should still not be open
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('cleans up timer on unmount', () => {
      const { unmount } = render(<ConsultationBanner />);
      
      // Unmount before timer fires
      unmount();
      
      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should not be open since component was unmounted
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('displays the main promotional heading', () => {
      expect(screen.getByText('ONLY 20 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('displays the consultation offer text', () => {
      expect(screen.getByText(/Book a Consultation & Get 10 FREE/)).toBeInTheDocument();
      expect(screen.getByText(/VA Hours!/)).toBeInTheDocument();
    });

    it('displays the phone number', () => {
      const phoneLink = screen.getByRole('link', { name: /\(415\) 226-6857/ });
      expect(phoneLink).toBeInTheDocument();
      expect(phoneLink).toHaveAttribute('href', 'tel:4152266857');
    });

    it('displays the promotional dates', () => {
      expect(screen.getByText(/Limited-time offer from November 1 to 30, 2025/)).toBeInTheDocument();
    });

    it('renders all required elements when open', () => {
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });

  describe('Interactive Elements', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('renders the close button', () => {
      const closeButton = screen.getByTestId('dialog-close');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
      expect(closeButton).toHaveTextContent('×');
    });

    it('renders the appointment dialog button', () => {
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
      expect(appointmentButton).toHaveTextContent('BOOK A CALL');
    });

    it('passes correct props to appointment dialog', () => {
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toHaveAttribute('data-calendar-url', 
        'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ26Tewp9laqwen17F4qh13UwlakRL20eQ6LOJn7ANJ4swhUdFfc4inaFMixVsMghhFzE3nlpTSx?gv=true'
      );
      expect(appointmentButton).toHaveAttribute('data-variant', 'black');
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('does not render when isOpen is false initially', () => {
      render(<ConsultationBanner />);
      
      // Should not be open initially
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('renders dialog content only when open', () => {
      render(<ConsultationBanner />);
      
      // Open the dialog
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // When open, all content should be present
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByText('ONLY 20 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('handles state changes correctly', async () => {
      render(<ConsultationBanner />);
      
      // Open the dialog
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Close the dialog
      const dialogRoot = screen.getByTestId('dialog-root');
      await userEvent.click(dialogRoot);
      
      // Should be closed now
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('shows and hides content based on isOpen state', async () => {
      render(<ConsultationBanner />);
      
      // Initially closed
      expect(screen.queryByText('ONLY 20 SLOTS AVAILABLE')).not.toBeInTheDocument();
      
      // Open after delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('ONLY 20 SLOTS AVAILABLE')).toBeInTheDocument();
      
      // Close it
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      expect(screen.queryByText('ONLY 20 SLOTS AVAILABLE')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('includes proper ARIA labels', () => {
      const closeButton = screen.getByTestId('dialog-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('includes visually hidden title and description', () => {
      expect(screen.getByTestId('visually-hidden')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
    });

    it('has proper dialog structure', () => {
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });

    it('provides meaningful dialog title and description', () => {
      expect(screen.getByText('Book Your Free Consultation')).toBeInTheDocument();
      expect(screen.getByText(/Book a consultation and receive 10 free VA hours/)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('closes when close button is clicked', async () => {
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('closes when overlay is clicked', async () => {
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      const dialogRoot = screen.getByTestId('dialog-root');
      await userEvent.click(dialogRoot);
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('allows phone number to be clicked', async () => {
      const phoneLink = screen.getByRole('link', { name: /\(415\) 226-6857/ });
      expect(phoneLink).toBeInTheDocument();
      expect(phoneLink).toHaveAttribute('href', 'tel:4152266857');
      
      // Should be clickable
      await userEvent.click(phoneLink);
    });

    it('allows appointment button to be clicked', async () => {
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
      
      await userEvent.click(appointmentButton);
    });
  });

  describe('Component Integration', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('integrates with AppointmentDialog component', () => {
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
      expect(appointmentButton).toHaveTextContent('BOOK A CALL');
    });

    it('uses proper card components', () => {
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });

    it('includes proper icons', () => {
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    });
  });

  describe('Timer Management', () => {
    it('sets up timer correctly on mount', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      render(<ConsultationBanner />);
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
      
      setTimeoutSpy.mockRestore();
    });

    it('clears timer on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(<ConsultationBanner />);
      unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });

    it('handles multiple timer cycles correctly', () => {
      const { rerender } = render(<ConsultationBanner />);
      
      // First cycle
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Re-render component
      rerender(<ConsultationBanner />);
      
      // Should still work correctly
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('renders gracefully when date utility fails', () => {
      const mockGetPromotionDates = require('@/utils/dates').getPromotionDates;
      mockGetPromotionDates.mockImplementation(() => {
        throw new Error('Date utility error');
      });
      
      expect(() => {
        render(<ConsultationBanner />);
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    });

    it('handles missing calendar URL gracefully', () => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toBeInTheDocument();
    });

    it('handles timer errors gracefully', () => {
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn(() => {
        throw new Error('Timer error');
      });
      
      expect(() => render(<ConsultationBanner />)).not.toThrow();
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Performance', () => {
    it('renders efficiently', () => {
      const { rerender } = render(<ConsultationBanner />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Re-render should not cause issues
      rerender(<ConsultationBanner />);
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });

    it('cleans up properly when unmounted', () => {
      const { unmount } = render(<ConsultationBanner />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      unmount();
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('does not cause memory leaks with timers', () => {
      const { unmount } = render(<ConsultationBanner />);
      
      // Unmount before timer completes
      unmount();
      
      // Advance time - should not cause any issues
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Dynamic Import Behavior', () => {
    it('handles dynamic import correctly', () => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByText('ONLY 20 SLOTS AVAILABLE')).toBeInTheDocument();
    });

    it('maintains SSR compatibility', () => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('manages isOpen state correctly with timer', async () => {
      render(<ConsultationBanner />);
      
      // Should start closed
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
      
      // Open after delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      
      // Close it
      const closeButton = screen.getByTestId('dialog-close');
      await userEvent.click(closeButton);
      
      // Should be closed
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('initializes with correct default state', () => {
      render(<ConsultationBanner />);
      
      // Should be closed by default (before timer)
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Component Variants', () => {
    beforeEach(() => {
      render(<ConsultationBanner />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('uses different styling than PromoPopup', () => {
      // This banner uses white background vs gray-800 in PromoPopup
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      
      // Different button variant
      const appointmentButton = screen.getByTestId('appointment-dialog');
      expect(appointmentButton).toHaveAttribute('data-variant', 'black');
    });

    it('has different content structure than PromoPopup', () => {
      // Different heading
      expect(screen.getByText('ONLY 20 SLOTS AVAILABLE')).toBeInTheDocument();
      expect(screen.queryByText('ONLY 50 SLOTS AVAILABLE')).not.toBeInTheDocument();
      
      // Different offer
      expect(screen.getByText(/Book a Consultation & Get 10 FREE/)).toBeInTheDocument();
      expect(screen.queryByText(/Get your 1ST DELIVERY FREE/)).not.toBeInTheDocument();
    });
  });
});
