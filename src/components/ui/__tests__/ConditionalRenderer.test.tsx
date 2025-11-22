import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Generic conditional renderer component for testing conditional logic patterns
interface ConditionalRendererProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  delay?: number;
}

const ConditionalRenderer: React.FC<ConditionalRendererProps> = ({
  condition,
  children,
  fallback = null,
  loading = false,
  error = null,
  delay = 0,
}) => {
  const [isReady, setIsReady] = React.useState(delay === 0);

  React.useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [delay]);

  if (!isReady) {
    return <div data-testid="loading-delay">Loading...</div>;
  }

  if (error) {
    return <div data-testid="error-state">Error: {error}</div>;
  }

  if (loading) {
    return <div data-testid="loading-state">Loading...</div>;
  }

  if (condition) {
    return <div data-testid="condition-true">{children}</div>;
  }

  return <div data-testid="condition-false">{fallback}</div>;
};

// Test component that uses conditional rendering patterns similar to removed banners
interface TestBannerProps {
  isVisible: boolean;
  hasError?: boolean;
  isLoading?: boolean;
  autoShow?: boolean;
  showDelay?: number;
}

const TestBanner: React.FC<TestBannerProps> = ({
  isVisible: initialVisible,
  hasError = false,
  isLoading = false,
  autoShow = false,
  showDelay = 0,
}) => {
  const [isVisible, setIsVisible] = React.useState(initialVisible);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setIsVisible(initialVisible);
  }, [initialVisible]);
  
  React.useEffect(() => {
    if (autoShow && showDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, showDelay);

      return () => clearTimeout(timer);
    }
  }, [autoShow, showDelay]);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!mounted) {
    return null;
  }

  return (
    <ConditionalRenderer
      condition={isVisible}
      loading={isLoading}
      error={hasError ? 'Something went wrong' : null}
      fallback={<div data-testid="banner-hidden">Banner is hidden</div>}
    >
      <div data-testid="banner-content">
        <h2>Test Banner</h2>
        <p>This is a test banner with conditional rendering</p>
        <button data-testid="close-button" onClick={handleClose}>
          Close
        </button>
      </div>
    </ConditionalRenderer>
  );
};

