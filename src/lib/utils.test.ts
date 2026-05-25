import { describe, it, expect } from 'vitest';
import { getCurrencySymbol } from './utils';

describe('getCurrencySymbol', () => {
  it('returns correct symbol for supported currency codes', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol('CAD')).toBe('C$');
    expect(getCurrencySymbol('AUD')).toBe('A$');
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('handles lowercase currency codes', () => {
    expect(getCurrencySymbol('inr')).toBe('₹');
    expect(getCurrencySymbol('eur')).toBe('€');
    expect(getCurrencySymbol('usd')).toBe('$');
  });

  it('handles null and undefined', () => {
    expect(getCurrencySymbol(null)).toBe('$');
    expect(getCurrencySymbol(undefined)).toBe('$');
  });

  it('returns default symbol ($) for unknown currency codes', () => {
    expect(getCurrencySymbol('XYZ')).toBe('$');
    expect(getCurrencySymbol('BRL')).toBe('$');
  });
});
