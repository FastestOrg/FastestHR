import DOMPurify from 'dompurify';

/**
 * Configure DOMPurify hooks to add protection against CSS-based XSS attacks.
 * This is necessary because we allow <style> tags and style attributes
 * in document renderers.
 */
function setupDOMPurifyHooks() {
  if (!DOMPurify.addHook) return;

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style') {
      const content = node.textContent;
      // Block potentially dangerous CSS expressions and URLs
      if (content && /expression|javascript:|vbscript:|data:|@import|behavior:|binding:/i.test(content)) {
        node.textContent = '/* blocked potentially dangerous styles */';
      }
    }
  });

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      const content = data.attrValue;
      // Block potentially dangerous CSS expressions and URLs in inline styles
      if (content && /expression|javascript:|vbscript:|data:|@import|behavior:|binding:/i.test(content)) {
        data.keepAttr = false;
      }
    }
  });
}

// Set up the hooks immediately
if (typeof window !== 'undefined') {
  setupDOMPurifyHooks();
}

/**
 * Sanitizes HTML using DOMPurify with safe defaults.
 */
export function sanitizeHtml(html: string, options?: import('dompurify').Config) {
  if (typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(html, {
      ...options
    });
  }
  // Fallback for non-browser environments if sanitize is not available directly
  // Note: For SSR or server environments, DOMPurify normally requires a JSDOM instance.
  // We fail closed to prevent XSS if DOMPurify is not available.
  console.warn("DOMPurify.sanitize is not available. Returning empty string to fail safe.");
  return '';
}

export default DOMPurify;
