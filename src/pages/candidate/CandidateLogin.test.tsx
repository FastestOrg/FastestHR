import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import CandidateLogin from './CandidateLogin';
import { expect, test, vi, describe, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('CandidateLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('validates returnTo parameter to prevent open redirect', async () => {
    const user = userEvent.setup();
    // We are simulating an attacker providing an absolute URL
    render(
      <MemoryRouter initialEntries={['/login?returnTo=//evil.com']}>
        <CandidateLogin />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('your@email.com');
    await user.type(emailInput, 'test@example.com');

        const submitButton = screen.getByRole('button', { name: /send magic link/i });
    await user.click(submitButton);

    // Properly await the async state transition to success to avoid overlapping test runs
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: {
        emailRedirectTo: expect.stringMatching(/http:\/\/localhost:3000\/candidate\/portal/i),
      },
    });
  });

  test('allows safe relative returnTo parameter', async () => {
    const user = userEvent.setup();
    // We are simulating a safe relative URL
    render(
      <MemoryRouter initialEntries={['/login?returnTo=/candidate/safe-portal']}>
        <CandidateLogin />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('your@email.com');
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send magic link/i });
    await user.click(submitButton);

    // Properly await the async state transition to success to avoid overlapping test runs
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: {
        emailRedirectTo: expect.stringMatching(/\/candidate\/safe-portal/i),
      },
    });
  });
});
