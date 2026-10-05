export interface BulkCandidate {
  full_name: string;
  email: string;
  phone?: string;
  [key: string]: any;
}

export interface ParsedCandidates {
  headers: string[];
  candidates: BulkCandidate[];
}

export function parseCandidatesCSV(csvText: string): ParsedCandidates {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return { headers: [], candidates: [] };

  const originalHeaders = lines[0].split(',').map(h => h.trim());
  const lowerHeaders = originalHeaders.map(h => h.toLowerCase().replace(/\s+/g, '_'));
  
  const headerMap: Record<string, number> = {};
  lowerHeaders.forEach((header, index) => {
    headerMap[header] = index;
  });

  const candidates: BulkCandidate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 2) continue;

    const candidate: any = {};
    
    // First, map all values to their lowercase header keys
    lowerHeaders.forEach((header, index) => {
      candidate[header] = values[index] || '';
    });

    // Ensure full_name is set (handle "name" or "full_name")
    if (!candidate.full_name) {
      candidate.full_name = candidate.name || values[0];
    }
    
    // Ensure email is set
    if (!candidate.email) {
      candidate.email = values[headerMap['email']] || values[1];
    }

    if (candidate.full_name && candidate.email) {
      candidates.push(candidate as BulkCandidate);
    }
  }

  return { 
    headers: originalHeaders, 
    candidates 
  };
}

export function generateSampleCSV(): string {
  return "Name, Email, Phone, Location, Experience, Education\nJohn Doe, john@example.com, +1234567890, New York, 5 years, B.Tech CS";
}

/**
 * Sanitizes a cell for CSV export to prevent CSV formula injection (CWE-1236).
 * Prepend a single quote if the value starts with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  const safeStr = formulaChars.some(char => str.startsWith(char))
    ? `'${str}`
    : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

