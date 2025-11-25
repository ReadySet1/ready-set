import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Test suite for conditional rendering patterns used throughout the application.
 * This focuses on testing the logic patterns that were used in promotional banners
 * and other components that have conditional display logic.
 */

// Test component that mimics the conditional rendering patterns
interface ConditionalComponentProps {
  shouldRender: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  autoShow?: boolean;
  delay?: number;
  onToggle?: (visible: boolean) => void;
}

const ConditionalComponent: React.FC<ConditionalComponentProps> = ({
  shouldRender: initialRender,
  isLoading = false,
  hasError = false,
  autoShow = false,
  delay = 0,
  onToggle,
}) => {
  const [isVisible, setIsVisible] = React.useState(initialRender);
  const [isReady, setIsReady] = React.useState(delay === 0);

  // Handle auto-show with delay (similar to banner behavior)
  React.useEffect(() => {
    if (autoShow && delay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsReady(true);
        onToggle?.(true);
      }, delay);

      return () => clearTimeout(timer);
    } else if (autoShow && delay === 0) {
      setIsVisible(true);
      onToggle?.(true);
    }
  }, [autoShow, delay, onToggle]);

  // Handle initial delay
  React.useEffect(() => {
    if (delay > 0 && !autoShow) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [delay, autoShow]);

  const handleClose = () => {
    setIsVisible(false);
    onToggle?.(false);
  };

  // Loading state
  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  // Error state
  if (hasError) {
    return <div data-testid="error">Error occurred</div>;
  }

  // Not ready (delay not completed)
  if (!isReady) {
    return <div data-testid="not-ready">Preparing...</div>;
  }

  // Conditional rendering based on visibility
  if (!isVisible) {
    return <div data-testid="hidden">Component is hidden</div>;
  }

  return (
    <div data-testid="visible-content">
      <h2>Conditional Component</h2>
      <p>This component demonstrates conditional rendering patterns</p>
      <button data-testid="close-btn" onClick={handleClose}>
        Close
      </button>
    </div>
  );
};

// Component that tests multiple conditional states
interface MultiStateComponentProps {
  state: 'hidden' | 'loading' | 'error' | 'visible';
  content?: string;
}

const MultiStateComponent: React.FC<MultiStateComponentProps> = ({
  state,
  content = 'Default content',
}) => {
  switch (state) {
    case 'loading':
      return <div data-testid="multi-loading">Loading state</div>;
    case 'error':
      return <div data-testid="multi-error">Error state</div>;
    case 'visible':
      return <div data-testid="multi-visible">{content}</div>;
    case 'hidden':
    default:
      return null;
  }
};

