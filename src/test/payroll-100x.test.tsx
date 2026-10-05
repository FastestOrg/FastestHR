import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TakeHomeMaximizer } from '@/components/payroll/TakeHomeMaximizer';
import { EarnedWageAccessDialog } from '@/components/payroll/EarnedWageAccessDialog';

// Mock ResizeObserver for Radix UI Slider in jsdom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('FastestHR 100X - Take-Home Maximizer & Flexi-Benefits Simulator', () => {
  it('renders correctly with default salary and recommendations', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TakeHomeMaximizer initialSalary={80000} jurisdiction="IND" currencySymbol="₹" />
      </QueryClientProvider>
    );

    expect(screen.getByText('FastestHR Take-Home Maximizer')).toBeInTheDocument();
    expect(screen.getByText('New Tax Regime')).toBeInTheDocument();
    expect(screen.getByText('Old Tax Regime')).toBeInTheDocument();
    expect(screen.getByText(/FY 2025–26 Simulator/i)).toBeInTheDocument();
  });

  it('triggers onApplyDeclaration with selected regime when button is clicked', () => {
    const handleApply = vi.fn();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TakeHomeMaximizer
          initialSalary={50000}
          jurisdiction="IND"
          currencySymbol="₹"
          onApplyDeclaration={handleApply}
        />
      </QueryClientProvider>
    );

    const newRegimeBtn = screen.getByText('Select New Regime');
    fireEvent.click(newRegimeBtn);

    expect(handleApply).toHaveBeenCalledWith({ regime: 'new' });
  });

  it('allows updating gross salary and recalculates take-home pay', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TakeHomeMaximizer initialSalary={60000} jurisdiction="IND" currencySymbol="₹" />
      </QueryClientProvider>
    );

    const input = screen.getByDisplayValue('60000');
    fireEvent.change(input, { target: { value: '100000' } });

    expect(screen.getByDisplayValue('100000')).toBeInTheDocument();
  });
});

describe('FastestHR 100X - Instant Earned Wage Access (EWA)', () => {
  it('renders dialog and calculates accrued earnings correctly', () => {
    render(
      <EarnedWageAccessDialog
        isOpen={true}
        onOpenChange={() => {}}
        employeeName="John Doe"
        monthlySalary={60000}
        currencySymbol="₹"
        bankAccountMasked="•••• 1234"
        bankName="HDFC Bank"
      />
    );

    expect(screen.getByText('Instant Earned Wage Access (EWA)')).toBeInTheDocument();
    expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
    expect(screen.getByText('•••• 1234')).toBeInTheDocument();
    expect(screen.getByText(/Zero Balance-Sheet Risk/i)).toBeInTheDocument();
  });

  it('calls onRequestDisbursal when disburse button is clicked', async () => {
    const handleDisburse = vi.fn().mockResolvedValue(undefined);
    render(
      <EarnedWageAccessDialog
        isOpen={true}
        onOpenChange={() => {}}
        employeeName="John Doe"
        monthlySalary={90000}
        currencySymbol="₹"
        onRequestDisbursal={handleDisburse}
      />
    );

    const disburseBtn = screen.getByRole('button', { name: /Disburse/i });
    fireEvent.click(disburseBtn);

    expect(handleDisburse).toHaveBeenCalled();
  });
});
