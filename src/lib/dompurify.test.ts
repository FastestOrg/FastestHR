import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeHtml } from './dompurify';
import DOMPurify from 'dompurify';

describe('sanitizeHtml', () => {
  it('should sanitize basic HTML and strip script tags', () => {
    const dirty = '<div>Hello</div><script>alert(1)</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe('<div>Hello</div>');
  });

  it('should allow basic safe tags and attributes', () => {
    const safeHtml = '<p class="text-red-500">Safe text with <a href="https://example.com">link</a></p>';
    const clean = sanitizeHtml(safeHtml);
    expect(clean).toBe(safeHtml);
  });

  it('should allow basic safe styles by default but strip dangerous ones in style attributes', () => {
    const safeStyle = '<div style="color: red;">Test</div>';
    expect(sanitizeHtml(safeStyle)).toBe(safeStyle);

    const dirtyAttr = '<div style="background: url(javascript:alert(1))">Test</div>';
    const cleanAttr = sanitizeHtml(dirtyAttr);
    // The hook will set data.keepAttr = false or DOMPurify will strip it
    expect(cleanAttr).toBe('<div>Test</div>');

    const expressionAttr = '<div style="width: expression(alert(1))">Test</div>';
    const cleanExpr = sanitizeHtml(expressionAttr);
    expect(cleanExpr).toBe('<div>Test</div>');
  });

  it('should strip dangerous CSS expressions in style tags when allowed', () => {
    // We need to explicitly allow style tags to test the tag hook
    const dirty = '<style>body { background: url("javascript:alert(1)"); }</style><div>Test</div>';
    // Without FORCE_BODY, DOMPurify might put style in head, so we use FORCE_BODY or just check it contains the blocked text
    const clean = sanitizeHtml(dirty, { ADD_TAGS: ['style'], FORCE_BODY: true });

    expect(clean).toContain('/* blocked potentially dangerous styles */');
    expect(clean).not.toContain('javascript:alert');
    expect(clean).toContain('<div>Test</div>');
  });

  it('should allow safe style tags when allowed', () => {
    const safe = '<style>body { color: red; }</style><div>Test</div>';
    const clean = sanitizeHtml(safe, { ADD_TAGS: ['style'], FORCE_BODY: true });

    expect(clean).toContain('body { color: red; }');
    expect(clean).toContain('<div>Test</div>');
  });

  describe('fallback behavior', () => {
    let originalSanitize: typeof DOMPurify.sanitize;

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      originalSanitize = DOMPurify.sanitize;
    });

    afterEach(() => {
      vi.restoreAllMocks();
      // @ts-expect-error Resetting mock
      DOMPurify.sanitize = originalSanitize;
    });

    it('should return empty string when DOMPurify.sanitize is not available', () => {
      // @ts-expect-error Mocking for test
      DOMPurify.sanitize = undefined;

      expect(sanitizeHtml('<div>Test</div>')).toBe('');
      expect(console.warn).toHaveBeenCalledWith("DOMPurify.sanitize is not available. Returning empty string to fail safe.");
    });
  });
});