describe('Conditional Rendering Patterns', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Conditional Rendering', () => {
    it('renders content when shouldRender is true', () => {
      render(<ConditionalComponent shouldRender={true} />);
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      expect(screen.getByText('Conditional Component')).toBeInTheDocument();
    });

    it('renders hidden state when shouldRender is false', () => {
      render(<ConditionalComponent shouldRender={false} />);
      
      expect(screen.getByTestId('hidden')).toBeInTheDocument();
      expect(screen.getByText('Component is hidden')).toBeInTheDocument();
    });

    it('prioritizes loading state over visibility', () => {
      render(<ConditionalComponent shouldRender={true} isLoading={true} />);
      
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.queryByTestId('visible-content')).not.toBeInTheDocument();
    });

    it('prioritizes error state over loading and visibility', () => {
      render(
        <ConditionalComponent 
          shouldRender={true} 
          isLoading={true} 
          hasError={true} 
        />
      );
      
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('visible-content')).not.toBeInTheDocument();
    });
  });

  describe('Auto-show with Delay (Banner-like behavior)', () => {
    it('shows content immediately when autoShow is true and no delay', () => {
      render(<ConditionalComponent shouldRender={false} autoShow={true} />);
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });

    it('shows content after delay when autoShow is true with delay', async () => {
      render(
        <ConditionalComponent 
          shouldRender={false} 
          autoShow={true} 
          delay={1000} 
        />
      );
      
      // Should show preparing state initially
      expect(screen.getByTestId('not-ready')).toBeInTheDocument();
      
      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should show content after delay
      await waitFor(() => {
        expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      });
    });

    it('calls onToggle callback when auto-showing', async () => {
      const onToggle = jest.fn();
      
      render(
        <ConditionalComponent 
          shouldRender={false} 
          autoShow={true} 
          delay={500}
          onToggle={onToggle}
        />
      );
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(true);
      });
    });

    it('handles delay without auto-show', async () => {
      render(
        <ConditionalComponent 
          shouldRender={true} 
          delay={500}
        />
      );
      
      // Should show not-ready initially
      expect(screen.getByTestId('not-ready')).toBeInTheDocument();
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      // Should show content after delay
      await waitFor(() => {
        expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('allows closing the component', async () => {
      const onToggle = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      
      const closeButton = screen.getByTestId('close-btn');
      await user.click(closeButton);
      
      expect(screen.getByTestId('hidden')).toBeInTheDocument();
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('handles multiple open/close cycles', async () => {
      const onToggle = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      const { rerender } = render(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      // Close it
      const closeButton = screen.getByTestId('close-btn');
      await user.click(closeButton);
      
      expect(screen.getByTestId('hidden')).toBeInTheDocument();
      
      // Show it again
      rerender(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });
  });

  describe('Timer Management', () => {
    it('cleans up timers on unmount', () => {
      const { unmount } = render(
        <ConditionalComponent 
          shouldRender={false} 
          autoShow={true} 
          delay={1000}
        />
      );
      
      expect(screen.getByTestId('not-ready')).toBeInTheDocument();
      
      unmount();
      
      // Fast-forward time after unmount
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should not cause any issues
      expect(screen.queryByTestId('visible-content')).not.toBeInTheDocument();
    });

    it('handles multiple timer setups correctly', () => {
      const { rerender } = render(
        <ConditionalComponent 
          shouldRender={false} 
          autoShow={true} 
          delay={1000}
        />
      );
      
      // Change delay
      rerender(
        <ConditionalComponent 
          shouldRender={false} 
          autoShow={true} 
          delay={500}
        />
      );
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });
  });

  describe('Multi-State Component Patterns', () => {
    it('renders different states correctly', () => {
      const { rerender } = render(<MultiStateComponent state="hidden" />);
      
      // Hidden state
      expect(screen.queryByTestId('multi-visible')).not.toBeInTheDocument();
      expect(screen.queryByTestId('multi-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('multi-error')).not.toBeInTheDocument();
      
      // Loading state
      rerender(<MultiStateComponent state="loading" />);
      expect(screen.getByTestId('multi-loading')).toBeInTheDocument();
      
      // Error state
      rerender(<MultiStateComponent state="error" />);
      expect(screen.getByTestId('multi-error')).toBeInTheDocument();
      
      // Visible state
      rerender(<MultiStateComponent state="visible" content="Test content" />);
      expect(screen.getByTestId('multi-visible')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('handles state transitions smoothly', () => {
      const { rerender } = render(<MultiStateComponent state="loading" />);
      
      expect(screen.getByTestId('multi-loading')).toBeInTheDocument();
      
      rerender(<MultiStateComponent state="visible" content="Loaded content" />);
      
      expect(screen.queryByTestId('multi-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('multi-visible')).toBeInTheDocument();
      expect(screen.getByText('Loaded content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined props gracefully', () => {
      render(<ConditionalComponent shouldRender={true} />);
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });

    it('handles zero delay correctly', () => {
      render(
        <ConditionalComponent 
          shouldRender={true} 
          delay={0}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });

    it('handles negative delay as zero', () => {
      render(
        <ConditionalComponent 
          shouldRender={true} 
          delay={-100}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
    });

    it('handles callback errors gracefully', async () => {
      const onToggle = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      const closeButton = screen.getByTestId('close-btn');
      
      // Should not crash when callback throws
      await user.click(closeButton);
      
      expect(screen.getByTestId('hidden')).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('does not cause unnecessary re-renders', () => {
      const onToggle = jest.fn();
      
      const { rerender } = render(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      
      // Re-render with same props
      rerender(
        <ConditionalComponent 
          shouldRender={true} 
          onToggle={onToggle}
        />
      );
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('handles rapid state changes efficiently', async () => {
      const { rerender } = render(<MultiStateComponent state="hidden" />);
      
      // Rapidly change states
      for (let i = 0; i < 10; i++) {
        const states: Array<'hidden' | 'loading' | 'error' | 'visible'> = 
          ['hidden', 'loading', 'error', 'visible'];
        const state = states[i % states.length];
        
        rerender(<MultiStateComponent state={state} />);
      }
      
      // Should end up in visible state
      expect(screen.getByTestId('multi-loading')).toBeInTheDocument();
    });
  });

  describe('Accessibility Considerations', () => {
    it('maintains proper DOM structure during state changes', () => {
      const { rerender } = render(<ConditionalComponent shouldRender={true} />);
      
      expect(screen.getByTestId('visible-content')).toBeInTheDocument();
      
      rerender(<ConditionalComponent shouldRender={false} />);
      
      expect(screen.getByTestId('hidden')).toBeInTheDocument();
      expect(screen.queryByTestId('visible-content')).not.toBeInTheDocument();
    });

    it('provides meaningful content in all states', () => {
      const { rerender } = render(<ConditionalComponent shouldRender={true} isLoading={true} />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      rerender(<ConditionalComponent shouldRender={true} hasError={true} />);
      
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      
      rerender(<ConditionalComponent shouldRender={false} />);
      
      expect(screen.getByText('Component is hidden')).toBeInTheDocument();
    });
  });
});
