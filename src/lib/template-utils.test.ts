import { describe, it, expect } from 'vitest';
import { substituteVariables } from './template-utils';

describe('substituteVariables', () => {
  it('should replace {{key}} format when plain key is provided', () => {
    const template = 'Hello, {{name}}!';
    const variables = { name: 'World' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, World!');
  });

  it('should replace [key] format when plain key is provided', () => {
    const template = 'Hello, [name]!';
    const variables = { name: 'World' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, World!');
  });

  it('should replace keys that already have {{}} delimiters', () => {
    const template = 'Hello, {{name}}!';
    const variables = { '{{name}}': 'World' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, World!');
  });

  it('should replace keys that already have [] delimiters', () => {
    const template = 'Hello, [name]!';
    const variables = { '[name]': 'World' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, World!');
  });

  it('should escape HTML values to prevent XSS', () => {
    const template = '<div>{{content}} - [content2] - {{content3}} - [content4]</div>';
    const variables = {
      content: '<script>alert("xss")</script>',
      content2: '<script>alert("xss2")</script>',
      '{{content3}}': '<script>alert("xss3")</script>',
      '[content4]': '<script>alert("xss4")</script>'
    };
    const result = substituteVariables(template, variables);
    // Based on standard HTML escaping (e.g. escaping <, >, ", ', &)
    expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss2&quot;)&lt;/script&gt;');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss3&quot;)&lt;/script&gt;');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss4&quot;)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('should handle missing variables by leaving the template unchanged', () => {
    const template = 'Hello, {{name}}!';
    const variables = {};
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, {{name}}!');
  });

  it('should replace multiple occurrences of the same variable', () => {
    const template = '{{greeting}}, {{greeting}}!';
    const variables = { greeting: 'Hello' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, Hello!');
  });

  it('should replace multiple variables of different types', () => {
    const template = '{{greeting}}, [name]! The {{item}} is [status].';
    const variables = { greeting: 'Hello', name: 'Alice', '{{item}}': 'Task', '[status]': 'done' };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Hello, Alice! The Task is done.');
  });

  it('should treat non-string values correctly by coercing them to strings', () => {
    const template = 'Count: {{count}}';
    // TS signature says Record<string, string>, but testing runtime behavior
    const variables = { count: 42 as any };
    const result = substituteVariables(template, variables);
    expect(result).toBe('Count: 42');
  });
});
