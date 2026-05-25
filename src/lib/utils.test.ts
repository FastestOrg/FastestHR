import { describe, it, expect } from 'vitest';
import { isSafeUrl, getCurrencySymbol, formatAmount, formatCurrency } from './utils';

describe('isSafeUrl', () => {
  it('should return true for valid http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('http://localhost:3000')).toBe(true);
  });

  it('should return true for valid https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('https://google.com/path?query=1')).toBe(true);
  });

  it('should handle uppercase protocols correctly', () => {
    expect(isSafeUrl('HTTP://example.com')).toBe(true);
    expect(isSafeUrl('HTTPS://example.com')).toBe(true);
  });

  it('should return false for unsafe protocols', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<h1>Hello</h1>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox("hello")')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('mailto:test@example.com')).toBe(false);
    expect(isSafeUrl('tel:+1234567890')).toBe(false);
  });

  it('should return false for falsy values', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
  });

  it('should return false for invalid URLs that throw when parsed', () => {
    expect(isSafeUrl('not-a-url')).toBe(false);
    expect(isSafeUrl('://missing-protocol')).toBe(false);
    expect(isSafeUrl('//protocol-relative.com')).toBe(false);
  });
});

describe('getCurrencySymbol', () => {
  it('should return correct symbols for known currencies', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol('CAD')).toBe('C$');
    expect(getCurrencySymbol('AUD')).toBe('A$');
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('should handle lowercase currency codes', () => {
    expect(getCurrencySymbol('inr')).toBe('₹');
    expect(getCurrencySymbol('eur')).toBe('€');
  });

  it('should return $ for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('$');
  });

  it('should return $ for missing or falsy inputs', () => {
    expect(getCurrencySymbol(null)).toBe('$');
    expect(getCurrencySymbol(undefined)).toBe('$');
    expect(getCurrencySymbol('')).toBe('$');
  });
});

describe('formatAmount', () => {
  it('should format USD amounts correctly', () => {
    expect(formatAmount(1000, 'USD')).toBe('1,000');
    expect(formatAmount(1000.5, 'USD')).toBe('1,000.5');
    expect(formatAmount(1000.55, 'USD')).toBe('1,000.55');
    expect(formatAmount(1000.556, 'USD')).toBe('1,000.56'); // Should round
  });

  it('should format INR amounts correctly', () => {
    expect(formatAmount(100000, 'INR')).toBe('1,00,000');
    expect(formatAmount(100000.5, 'INR')).toBe('1,00,000.5');
  });

  it('should format lowercase currency codes correctly', () => {
    expect(formatAmount(100000, 'inr')).toBe('1,00,000');
  });

  it('should default to USD formatting for unknown or missing currencies', () => {
    expect(formatAmount(100000, 'XYZ')).toBe('100,000');
    expect(formatAmount(100000, null)).toBe('100,000');
    expect(formatAmount(100000, undefined)).toBe('100,000');
    expect(formatAmount(100000, '')).toBe('100,000');
  });
});

describe('formatCurrency', () => {
  it('should format USD amounts with symbol correctly', () => {
    expect(formatCurrency(1000, 'USD')).toBe('$1,000');
    expect(formatCurrency(1000.55, 'USD')).toBe('$1,000.55');
  });

  it('should format INR amounts with symbol correctly', () => {
    expect(formatCurrency(100000, 'INR')).toBe('₹1,00,000');
    expect(formatCurrency(100000.5, 'INR')).toBe('₹1,00,000.5');
  });

  it('should format other known currencies correctly', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€1,000');
    expect(formatCurrency(1000, 'GBP')).toBe('£1,000');
    expect(formatCurrency(1000, 'JPY')).toBe('¥1,000');
  });

  it('should handle lowercase currency codes', () => {
    expect(formatCurrency(100000, 'inr')).toBe('₹1,00,000');
    expect(formatCurrency(1000, 'eur')).toBe('€1,000');
  });

  it('should default to USD and $ for unknown or missing currencies', () => {
    expect(formatCurrency(100000, 'XYZ')).toBe('$100,000');
    expect(formatCurrency(100000, null)).toBe('$100,000');
    expect(formatCurrency(100000, undefined)).toBe('$100,000');
    expect(formatCurrency(100000, '')).toBe('$100,000');
  });
});
