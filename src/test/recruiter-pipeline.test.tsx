import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Recruitment from '@/pages/Recruitment';
import { useAuthStore } from '@/store/auth-store';

vi.mock('@/store/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

describe('Recruitment Navigation for Recruiters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Pipeline tab for users with recruiter platform_role', () => {
    (useAuthStore as any).mockReturnValue({
      profile: {
        id: 'recruiter-123',
        platform_role: 'recruiter',
        company_id: 'comp-123',
        full_name: 'Jane Recruiter',
      },
    });

    render(
      <MemoryRouter initialEntries={['/recruitment/pipeline']}>
        <Recruitment />
      </MemoryRouter>
    );

    // Verify Pipeline tab button is visible
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    // Verify My Leads tab button is also visible
    expect(screen.getByText('My Leads')).toBeInTheDocument();
  });

  it('renders Pipeline tab for company_admin role', () => {
    (useAuthStore as any).mockReturnValue({
      profile: {
        id: 'admin-123',
        platform_role: 'company_admin',
        company_id: 'comp-123',
        full_name: 'Admin User',
      },
    });

    render(
      <MemoryRouter initialEntries={['/recruitment/pipeline']}>
        <Recruitment />
      </MemoryRouter>
    );

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Leads Board')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });
});
