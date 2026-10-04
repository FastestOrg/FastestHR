/**
 * Utilities for parsing clipboard data from Excel, Google Sheets, and CSV,
 * auto-detecting column/row mappings, and manipulating table grids.
 */

export type TargetField = 
  | 'full_name' 
  | 'email' 
  | 'phone' 
  | 'linkedin' 
  | 'source' 
  | 'score' 
  | 'recruiter_notes' 
  | 'none';

export interface FieldDefinition {
  id: TargetField;
  label: string;
  required?: boolean;
  description: string;
}

export const TARGET_FIELDS: FieldDefinition[] = [
  { id: 'full_name', label: 'Full Name', required: true, description: 'Candidate name' },
  { id: 'email', label: 'Email Address', required: true, description: 'Primary contact email' },
  { id: 'phone', label: 'Phone Number', required: false, description: 'Phone or mobile' },
  { id: 'linkedin', label: 'LinkedIn Profile', required: false, description: 'LinkedIn URL or handle' },
  { id: 'source', label: 'Candidate Source', required: false, description: 'E.g. LinkedIn, Referral, Direct' },
  { id: 'score', label: 'Score (0 - 10)', required: false, description: 'Numerical rating or score' },
  { id: 'recruiter_notes', label: 'Notes / Summary', required: false, description: 'Role, experience, or notes' },
  { id: 'none', label: 'Skip (Do not import)', required: false, description: 'Ignore this column' },
];

/**
 * Parses raw clipboard text (TSV from Excel/Sheets, CSV, or semicolon-delimited)
 * into a rectangular 2D array of string cells.
 */
export function parseExcelClipboard(text: string): string[][] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  // If text contains HTML table tags (e.g. from rich clipboard), parse table
  if (/<table[\s\S]*<\/table>/i.test(cleanText) || /<tr[\s\S]*<\/tr>/i.test(cleanText)) {
    const htmlRows = parseHtmlTable(cleanText);
    if (htmlRows.length > 0) return htmlRows;
  }

  // Detect delimiter: tab (\t), comma (,), or semicolon (;)
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = '\t';
  if (tabCount > 0) {
    delimiter = '\t';
  } else if (commaCount > semiCount && commaCount > 0) {
    delimiter = ',';
  } else if (semiCount > 0) {
    delimiter = ';';
  }

  // Parse characters with proper quote handling
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Flush remaining cell
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  // Normalize column count across all rows
  const maxCols = Math.max(...rows.map(r => r.length), 0);
  return rows.map(r => {
    const padded = [...r];
    while (padded.length < maxCols) {
      padded.push('');
    }
    return padded;
  });
}

/**
 * Parses HTML table string into 2D string array
 */
export function parseHtmlTable(html: string): string[][] {
  if (typeof DOMParser === 'undefined') return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tableRows = doc.querySelectorAll('tr');
    if (tableRows.length === 0) return [];

    const rows: string[][] = [];
    tableRows.forEach(tr => {
      const cells = tr.querySelectorAll('td, th');
      const rowData: string[] = [];
      cells.forEach(td => {
        rowData.push(td.textContent?.trim() || '');
      });
      if (rowData.some(c => c.length > 0)) {
        rows.push(rowData);
      }
    });

    if (rows.length === 0) return [];
    const maxCols = Math.max(...rows.map(r => r.length), 0);
    return rows.map(r => {
      const padded = [...r];
      while (padded.length < maxCols) {
        padded.push('');
      }
      return padded;
    });
  } catch {
    return [];
  }
}

/**
 * Transpose a 2D grid: swaps rows and columns.
 * Useful if the user copied Excel data oriented horizontally.
 */
export function transposeGrid(grid: string[][]): string[][] {
  if (grid.length === 0) return [];
  const numCols = Math.max(...grid.map(row => row.length));
  const transposed: string[][] = [];
  for (let c = 0; c < numCols; c++) {
    const newRow: string[] = [];
    for (let r = 0; r < grid.length; r++) {
      newRow.push(grid[r]?.[c] || '');
    }
    transposed.push(newRow);
  }
  return transposed;
}

/**
 * Detects whether the first row appears to be a header row based on keywords
 * and comparing data formats between row 0 and subsequent rows.
 */
export function detectIfFirstRowIsHeader(grid: string[][]): boolean {
  if (grid.length < 2) return false;
  const firstRow = grid[0];
  const secondRow = grid[1];

  const headerKeywords = [
    'name', 'full name', 'fullname', 'candidate', 'applicant', 'lead',
    'email', 'mail', 'phone', 'mobile', 'tel', 'cell', 'contact',
    'linkedin', 'linkedin_url', 'profile', 'social', 'url',
    'source', 'channel', 'score', 'rating', 'notes', 'note', 'summary',
    'title', 'role', 'position', 'experience', 'location', 'company'
  ];

  let headerScore = 0;
  firstRow.forEach(cell => {
    const lower = cell.toLowerCase().trim();
    if (headerKeywords.includes(lower)) headerScore += 2;
    // Check if cell has no space and no symbols, just alphanumeric header title
    if (/^[A-Za-z\s_-]{2,20}$/.test(cell)) headerScore += 0.5;
  });

  // If first row has an actual email address, it is probably NOT a header row
  if (firstRow.some(cell => cell.includes('@') && cell.includes('.'))) {
    return false;
  }

  // If second row has email and first row doesn't, first row is likely header
  if (
    !firstRow.some(c => c.includes('@')) &&
    secondRow &&
    secondRow.some(c => c.includes('@'))
  ) {
    headerScore += 3;
  }

  return headerScore >= 2;
}

