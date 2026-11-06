/**
 * The in-app explanation shown inside the native driver wrapper when background
 * location can't start (card android-location-prompt-every-run). It replaces the
 * old behavior of silently dumping the driver into Settings.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockResolve = jest.fn();
const mockRetry = jest.fn();

jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  resolveNativeLocationIssue: (...args: unknown[]) => mockResolve(...args),
  retryNativeShiftTracking: (...args: unknown[]) => mockRetry(...args),
}));

import { NativeLocationPrompt } from '../NativeLocationPrompt';
import {
  setNativeLocationIssue,
  type NativeLocationIssue,
} from '@/lib/tracking/native-location-issue';

function showIssue(issue: NativeLocationIssue | null) {
  act(() => setNativeLocationIssue(issue));
}

function fireVisible() {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('NativeLocationPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue(undefined);
    mockRetry.mockResolvedValue(undefined);
    act(() => setNativeLocationIssue(null));
  });

  it('renders nothing while location is ready', () => {
    render(<NativeLocationPrompt />);
    expect(screen.queryByTestId('alert-dialog-content')).not.toBeInTheDocument();
  });

  it('explains a first-time grant and steers away from "Only this time"', () => {
    render(<NativeLocationPrompt />);
    showIssue('permission-needed');

    expect(screen.getByTestId('alert-dialog-content')).toBeInTheDocument();
    expect(screen.getByText(/while using the app/i)).toBeInTheDocument();
    expect(screen.getByText(/only this time/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('tells the driver why it asked again after an "Only this time" grant', () => {
    render(<NativeLocationPrompt />);
    showIssue('permission-expired');

    expect(screen.getByText(/only this time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('points a blocked permission at the app settings with one button', () => {
    render(<NativeLocationPrompt />);
    showIssue('permission-blocked');

    expect(screen.getByText(/allow all the time/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /open settings/i });
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(button);
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });

  it('tells the driver to turn on the phone Location toggle when it is off', () => {
    render(<NativeLocationPrompt />);
    showIssue('location-off');

    expect(screen.getByText(/turn on your phone's location/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /try again/i });

    fireEvent.click(button);
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });

  it('re-checks when the driver comes back from Settings', () => {
    render(<NativeLocationPrompt />);
    showIssue('permission-blocked');

    fireVisible();
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('does not re-check on resume when nothing is wrong', () => {
    render(<NativeLocationPrompt />);
    fireVisible();
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it('closes once the issue is resolved', () => {
    render(<NativeLocationPrompt />);
    showIssue('location-off');
    expect(screen.getByTestId('alert-dialog-content')).toBeInTheDocument();

    showIssue(null);
    expect(screen.queryByTestId('alert-dialog-content')).not.toBeInTheDocument();
  });
});
