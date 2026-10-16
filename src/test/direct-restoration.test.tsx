import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DirectRestorationDialog } from '@/components/exit/DirectRestorationDialog';
import { supabase } from '@/integrations/supabase/client';

const mockProfile = {
  id: 'admin-1',
  company_id: 'comp-1',
  platform_role: 'company_admin',
};

vi.mock('@/store/auth-store', () => ({
  useAuthStore: () => ({
    profile: mockProfile,
  }),
}));

const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
const mockDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'employees') {
        return {
          update: vi.fn((updates: any) => ({
            eq: mockUpdateEq,
          })),
        };
      }
      if (table === 'employee_exits') {
        return {
          delete: vi.fn(() => ({
            eq: mockDeleteEq,
          })),
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: mockInsert,
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn() })),
      };
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('DirectRestorationDialog - Admin Terminated Employee Restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile.platform_role = 'company_admin';
  });

  const mockEmployee = {
    id: 'emp-99',
    first_name: 'John',
    last_name: 'Doe',
    employee_code: 'EMP-099',
    status: 'terminated',
    deleted_at: '2026-10-10T00:00:00.000Z',
    departments: { name: 'Engineering' },
    work_email: 'john.doe@company.com',
  };

  it('renders employee details and restoration action items correctly', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DirectRestorationDialog
          open={true}
          onOpenChange={vi.fn()}
          employee={mockEmployee}
          exitId="exit-123"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Direct Restoration: Reactivate Employee')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('EMP-099')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/Status Reset to Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Exit & Offboarding Clearance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore to Active Status/i })).toBeInTheDocument();
  });

  it('successfully executes direct restoration by resetting status to active and purging exit lock', async () => {
    const queryClient = createTestQueryClient();
    const handleRestored = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <DirectRestorationDialog
          open={true}
          onOpenChange={handleOpenChange}
          employee={mockEmployee}
          exitId="exit-123"
          onRestored={handleRestored}
        />
      </QueryClientProvider>
    );

    const restoreBtn = screen.getByRole('button', { name: /Restore to Active Status/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('employees');
      expect(supabase.from).toHaveBeenCalledWith('employee_exits');
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'emp-99');
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'exit-123');
      expect(handleOpenChange).toHaveBeenCalledWith(false);
      expect(handleRestored).toHaveBeenCalled();
    });
  });

  it('restricts execution if user lacks admin role', () => {
    mockProfile.platform_role = 'user';
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DirectRestorationDialog
          open={true}
          onOpenChange={vi.fn()}
          employee={mockEmployee}
        />
      </QueryClientProvider>
    );

    expect(
      screen.getByText(/Only Company Administrators and HR Managers can perform direct restoration/i)
    ).toBeInTheDocument();

    const restoreBtn = screen.getByRole('button', { name: /Restore to Active Status/i });
    expect(restoreBtn).toBeDisabled();
  });
});
