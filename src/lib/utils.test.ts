import { describe, it, expect } from 'vitest';
import { isSafeUrl, escapeHtml } from './utils';

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

describe('escapeHtml', () => {
  it('should return the original string if there are no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('12345')).toBe('12345');
  });

  it('should escape &', () => {
    expect(escapeHtml('Me & You')).toBe('Me &amp; You');
  });

  it('should escape < and >', () => {
    expect(escapeHtml('<div>Test</div>')).toBe('&lt;div&gt;Test&lt;/div&gt;');
  });

  it('should escape double quotes "', () => {
    expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
  });

  it("should escape single quotes '", () => {
    expect(escapeHtml("It's a test")).toBe('It&#039;s a test');
  });

  it('should escape multiple special characters in a single string', () => {
    expect(escapeHtml('<a href="?a=1&b=2">Test\'s</a>')).toBe('&lt;a href=&quot;?a=1&amp;b=2&quot;&gt;Test&#039;s&lt;/a&gt;');
  });

  it('should return an empty string when given an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should return non-string inputs as is', () => {
    expect(escapeHtml(123 as any)).toBe(123);
    expect(escapeHtml(null as any)).toBe(null);
    expect(escapeHtml(undefined as any)).toBe(undefined);
    const obj = { key: 'value' };
    expect(escapeHtml(obj as any)).toBe(obj);
  });
});
