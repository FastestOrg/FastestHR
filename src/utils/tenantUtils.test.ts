import { describe, it, expect } from 'vitest';
import { slugify } from './tenantUtils';

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
