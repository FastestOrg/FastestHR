import { describe, it, expect } from 'vitest';
import { substituteVariables } from '@/lib/template-utils';

describe('substituteVariables', () => {
  it('should replace plain keys with {{key}} format', () => {
    const template = 'Hello {{name}}!';
    const variables = { name: 'Alice' };
    expect(substituteVariables(template, variables)).toBe('Hello Alice!');
  });

  it('should replace plain keys with [key] format', () => {
    const template = 'Hello [name]!';
    const variables = { name: 'Bob' };
    expect(substituteVariables(template, variables)).toBe('Hello Bob!');
  });

  it('should replace both formats when using plain keys', () => {
    const template = 'Hello {{name}} and [name]!';
    const variables = { name: 'Charlie' };
    expect(substituteVariables(template, variables)).toBe('Hello Charlie and Charlie!');
  });

  it('should replace variables when the key already has {{}} delimiters', () => {
    const template = 'Hello {{name}}!';
    const variables = { '{{name}}': 'Dave' };
    expect(substituteVariables(template, variables)).toBe('Hello Dave!');
  });

  it('should replace variables when the key already has [] delimiters', () => {
    const template = 'Hello [name]!';
    const variables = { '[name]': 'Eve' };
    expect(substituteVariables(template, variables)).toBe('Hello Eve!');
  });

  it('should replace multiple variables in the same template', () => {
    const template = 'Dear {{firstName}} [lastName], your role is {{role}}';
    const variables = { firstName: 'Jane', lastName: 'Doe', role: 'Developer' };
    expect(substituteVariables(template, variables)).toBe('Dear Jane Doe, your role is Developer');
  });

  it('should replace the same variable multiple times', () => {
    const template = '{{name}} {{name}} [name]';
    const variables = { name: 'Echo' };
    expect(substituteVariables(template, variables)).toBe('Echo Echo Echo');
  });

  it('should escape HTML characters in the values', () => {
    const template = 'Content: {{code}}';
    const variables = { code: '<script>alert("XSS") & \'test\'</script>' };
    const expected = 'Content: &lt;script&gt;alert(&quot;XSS&quot;) &amp; &#039;test&#039;&lt;/script&gt;';
    expect(substituteVariables(template, variables)).toBe(expected);
  });

  it('should handle keys with special regex characters', () => {
    const template = 'Value: {{user.name}} and [user$id] and {{user(group)}}';
    const variables = {
      'user.name': 'Frank',
      'user$id': '123',
      'user(group)': 'Admin'
    };
    expect(substituteVariables(template, variables)).toBe('Value: Frank and 123 and Admin');
  });

  it('should handle variables with delimiter formats that have special regex characters', () => {
    const template = 'Value: {{user.name}} and [user$id]';
    const variables = {
      '{{user.name}}': 'Grace',
      '[user$id]': '456'
    };
    expect(substituteVariables(template, variables)).toBe('Value: Grace and 456');
  });

  it('should leave missing variables untouched', () => {
    const template = 'Hello {{name}}, your score is {{score}}!';
    const variables = { name: 'Heidi' };
    expect(substituteVariables(template, variables)).toBe('Hello Heidi, your score is {{score}}!');
  });

  it('should convert non-string values to strings', () => {
    const template = 'Count: {{count}}, Active: [isActive]';
    const variables = { count: 42 as any, isActive: true as any };
    expect(substituteVariables(template, variables)).toBe('Count: 42, Active: true');
  });
});
