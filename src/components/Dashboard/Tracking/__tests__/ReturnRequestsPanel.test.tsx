/**
 * Tests for the helpdesk pending-return-requests panel.
 *
 * - Lists PENDING requests with driver, order, reason, details, and age.
 * - Approve / Reject hit PATCH /api/admin/return-requests/[id]; rows are
 *   removed optimistically on success and failures surface as toasts (never
 *   the silent console-only pattern).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-hot-toast', () => {
  const toastFn: any = jest.fn();
  toastFn.success = jest.fn();
  toastFn.error = jest.fn();
  return { __esModule: true, default: toastFn };
});

import toast from 'react-hot-toast';
import ReturnRequestsPanel from '../ReturnRequestsPanel';

const mockedToast = toast as jest.Mocked<typeof toast> & jest.Mock;

const pendingRow = {
  id: 'request-1',
  orderNumber: 'CAT-001',
  orderType: 'catering',
  driverId: 'driver-1',
  driverName: 'Test Driver',
  reason: 'VEHICLE_ISSUE',
  details: 'Flat tire',
  requestedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

/** Route fetches: GET list first, then PATCH resolutions. */
const mockFetchSequence = (
  patchResponse: { status: number; body: Record<string, unknown> } | null = null,
) => {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (!init || !init.method || init.method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, requests: [pendingRow] }),
      };
    }
    const { status, body } = patchResponse ?? {
      status: 200,
      body: { success: true, status: 'APPROVED' },
    };
    return { ok: status < 400, status, json: async () => body };
  });
  global.fetch = fetchMock as any;
  return fetchMock;
};

describe('ReturnRequestsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists pending requests with driver, order, reason, and details', async () => {
    mockFetchSequence();
    render(<ReturnRequestsPanel />);

    expect(await screen.findByText('#CAT-001')).toBeInTheDocument();
    expect(screen.getByText('Test Driver')).toBeInTheDocument();
    expect(screen.getByText('Vehicle issue')).toBeInTheDocument();
    expect(screen.getByText(/Flat tire/)).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText(/Pending Return Requests \(1\)/)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is pending', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, requests: [] }),
    })) as any;
    render(<ReturnRequestsPanel />);

    expect(
      await screen.findByText('No pending return requests'),
    ).toBeInTheDocument();
  });

  it('approves a request and removes the row optimistically', async () => {
    const fetchMock = mockFetchSequence({
      status: 200,
      body: { success: true, status: 'APPROVED' },
    });
    render(<ReturnRequestsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.queryByText('#CAT-001')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/return-requests/request-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      }),
    );
    expect(mockedToast.success).toHaveBeenCalledWith(
      expect.stringContaining('Return approved'),
    );
  });

  it('rejects a request via the reject button', async () => {
    const fetchMock = mockFetchSequence({
      status: 200,
      body: { success: true, status: 'REJECTED' },
    });
    render(<ReturnRequestsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /reject/i }));

    await waitFor(() => {
      expect(screen.queryByText('#CAT-001')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/return-requests/request-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject' }),
      }),
    );
    expect(mockedToast.success).toHaveBeenCalledWith(
      expect.stringContaining('rejected'),
    );
  });

  it('explains a VOIDED outcome (order moved on) and still removes the row', async () => {
    mockFetchSequence({
      status: 200,
      body: { success: true, status: 'VOIDED', reason: 'ORDER_ADVANCED' },
    });
    render(<ReturnRequestsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.queryByText('#CAT-001')).not.toBeInTheDocument();
    });
    expect(mockedToast).toHaveBeenCalledWith(
      expect.stringContaining('no longer applies'),
    );
  });

  it('surfaces failures as a toast and keeps the row (no silent console-only errors)', async () => {
    mockFetchSequence({
      status: 409,
      body: { success: false, error: 'This request was already rejected.' },
    });
    render(<ReturnRequestsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        'This request was already rejected.',
      );
    });
    // Row stays — nothing was resolved.
    expect(screen.getByText('#CAT-001')).toBeInTheDocument();
  });
});
