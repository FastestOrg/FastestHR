import { describe, it, expect, afterEach } from 'vitest';
import { slugify, getCompanySlugFromHost } from './tenantUtils';

describe('getCompanySlugFromHost', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  const setHostname = (hostname: string) => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname },
      writable: true,
    });
  };

  it('returns null for localhost', () => {
    setHostname('localhost');
    expect(getCompanySlugFromHost()).toBe(null);
  });

  it('returns null for 127.0.0.1', () => {
    setHostname('127.0.0.1');
    expect(getCompanySlugFromHost()).toBe(null);
  });

  it('returns slug for valid fastesthr.com subdomains', () => {
    setHostname('acme.fastesthr.com');
    expect(getCompanySlugFromHost()).toBe('acme');

    setHostname('my-company.fastesthr.com');
    expect(getCompanySlugFromHost()).toBe('my-company');
  });

  it('returns null for reserved fastesthr.com subdomains', () => {
    setHostname('www.fastesthr.com');
    expect(getCompanySlugFromHost()).toBe(null);

    setHostname('app.fastesthr.com');
    expect(getCompanySlugFromHost()).toBe(null);
  });

  it('returns full hostname for custom domains', () => {
    setHostname('careers.acme.com');
    expect(getCompanySlugFromHost()).toBe('careers.acme.com');

    setHostname('jobs.mycompany.io');
    expect(getCompanySlugFromHost()).toBe('jobs.mycompany.io');

    setHostname('acme-jobs.com');
    expect(getCompanySlugFromHost()).toBe('acme-jobs.com');
  });

  it('returns null for Lovable preview domains', () => {
    setHostname('preview.lovable.app');
    expect(getCompanySlugFromHost()).toBe(null);

    setHostname('test.lovableproject.com');
    expect(getCompanySlugFromHost()).toBe(null);
  });
});

describe('slugify', () => {
  it('converts basic text to a slug', () => {
    expect(slugify('My Company')).toBe('my-company');
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('converts to lowercase', () => {
    expect(slugify('UPPERCASE TEXT')).toBe('uppercase-text');
    expect(slugify('MiXeD CaSe')).toBe('mixed-case');
  });

  it('removes special characters', () => {
    expect(slugify('Acme Corp, Inc.')).toBe('acme-corp-inc');
    expect(slugify('Tech @ Solutions #1!')).toBe('tech-solutions-1');
    expect(slugify('Company & Partners')).toBe('company-partners');
  });

  it('handles multiple spaces', () => {
    expect(slugify('Company   With    Spaces')).toBe('company-with-spaces');
  });

  it('handles leading and trailing spaces', () => {
    expect(slugify('  Spaced Out  ')).toBe('spaced-out');
  });

  it('handles multiple dashes', () => {
    expect(slugify('hyphenated--company---name')).toBe('hyphenated-company-name');
  });

  it('handles leading and trailing dashes', () => {
    expect(slugify('--dashed-name--')).toBe('dashed-name');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(slugify('!@#$%^&*()_+')).toBe('');
  });

  it('handles string with spaces and special characters', () => {
    expect(slugify(' ! @ # $ % ^ & * ( ) _ + ')).toBe('');
  });
});
