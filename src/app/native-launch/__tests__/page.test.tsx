/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import NativeLaunchPage from '../page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockGetSession = jest.fn();
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

const SIGN_IN_DESTINATION = '/sign-in?returnTo=%2Fdriver';

describe('NativeLaunchPage (/native-launch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state while the session is being resolved', () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NativeLaunchPage />);

    expect(screen.getByText(/Loading Ready Set/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('routes to /driver when a session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    render(<NativeLaunchPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/driver');
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('routes to sign-in with a returnTo when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<NativeLaunchPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(SIGN_IN_DESTINATION);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  describe('?next= (post-sign-in hand-off)', () => {
    const withSession = () =>
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

    afterEach(() => {
      window.history.replaceState(null, '', '/');
    });

    it('routes a signed-in user to a same-origin next path', async () => {
      window.history.replaceState(null, '', '/native-launch?next=%2Fforce-password-change');
      withSession();
      render(<NativeLaunchPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/force-password-change');
      });
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it.each(['//evil.example', 'https://evil.example', '/\\evil.example'])(
      'ignores an off-site next %p and routes to /driver',
      async (next) => {
        window.history.replaceState(
          null,
          '',
          `/native-launch?next=${encodeURIComponent(next)}`,
        );
        withSession();
        render(<NativeLaunchPage />);

        await waitFor(() => {
          expect(mockReplace).toHaveBeenCalledWith('/driver');
        });
      },
    );

    it('still sends a signed-out user to sign-in', async () => {
      window.history.replaceState(null, '', '/native-launch?next=%2Fforce-password-change');
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      render(<NativeLaunchPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(SIGN_IN_DESTINATION);
      });
    });
  });

  it('falls back to sign-in when getSession rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('network down'));
    render(<NativeLaunchPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(SIGN_IN_DESTINATION);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
