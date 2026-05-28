import { describe, it, expect } from 'vitest';
import { isSafeUrl, getCurrencySymbol, formatAmount } from './utils';

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
  it('should return the correct symbol for known currency codes', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol('CAD')).toBe('C$');
    expect(getCurrencySymbol('AUD')).toBe('A$');
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('should handle case-insensitivity correctly', () => {
    expect(getCurrencySymbol('inr')).toBe('₹');
    expect(getCurrencySymbol('Eur')).toBe('€');
    expect(getCurrencySymbol('gbp')).toBe('£');
  });

  it('should return default symbol "$" for unknown currency codes', () => {
    expect(getCurrencySymbol('XYZ')).toBe('$');
    expect(getCurrencySymbol('UNKNOWN')).toBe('$');
  });

  it('should return default symbol "$" for null, undefined, or empty strings', () => {
    expect(getCurrencySymbol(null)).toBe('$');
    expect(getCurrencySymbol(undefined)).toBe('$');
    expect(getCurrencySymbol('')).toBe('$');
  });
});

describe('formatAmount', () => {
  it('should format regular amounts with USD locale by default', () => {
    expect(formatAmount(1000, 'USD')).toBe('1,000');
    expect(formatAmount(1234567, 'USD')).toBe('1,234,567');
  });

  it('should format amounts with INR locale correctly', () => {
    expect(formatAmount(100000, 'INR')).toBe('1,00,000');
    expect(formatAmount(12345678, 'inr')).toBe('1,23,45,678');
  });

  it('should handle null, undefined, or empty currency codes by defaulting to USD', () => {
    expect(formatAmount(1000, null)).toBe('1,000');
    expect(formatAmount(1000, undefined)).toBe('1,000');
    expect(formatAmount(1000, '')).toBe('1,000');
  });

  it('should handle decimal limits (0-2 fraction digits)', () => {
    expect(formatAmount(1000.5, 'USD')).toBe('1,000.5');
    expect(formatAmount(1000.55, 'USD')).toBe('1,000.55');
    expect(formatAmount(1000.555, 'USD')).toBe('1,000.56'); // Rounds up
    expect(formatAmount(1000.00, 'USD')).toBe('1,000'); // No decimals if not needed
  });

  it('should handle negative numbers and zero', () => {
    expect(formatAmount(0, 'USD')).toBe('0');
    expect(formatAmount(-1000, 'USD')).toBe('-1,000');
    expect(formatAmount(-1000.5, 'USD')).toBe('-1,000.5');
  });
});
