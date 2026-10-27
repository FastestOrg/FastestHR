import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from './VerifyEmail';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
  })),
}));

describe('VerifyEmail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  test('renders email passed via query parameters', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?email=admin%40company.com']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    expect(screen.getByText('admin@company.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
  });

  test('renders Gmail shortcut when email domain is gmail.com', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?email=test%40gmail.com']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /open gmail/i })).toBeInTheDocument();
  });

  test('calls supabase.auth.resend when Resend button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/verify-email?email=hr%40startup.io']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
    await user.click(resendBtn);

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'hr@startup.io',
      options: {
        emailRedirectTo: expect.stringContaining('/dashboard'),
      },
    });

    // After sending, should show success notice or cooldown timer
    await waitFor(() => {
      expect(screen.getByText(/fresh verification email has been dispatched/i)).toBeInTheDocument();
    });
  });

  test('allows editing email if user entered wrong email address', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/verify-email?email=typo%40company.com']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    const editBtn = screen.getByTitle('Change email');
    await user.click(editBtn);

    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'correct@company.com');

    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    const submitBtn = screen.getByRole('button', { name: /send verification link/i });
    await user.click(submitBtn);

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'correct@company.com',
      options: {
        emailRedirectTo: expect.stringContaining('/dashboard'),
      },
    });
  });

  test('shows input form if no email is provided in URL or storage', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();

    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    await user.type(input, 'founder@company.co');
    await user.click(screen.getByRole('button', { name: /send verification link/i }));

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'founder@company.co',
      options: {
        emailRedirectTo: expect.stringContaining('/dashboard'),
      },
    });
  });
});
