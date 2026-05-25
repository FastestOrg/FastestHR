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
  it('should return correct symbols for explicitly supported currencies', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol('CAD')).toBe('C$');
    expect(getCurrencySymbol('AUD')).toBe('A$');
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('should be case insensitive', () => {
    expect(getCurrencySymbol('inr')).toBe('₹');
    expect(getCurrencySymbol('Eur')).toBe('€');
  });

  it('should return $ for default/unknown/null/undefined currencies', () => {
    expect(getCurrencySymbol('UNKNOWN')).toBe('$');
    expect(getCurrencySymbol(null)).toBe('$');
    expect(getCurrencySymbol(undefined)).toBe('$');
    expect(getCurrencySymbol('')).toBe('$');
  });
});

describe('formatAmount', () => {
  it('should format using en-IN locale for INR currency', () => {
    // 100000 in Indian format is 1,00,000
    expect(formatAmount(100000, 'INR')).toBe('1,00,000');
  });

  it('should format using en-US locale for other currencies', () => {
    expect(formatAmount(100000, 'USD')).toBe('100,000');
    expect(formatAmount(100000, 'EUR')).toBe('100,000');
  });

  it('should format with 0-2 decimal places correctly', () => {
    expect(formatAmount(1000, 'USD')).toBe('1,000');
    expect(formatAmount(1000.5, 'USD')).toBe('1,000.5');
    expect(formatAmount(1000.55, 'USD')).toBe('1,000.55');
    expect(formatAmount(1000.555, 'USD')).toBe('1,000.56'); // rounds to 2 decimal places
  });

  it('should handle null, undefined, or empty string currency codes by defaulting to USD format', () => {
    expect(formatAmount(100000, null)).toBe('100,000');
    expect(formatAmount(100000, undefined)).toBe('100,000');
    expect(formatAmount(100000, '')).toBe('100,000');
  });

  it('should handle case insensitivity', () => {
    expect(formatAmount(100000, 'inr')).toBe('1,00,000');
    expect(formatAmount(100000, 'Usd')).toBe('100,000');
  });
});

describe('formatCurrency', () => {
  it('should combine the currency symbol and formatted amount', () => {
    expect(formatCurrency(100000, 'INR')).toBe('₹1,00,000');
    expect(formatCurrency(100000, 'USD')).toBe('$100,000');
    expect(formatCurrency(1000.5, 'EUR')).toBe('€1,000.5');
    expect(formatCurrency(1000.555, 'GBP')).toBe('£1,000.56');
  });

  it('should fall back to USD formatting for unknown or empty currency codes', () => {
    expect(formatCurrency(100000, 'UNKNOWN')).toBe('$100,000');
    expect(formatCurrency(100000, null)).toBe('$100,000');
    expect(formatCurrency(100000, undefined)).toBe('$100,000');
    expect(formatCurrency(100000, '')).toBe('$100,000');
  });

  it('should be case insensitive', () => {
    expect(formatCurrency(100000, 'inr')).toBe('₹1,00,000');
  });

  it('should correctly format 0 amounts', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0');
  });

  it('should correctly format negative amounts', () => {
    expect(formatCurrency(-1000.5, 'USD')).toBe('$-1,000.5');
    expect(formatCurrency(-100000, 'INR')).toBe('₹-1,00,000');
  });
});
