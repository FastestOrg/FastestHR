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

/**
 * Base licensing fee in USD per seat per month.
 */
export const BASE_LICENSE_FEE_USD = 5.0;

/**
 * Standard USD exchange conversion rates.
 * 1 USD = rate * [currency]
 */
export const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 85.0,  // 1 USD = ₹85  -> 5 USD = ₹425/seat/month
  EUR: 0.92,  // 1 USD = €0.92 -> 5 USD = €4.60/seat/month
  GBP: 0.78,  // 1 USD = £0.78 -> 5 USD = £3.90/seat/month
  AED: 3.67,  // 1 USD = 3.67 AED -> 5 USD = 18.35 AED/seat/month
  CAD: 1.36,  // 1 USD = C$1.36 -> 5 USD = C$6.80/seat/month
  AUD: 1.52,  // 1 USD = A$1.52 -> 5 USD = A$7.60/seat/month
  JPY: 155.0, // 1 USD = ¥155  -> 5 USD = ¥775/seat/month
};

/**
 * Converts a USD amount into the target currency using standard exchange rates.
 */
export function convertFromUSD(amountUSD: number, targetCurrency: string | null | undefined): number {
  const code = targetCurrency?.toUpperCase() || 'USD';
  const rate = USD_EXCHANGE_RATES[code] ?? 1.0;
  const converted = amountUSD * rate;
  return code === 'JPY' ? Math.round(converted) : Math.round(converted * 100) / 100;
}

/**
 * Returns the license price per seat per month in the company's base currency.
 * Converted from the base 5 USD fee unless a custom negotiated override is explicitly set.
 */
export function getLicensePrice(
  customPrice?: number | null,
  currencyCode?: string | null
): number {
  const code = (currencyCode || 'USD').toUpperCase();
  const convertedBase = convertFromUSD(BASE_LICENSE_FEE_USD, code);

  // If custom price is null, undefined, legacy placeholder (500), or non-positive, use converted base
  if (customPrice == null || Number(customPrice) <= 0 || Number(customPrice) === 500) {
    return convertedBase;
  }

  // If non-USD company has price equal to 5 (the raw USD base), protect by returning converted base
  if (code !== 'USD' && Number(customPrice) === BASE_LICENSE_FEE_USD) {
    return convertedBase;
  }

  return Number(customPrice);
}


export function getErrorMessage(error: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return defaultMessage;
}