/**
 * Auto-detects the best field mapping for a column based on its header
 * and sample values from subsequent rows.
 */
export function autoDetectFieldForColumn(
  header: string,
  sampleValues: string[] = []
): TargetField {
  const h = (header || '').toLowerCase().trim();
  const samples = sampleValues.map(v => (v || '').toLowerCase().trim()).filter(Boolean);

  // 1. Email check
  if (
    h.includes('email') || 
    h.includes('mail') || 
    samples.some(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
  ) {
    return 'email';
  }

  // 2. LinkedIn check
  if (
    h.includes('linkedin') || 
    h.includes('linked_in') || 
    samples.some(s => s.includes('linkedin.com'))
  ) {
    return 'linkedin';
  }

  // 3. Phone check
  if (
    h.includes('phone') || 
    h.includes('mobile') || 
    h.includes('tel') || 
    h.includes('cell') || 
    h.includes('contact') ||
    samples.some(s => /^(\+?\d{1,4}[-\s.]?)?\(?\d{2,4}\)?[-\s.]?\d{2,4}[-\s.]?\d{2,4}$/.test(s.replace(/\s+/g, ' ')))
  ) {
    return 'phone';
  }

  // 4. Score check
  if (
    h.includes('score') || 
    h.includes('rating') || 
    h.includes('rank') || 
    h.includes('points')
  ) {
    return 'score';
  }

  // 5. Source check
  if (
    h.includes('source') || 
    h.includes('channel') || 
    h.includes('origin') || 
    h.includes('referred')
  ) {
    return 'source';
  }

  // 6. Name check
  if (
    h.includes('name') || 
    h.includes('candidate') || 
    h.includes('applicant') || 
    h.includes('lead') || 
    h.includes('person')
  ) {
    return 'full_name';
  }

  // 7. Notes / summary check
  if (
    h.includes('note') || 
    h.includes('notes') || 
    h.includes('comment') || 
    h.includes('summary') || 
    h.includes('description') || 
    h.includes('role') || 
    h.includes('experience') || 
    h.includes('title')
  ) {
    return 'recruiter_notes';
  }

  // If no header, infer from values
  if (!h && samples.length > 0) {
    // If samples look like names (two or more words, alphabetic)
    if (samples.every(s => /^[a-zA-Z\s.'-]{2,40}$/.test(s) && s.includes(' '))) {
      return 'full_name';
    }
  }

  return 'none';
}

/**
 * Automatically creates column mappings for all columns in the grid.
 * Avoids duplicate assignments of single-instance fields like 'full_name' and 'email'.
 */
export function autoDetectColumnMappings(
  grid: string[][],
  hasHeader: boolean
): TargetField[] {
  if (grid.length === 0) return [];
  const numCols = Math.max(...grid.map(row => row.length));
  const mappings: TargetField[] = [];
  const usedUniqueFields = new Set<TargetField>();

  const headerRow = hasHeader ? grid[0] : [];
  const dataRows = hasHeader ? grid.slice(1) : grid;

  for (let c = 0; c < numCols; c++) {
    const header = headerRow[c] || '';
    const sampleValues = dataRows.slice(0, 10).map(r => r[c] || '');
    let detected = autoDetectFieldForColumn(header, sampleValues);

    // If already used a unique field (like full_name or email), don't assign it again
    if (['full_name', 'email'].includes(detected)) {
      if (usedUniqueFields.has(detected)) {
        detected = 'none';
      } else {
        usedUniqueFields.add(detected);
      }
    }

    mappings.push(detected);
  }

  // Fallback: If full_name or email wasn't assigned, try sensible defaults
  if (!mappings.includes('full_name') && mappings.length > 0 && mappings[0] === 'none') {
    mappings[0] = 'full_name';
  }
  if (!mappings.includes('email') && mappings.length > 1 && mappings[1] === 'none') {
    mappings[1] = 'email';
  }

  return mappings;
}

/**
 * Validates a single row against the current column mappings.
 */
export function validateRow(
  row: string[],
  nameColIdx: number,
  emailColIdx: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const name = nameColIdx >= 0 ? (row[nameColIdx] || '').trim() : '';
  const email = emailColIdx >= 0 ? (row[emailColIdx] || '').trim() : '';

  if (nameColIdx === -1) {
    errors.push('Full Name column is not mapped');
  } else if (!name) {
    errors.push('Missing Full Name');
  }

  if (emailColIdx === -1) {
    errors.push('Email column is not mapped');
  } else if (!email) {
    errors.push('Missing Email Address');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generates an Excel column letter label (A, B, C, ..., Z, AA, AB, ...)
 */
export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Sample Excel clipboard text that users can click to demo the flow immediately
 */
export const SAMPLE_EXCEL_CLIPBOARD = [
  ['Full Name', 'Email', 'Phone', 'LinkedIn', 'Notes'],
  ['Sarah Connor', 'sarah.c@cyberdyne.io', '+1 (415) 555-0192', 'https://linkedin.com/in/sarah-connor', 'Senior Frontend Engineer with React exp'],
  ['Alex Mercer', 'alex.mercer@gentek.org', '+1 (206) 555-0148', 'https://linkedin.com/in/alex-mercer', 'Backend Go & Distributed Systems expert'],
  ['Elena Rostova', 'elena.r@synapse.tech', '+44 20 7946 0912', 'https://linkedin.com/in/elena-rostova', 'Product Manager with strong technical background'],
  ['Marcus Vance', 'marcus.vance@solaris.co', '+1 (312) 555-0183', 'https://linkedin.com/in/marcus-vance', 'DevOps, CI/CD & Kubernetes specialist'],
].map(r => r.join('\t')).join('\n');
