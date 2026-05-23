import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates if a URL is safe to use in href attributes to prevent protocol-based XSS attacks.
 * Only allows http:// and https:// URLs.
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getCurrencySymbol(currencyCode: string | null | undefined): string {
  const code = currencyCode?.toUpperCase() || 'USD';
  switch (code) {
    case 'INR': return '₹';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'AED': return 'د.إ';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'USD': return '$';
    default: return '$';
  }
}

export function formatAmount(amount: number, currencyCode: string | null | undefined): string {
  const code = currencyCode?.toUpperCase() || 'USD';
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(amount: number, currencyCode: string | null | undefined): string {
  const code = currencyCode?.toUpperCase() || 'USD';
  return `${getCurrencySymbol(code)}${formatAmount(amount, code)}`;
}

