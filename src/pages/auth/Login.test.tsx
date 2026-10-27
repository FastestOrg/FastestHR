import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

const { mockSetSession, mockSetUser, mockFetchProfile, mockNavigate } = vi.hoisted(() => ({
  mockSetSession: vi.fn(),
  mockSetUser: vi.fn(),
  mockFetchProfile: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/store/auth-store', () => {
  const state = {
    user: null,
    session: null,
    profile: null,
    setSession: mockSetSession,
    setUser: mockSetUser,
    fetchProfile: mockFetchProfile,
  };
  const fn = vi.fn(() => state);
  (fn as any).getState = () => state;
  return { useAuthStore: fn };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Page Email Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  test('displays unverified email alert and allows resending when login returns email not confirmed', async () => {
    const user = userEvent.setup();

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        name: 'AuthApiError',
        message: 'Email not confirmed',
        status: 400,
      } as any,
    });

    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'unverified@company.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPassword123!' } });
    await user.click(submitBtn);

    // Verify unverified alert appears
    expect(await screen.findByText(/email verification required/i)).toBeInTheDocument();
    expect(screen.getByText(/unverified@company.com/)).toBeInTheDocument();

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
    expect(resendBtn).toBeInTheDocument();

    // Click resend
    await user.click(resendBtn);

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'unverified@company.com',
      options: {
        emailRedirectTo: expect.stringContaining('/dashboard'),
      },
    });

    // Button should show cooldown
    await waitFor(() => {
      expect(screen.getByText(/resend in \d+s/i)).toBeInTheDocument();
    });
  }, 15000);

  test('provides link to /verify-email in the footer', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );

    const resendLink = screen.getByRole('link', { name: /resend email/i });
    expect(resendLink).toBeInTheDocument();
    expect(resendLink.getAttribute('href')).toContain('/verify-email');
  });

  test('synchronizes auth store and navigates to /admin when super_admin logs in', async () => {
    const user = userEvent.setup();
    const fakeUser = { id: 'super-admin-uuid', email: 'admin@fastesthr.com' };
    const fakeSession = { user: fakeUser, access_token: 'fake-token' };

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: fakeUser as any, session: fakeSession as any },
      error: null,
    });

    mockFetchProfile.mockResolvedValueOnce({
      id: 'super-admin-uuid',
      platform_role: 'super_admin',
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'admin@fastesthr.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SuperSecret123!' } });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(fakeSession);
      expect(mockSetUser).toHaveBeenCalledWith(fakeUser);
      expect(mockFetchProfile).toHaveBeenCalledWith('super-admin-uuid');
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  test('synchronizes auth store and navigates to /dashboard when company_admin logs in', async () => {
    const user = userEvent.setup();
    const fakeUser = { id: 'company-admin-uuid', email: 'company@example.com' };
    const fakeSession = { user: fakeUser, access_token: 'fake-token' };

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: fakeUser as any, session: fakeSession as any },
      error: null,
    });

    mockFetchProfile.mockResolvedValueOnce({
      id: 'company-admin-uuid',
      platform_role: 'company_admin',
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'company@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPassword123!' } });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(fakeSession);
      expect(mockSetUser).toHaveBeenCalledWith(fakeUser);
      expect(mockFetchProfile).toHaveBeenCalledWith('company-admin-uuid');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
