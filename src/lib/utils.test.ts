import { describe, it, expect } from 'vitest';
import { isSafeUrl, getCurrencySymbol, escapeHtml } from './utils';

describe('escapeHtml', () => {
  it('should escape & to &amp;', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape < to &lt;', () => {
    expect(escapeHtml('foo < bar')).toBe('foo &lt; bar');
  });

  it('should escape > to &gt;', () => {
    expect(escapeHtml('foo > bar')).toBe('foo &gt; bar');
  });

  it('should escape " to &quot;', () => {
    expect(escapeHtml('foo " bar')).toBe('foo &quot; bar');
  });

  it('should escape \' to &#039;', () => {
    expect(escapeHtml("foo ' bar")).toBe('foo &#039; bar');
  });

  it('should escape multiple special characters', () => {
    expect(escapeHtml('<script>alert("XSS & \'")</script>')).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#039;&quot;)&lt;/script&gt;');
  });

  it('should not change strings without special characters', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('should return non-string inputs unchanged', () => {
    // @ts-expect-error Testing invalid input types
    expect(escapeHtml(null)).toBe(null);
    // @ts-expect-error Testing invalid input types
    expect(escapeHtml(undefined)).toBe(undefined);
    // @ts-expect-error Testing invalid input types
    expect(escapeHtml(123)).toBe(123);
    const obj = { a: 1 };
    // @ts-expect-error Testing invalid input types
    expect(escapeHtml(obj)).toBe(obj);
  });
});

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
    // Specifically test the catch block by providing a malformed URL
    expect(isSafeUrl('http://[::1')).toBe(false);
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
