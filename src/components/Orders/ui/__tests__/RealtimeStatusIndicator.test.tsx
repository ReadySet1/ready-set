/**
 * Unit tests for RealtimeStatusIndicator component
 *
 * Tests the visual indicator showing real-time connection status.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RealtimeStatusIndicator } from '../RealtimeStatusIndicator';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Wifi: ({ className }: { className?: string }) => (
    <span data-testid="wifi-icon" className={className}>wifi</span>
  ),
  WifiOff: ({ className }: { className?: string }) => (
    <span data-testid="wifi-off-icon" className={className}>wifi-off</span>
  ),
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-icon" className={className}>loader</span>
  ),
}));

describe('RealtimeStatusIndicator', () => {
  describe('connected state', () => {
    it('should render "Live" badge when connected', () => {
      render(<RealtimeStatusIndicator isConnected={true} />);

      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('should show pulsing dot indicator when connected', () => {
      const { container } = render(<RealtimeStatusIndicator isConnected={true} />);

      // Check for the pulsing animation class
      const pulsingElement = container.querySelector('.animate-ping');
      expect(pulsingElement).toBeInTheDocument();
    });

    it('should have green styling when connected', () => {
      const { container } = render(<RealtimeStatusIndicator isConnected={true} />);

      // Check for green border and background classes
      const badge = container.querySelector('[class*="border-green"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have correct title attribute when connected', () => {
      render(<RealtimeStatusIndicator isConnected={true} />);

      const badge = screen.getByText('Live').closest('[title]');
      expect(badge).toHaveAttribute('title', 'Real-time updates active');
    });
  });

  describe('connecting state', () => {
    it('should render "Connecting..." when isConnecting is true', () => {
      render(<RealtimeStatusIndicator isConnected={false} isConnecting={true} />);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show loading spinner when connecting', () => {
      render(<RealtimeStatusIndicator isConnected={false} isConnecting={true} />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should have blue styling when connecting', () => {
      const { container } = render(
        <RealtimeStatusIndicator isConnected={false} isConnecting={true} />
      );

      const badge = container.querySelector('[class*="border-blue"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have spinning animation on loader', () => {
      render(<RealtimeStatusIndicator isConnected={false} isConnecting={true} />);

      const loader = screen.getByTestId('loader-icon');
      expect(loader.className).toContain('animate-spin');
    });
  });

  describe('disconnected state (no error)', () => {
    it('should render "Offline" badge when not connected', () => {
      render(<RealtimeStatusIndicator isConnected={false} />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should show WifiOff icon when disconnected', () => {
      render(<RealtimeStatusIndicator isConnected={false} />);

      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });

    it('should have gray styling when disconnected (no error)', () => {
      const { container } = render(<RealtimeStatusIndicator isConnected={false} />);

      const badge = container.querySelector('[class*="border-gray"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have clickable cursor when disconnected', () => {
      const { container } = render(<RealtimeStatusIndicator isConnected={false} />);

      const badge = container.querySelector('[class*="cursor-pointer"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have correct title attribute when disconnected', () => {
      render(<RealtimeStatusIndicator isConnected={false} />);

      const badge = screen.getByText('Offline').closest('[title]');
      expect(badge).toHaveAttribute('title', 'Click to connect');
    });
  });

  describe('error state', () => {
    it('should render "Offline" badge when there is an error', () => {
      render(<RealtimeStatusIndicator isConnected={false} error="Connection failed" />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should have red styling when there is an error', () => {
      const { container } = render(
        <RealtimeStatusIndicator isConnected={false} error="Connection failed" />
      );

      const badge = container.querySelector('[class*="border-red"]');
      expect(badge).toBeInTheDocument();
    });

    it('should include error message in title attribute', () => {
      render(<RealtimeStatusIndicator isConnected={false} error="Connection failed" />);

      const badge = screen.getByText('Offline').closest('[title]');
      expect(badge).toHaveAttribute(
        'title',
        'Error: Connection failed. Click to reconnect.'
      );
    });

    it('should show WifiOff icon when there is an error', () => {
      render(<RealtimeStatusIndicator isConnected={false} error="Connection failed" />);

      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });
  });

  describe('onReconnect callback', () => {
    it('should call onReconnect when clicking offline badge', () => {
      const onReconnect = jest.fn();

      render(
        <RealtimeStatusIndicator
          isConnected={false}
          onReconnect={onReconnect}
        />
      );

      const badge = screen.getByText('Offline');
      fireEvent.click(badge);

      expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    it('should call onReconnect when clicking error badge', () => {
      const onReconnect = jest.fn();

      render(
        <RealtimeStatusIndicator
          isConnected={false}
          error="Connection failed"
          onReconnect={onReconnect}
        />
      );

      const badge = screen.getByText('Offline');
      fireEvent.click(badge);

      expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    it('should not be clickable when connected', () => {
      const onReconnect = jest.fn();

      render(
        <RealtimeStatusIndicator
          isConnected={true}
          onReconnect={onReconnect}
        />
      );

      const badge = screen.getByText('Live');
      fireEvent.click(badge);

      // Connected badge should not have onClick handler
      expect(onReconnect).not.toHaveBeenCalled();
    });

    it('should not be clickable when connecting', () => {
      const onReconnect = jest.fn();

      render(
        <RealtimeStatusIndicator
          isConnected={false}
          isConnecting={true}
          onReconnect={onReconnect}
        />
      );

      const badge = screen.getByText('Connecting...');
      fireEvent.click(badge);

      // Connecting badge should not have onClick handler
      expect(onReconnect).not.toHaveBeenCalled();
    });
  });

  describe('size variants', () => {
    it('should apply small size classes by default', () => {
      const { container } = render(<RealtimeStatusIndicator isConnected={true} />);

      const badge = container.querySelector('[class*="text-xs"]');
      expect(badge).toBeInTheDocument();
    });

    it('should apply small size classes when size="sm"', () => {
      const { container } = render(
        <RealtimeStatusIndicator isConnected={true} size="sm" />
      );

      const badge = container.querySelector('[class*="text-xs"]');
      expect(badge).toBeInTheDocument();
    });

    it('should apply medium size classes when size="md"', () => {
      const { container } = render(
        <RealtimeStatusIndicator isConnected={true} size="md" />
      );

      const badge = container.querySelector('[class*="text-sm"]');
      expect(badge).toBeInTheDocument();
    });

    it('should use smaller icon for sm size', () => {
      render(<RealtimeStatusIndicator isConnected={false} size="sm" />);

      const icon = screen.getByTestId('wifi-off-icon');
      expect(icon.className).toContain('h-3');
      expect(icon.className).toContain('w-3');
    });

    it('should use larger icon for md size', () => {
      render(<RealtimeStatusIndicator isConnected={false} size="md" />);

      const icon = screen.getByTestId('wifi-off-icon');
      expect(icon.className).toContain('h-4');
      expect(icon.className).toContain('w-4');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <RealtimeStatusIndicator isConnected={true} className="my-custom-class" />
      );

      const badge = container.querySelector('.my-custom-class');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('state priority', () => {
    it('should show connecting state even if isConnected is true', () => {
      // This tests the order of conditionals - isConnecting takes priority
      render(
        <RealtimeStatusIndicator isConnected={true} isConnecting={true} />
      );

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show error state over disconnected state', () => {
      render(
        <RealtimeStatusIndicator isConnected={false} error="Some error" />
      );

      // Error state should have red styling
      const { container } = render(
        <RealtimeStatusIndicator isConnected={false} error="Some error" />
      );

      const badge = container.querySelector('[class*="border-red"]');
      expect(badge).toBeInTheDocument();
    });
  });
});
