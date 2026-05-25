import { describe, it, expect } from 'vitest';
import { isSafeUrl, escapeHtml } from './utils';

describe('escapeHtml', () => {
  it('should return strings without special characters unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('12345')).toBe('12345');
    expect(escapeHtml('')).toBe('');
  });

  it('should escape & characters', () => {
    expect(escapeHtml('salt & pepper')).toBe('salt &amp; pepper');
  });

  it('should escape < and > characters', () => {
    expect(escapeHtml('<div>hello</div>')).toBe('&lt;div&gt;hello&lt;/div&gt;');
  });

  it('should escape " characters', () => {
    expect(escapeHtml('hello "world"')).toBe('hello &quot;world&quot;');
  });

  it('should escape \' characters', () => {
    expect(escapeHtml("hello 'world'")).toBe('hello &#039;world&#039;');
  });

  it('should escape multiple mixed special characters', () => {
    const input = '<script>alert("XSS & \'attack\'")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS &amp; &#039;attack&#039;&quot;)&lt;/script&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('should handle non-string inputs gracefully', () => {
    // @ts-expect-error Testing invalid input type
    expect(escapeHtml(null)).toBe(null);
    // @ts-expect-error Testing invalid input type
    expect(escapeHtml(undefined)).toBe(undefined);
    // @ts-expect-error Testing invalid input type
    expect(escapeHtml(123)).toBe(123);
    // @ts-expect-error Testing invalid input type
    expect(escapeHtml({})).toEqual({});
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
  });
});
