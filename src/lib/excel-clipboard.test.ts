import { describe, it, expect } from 'vitest';
import {
  parseExcelClipboard,
  transposeGrid,
  detectIfFirstRowIsHeader,
  autoDetectColumnMappings,
  validateRow,
  getColumnLetter,
  SAMPLE_EXCEL_CLIPBOARD,
} from './excel-clipboard';

describe('excel-clipboard', () => {
  it('should parse tab-separated Excel clipboard text', () => {
    const raw = `Name\tEmail\tPhone\nJohn Doe\tjohn@example.com\t+1234567890`;
    const grid = parseExcelClipboard(raw);

    expect(grid).toEqual([
      ['Name', 'Email', 'Phone'],
      ['John Doe', 'john@example.com', '+1234567890'],
    ]);
  });

  it('should parse CSV clipboard text with quoted cells', () => {
    const raw = `"Doe, Jane",jane@example.com,"+1 555 123"`;
    const grid = parseExcelClipboard(raw);

    expect(grid).toEqual([
      ['Doe, Jane', 'jane@example.com', '+1 555 123'],
    ]);
  });

  it('should parse the sample excel clipboard data correctly', () => {
    const grid = parseExcelClipboard(SAMPLE_EXCEL_CLIPBOARD);
    expect(grid.length).toBe(5);
    expect(grid[0]).toEqual(['Full Name', 'Email', 'Phone', 'LinkedIn', 'Notes']);
    expect(grid[1][0]).toBe('Sarah Connor');
    expect(grid[1][1]).toBe('sarah.c@cyberdyne.io');
  });

  it('should detect if the first row is a header row', () => {
    const gridWithHeader = [
      ['Full Name', 'Email Address', 'Phone Number', 'LinkedIn'],
      ['Sarah Jenkins', 'sarah@test.com', '12345', 'https://linkedin.com/in/sarah'],
    ];
    expect(detectIfFirstRowIsHeader(gridWithHeader)).toBe(true);

    const gridWithoutHeader = [
      ['Sarah Jenkins', 'sarah@test.com', '12345'],
      ['David Miller', 'david@test.com', '67890'],
    ];
    expect(detectIfFirstRowIsHeader(gridWithoutHeader)).toBe(false);
  });

  it('should auto-detect column mappings correctly', () => {
    const grid = [
      ['Full Name', 'Email', 'Phone', 'LinkedIn', 'Notes'],
      ['Sarah Connor', 'sarah@example.com', '+14155550192', 'https://linkedin.com/in/sarah', 'Dev'],
    ];
    const mappings = autoDetectColumnMappings(grid, true);
    expect(mappings).toEqual([
      'full_name',
      'email',
      'phone',
      'linkedin',
      'recruiter_notes',
    ]);
  });

  it('should transpose a grid from rows to columns', () => {
    const grid = [
      ['Name', 'Alice', 'Bob'],
      ['Email', 'alice@test.com', 'bob@test.com'],
    ];
    const transposed = transposeGrid(grid);
    expect(transposed).toEqual([
      ['Name', 'Email'],
      ['Alice', 'alice@test.com'],
      ['Bob', 'bob@test.com'],
    ]);
  });

  it('should generate correct Excel column letters', () => {
    expect(getColumnLetter(0)).toBe('A');
    expect(getColumnLetter(1)).toBe('B');
    expect(getColumnLetter(25)).toBe('Z');
    expect(getColumnLetter(26)).toBe('AA');
    expect(getColumnLetter(27)).toBe('AB');
  });

  it('should validate row correctly', () => {
    const validRow = ['Alice', 'alice@test.com', '123'];
    const result1 = validateRow(validRow, 0, 1);
    expect(result1.isValid).toBe(true);
    expect(result1.errors).toHaveLength(0);

    const invalidEmailRow = ['Bob', 'not-an-email', '123'];
    const result2 = validateRow(invalidEmailRow, 0, 1);
    expect(result2.isValid).toBe(false);
    expect(result2.errors).toContain('Invalid email format');

    const missingNameRow = ['', 'bob@test.com', '123'];
    const result3 = validateRow(missingNameRow, 0, 1);
    expect(result3.isValid).toBe(false);
    expect(result3.errors).toContain('Missing Full Name');
  });
});