describe('Conditional Rendering Logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('ConditionalRenderer Component', () => {
    it('renders children when condition is true', () => {
      render(
        <ConditionalRenderer condition={true}>
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('renders fallback when condition is false', () => {
      render(
        <ConditionalRenderer 
          condition={false} 
          fallback={<span data-testid="fallback-content">Fallback</span>}
        >
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-false')).toBeInTheDocument();
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });

    it('renders loading state when loading is true', () => {
      render(
        <ConditionalRenderer condition={true} loading={true}>
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });

    it('renders error state when error is provided', () => {
      render(
        <ConditionalRenderer condition={true} error="Test error">
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Error: Test error')).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });

    it('handles delay rendering correctly', async () => {
      render(
        <ConditionalRenderer condition={true} delay={1000}>
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      // Should show loading initially
      expect(screen.getByTestId('loading-delay')).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should show content after delay
      await waitFor(() => {
        expect(screen.getByTestId('condition-true')).toBeInTheDocument();
        expect(screen.getByTestId('test-content')).toBeInTheDocument();
      });
    });

    it('prioritizes error over loading state', () => {
      render(
        <ConditionalRenderer condition={true} loading={true} error="Test error">
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    it('prioritizes loading over condition', () => {
      render(
        <ConditionalRenderer condition={true} loading={true}>
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.queryByTestId('condition-true')).not.toBeInTheDocument();
    });

    it('cleans up timers on unmount', () => {
      const { unmount } = render(
        <ConditionalRenderer condition={true} delay={1000}>
          <span data-testid="test-content">Test Content</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('loading-delay')).toBeInTheDocument();

      unmount();

      // Fast-forward time after unmount
      jest.advanceTimersByTime(1000);

      // Should not cause any issues
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  describe('TestBanner Component', () => {
    it('renders banner when initially visible', () => {
      render(<TestBanner isVisible={true} />);

      expect(screen.getByTestId('banner-content')).toBeInTheDocument();
      expect(screen.getByText('Test Banner')).toBeInTheDocument();
    });

    it('does not render banner when initially hidden', () => {
      render(<TestBanner isVisible={false} />);

      expect(screen.getByTestId('banner-hidden')).toBeInTheDocument();
      expect(screen.queryByTestId('banner-content')).not.toBeInTheDocument();
    });

    it('shows loading state when loading', () => {
      render(<TestBanner isVisible={true} isLoading={true} />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.queryByTestId('banner-content')).not.toBeInTheDocument();
    });

    it('shows error state when has error', () => {
      render(<TestBanner isVisible={true} hasError={true} />);

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
    });

    it('handles auto-show with delay', async () => {
      render(<TestBanner isVisible={false} autoShow={true} showDelay={1000} />);

      // Should be hidden initially
      expect(screen.getByTestId('banner-hidden')).toBeInTheDocument();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should show banner after delay
      await waitFor(() => {
        expect(screen.getByTestId('banner-content')).toBeInTheDocument();
      });
    });

    it('allows closing the banner', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TestBanner isVisible={true} />);

      expect(screen.getByTestId('banner-content')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId('banner-hidden')).toBeInTheDocument();
        expect(screen.queryByTestId('banner-content')).not.toBeInTheDocument();
      });
    });

    it('does not render before mounting (SSR safety)', () => {
      // Mock useState to return false for mounted initially
      const originalUseState = React.useState;
      let callCount = 0;
      
      jest.spyOn(React, 'useState').mockImplementation((initial) => {
        callCount++;
        if (callCount === 2) { // Second useState call is for mounted
          return [false, jest.fn()]; // Return false for mounted
        }
        return originalUseState(initial);
      });

      render(<TestBanner isVisible={true} />);

      expect(screen.queryByTestId('banner-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('banner-hidden')).not.toBeInTheDocument();

      React.useState.mockRestore();
    });

    it('handles multiple state changes correctly', async () => {
      const { rerender } = render(<TestBanner isVisible={false} />);

      // Initially hidden
      expect(screen.getByTestId('banner-hidden')).toBeInTheDocument();

      // Show banner
      rerender(<TestBanner isVisible={true} />);
      await waitFor(() => {
        expect(screen.getByTestId('banner-content')).toBeInTheDocument();
      });

      // Show loading
      rerender(<TestBanner isVisible={true} isLoading={true} />);
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Show error
      rerender(<TestBanner isVisible={true} hasError={true} />);
      expect(screen.getByTestId('error-state')).toBeInTheDocument();

      // Back to normal
      rerender(<TestBanner isVisible={true} />);
      await waitFor(() => {
        expect(screen.getByTestId('banner-content')).toBeInTheDocument();
      });
    });

    it('cleans up auto-show timer on unmount', () => {
      const { unmount } = render(
        <TestBanner isVisible={false} autoShow={true} showDelay={1000} />
      );

      expect(screen.getByTestId('banner-hidden')).toBeInTheDocument();

      unmount();

      // Fast-forward time after unmount
      jest.advanceTimersByTime(1000);

      // Should not cause any issues
      expect(screen.queryByTestId('banner-content')).not.toBeInTheDocument();
    });
  });

  describe('Complex Conditional Scenarios', () => {
    it('handles nested conditional rendering', () => {
      const NestedComponent = ({ level1, level2 }: { level1: boolean; level2: boolean }) => (
        <ConditionalRenderer condition={level1}>
          <ConditionalRenderer condition={level2}>
            <span data-testid="nested-content">Nested Content</span>
          </ConditionalRenderer>
        </ConditionalRenderer>
      );

      // Both true
      const { rerender } = render(<NestedComponent level1={true} level2={true} />);
      expect(screen.getByTestId('nested-content')).toBeInTheDocument();

      // First false
      rerender(<NestedComponent level1={false} level2={true} />);
      expect(screen.queryByTestId('nested-content')).not.toBeInTheDocument();

      // Second false
      rerender(<NestedComponent level1={true} level2={false} />);
      expect(screen.queryByTestId('nested-content')).not.toBeInTheDocument();
    });

    it('handles conditional rendering with multiple children', () => {
      render(
        <ConditionalRenderer condition={true}>
          <span data-testid="child-1">Child 1</span>
          <span data-testid="child-2">Child 2</span>
          <span data-testid="child-3">Child 3</span>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    it('handles conditional rendering with fragments', () => {
      render(
        <ConditionalRenderer condition={true}>
          <>
            <span data-testid="fragment-child-1">Fragment Child 1</span>
            <span data-testid="fragment-child-2">Fragment Child 2</span>
          </>
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('fragment-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-child-2')).toBeInTheDocument();
    });

    it('handles rapid condition changes', async () => {
      const RapidChangeComponent = () => {
        const [condition, setCondition] = React.useState(false);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCondition(prev => !prev);
          }, 100);

          return () => clearInterval(interval);
        }, []);

        return (
          <ConditionalRenderer condition={condition}>
            <span data-testid="rapid-content">Rapid Content</span>
          </ConditionalRenderer>
        );
      };

      render(<RapidChangeComponent />);

      // Should start with condition false
      expect(screen.getByTestId('condition-false')).toBeInTheDocument();

      // Fast-forward through several cycles
      act(() => {
        jest.advanceTimersByTime(250); // 2.5 cycles
      });

      // Should handle rapid changes without issues
      await waitFor(() => {
        expect(screen.getByTestId('condition-true')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Memory', () => {
    it('does not cause memory leaks with timers', () => {
      const components = [];
      
      // Create multiple components with timers
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <ConditionalRenderer condition={true} delay={1000}>
            <span>Content {i}</span>
          </ConditionalRenderer>
        );
        components.push(unmount);
      }

      // Unmount all components
      components.forEach(unmount => unmount());

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Should not cause any issues
      expect(screen.queryByText(/Content/)).not.toBeInTheDocument();
    });

    it('handles frequent re-renders efficiently', () => {
      const { rerender } = render(
        <ConditionalRenderer condition={true}>
          <span data-testid="perf-content">Content</span>
        </ConditionalRenderer>
      );

      // Re-render many times
      for (let i = 0; i < 100; i++) {
        rerender(
          <ConditionalRenderer condition={i % 2 === 0}>
            <span data-testid="perf-content">Content {i}</span>
          </ConditionalRenderer>
        );
      }

      // Should still work correctly
      expect(screen.getByTestId('condition-false')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles null children gracefully', () => {
      render(
        <ConditionalRenderer condition={true}>
          {null}
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
    });

    it('handles undefined children gracefully', () => {
      render(
        <ConditionalRenderer condition={true}>
          {undefined}
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
    });

    it('handles empty string children', () => {
      render(
        <ConditionalRenderer condition={true}>
          {''}
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
    });

    it('handles zero as children', () => {
      render(
        <ConditionalRenderer condition={true}>
          {0}
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles boolean children', () => {
      render(
        <ConditionalRenderer condition={true}>
          {true}
        </ConditionalRenderer>
      );

      expect(screen.getByTestId('condition-true')).toBeInTheDocument();
    });
  });
});
