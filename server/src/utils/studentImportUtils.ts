/**
 * Shared utility functions for parsing CSV files, auto-detecting student details,
 * cleaning LeetCode profile URLs, and handling mentor filtering.
 */

export interface ParsedImportRow {
  id: string;
  rawRegisterNumber: string;
  cleanRegisterNumber: string;
  name: string;
  department: string;
  rawMentor: string;
  cleanMentor: string;
  phone: string;
  rawLeetCode: string;
  cleanLeetCode: string;
  totalSolved?: number;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

export interface ParseResult {
  rows: ParsedImportRow[];
  detectedMentors: string[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  hasHeaders: boolean;
}

export function extractCleanLeetCodeUsername(input: string | null | undefined): string {
  if (!input) return '';
  let str = input.trim();
  if (!str) return '';

  if (str.startsWith('@')) {
    str = str.substring(1).trim();
  }

  str = str.split('?')[0].split('#')[0].trim();

  if (str.includes('leetcode.com') || str.includes('leetcode.cn')) {
    str = str.replace(/\/+$/, '');
    const parts = str.split('/').filter(Boolean);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart === '_' && parts.length > 1) {
        return parts[parts.length - 2].trim();
      }
      return lastPart.trim();
    }
  }

  str = str.replace(/^\/+|\/+$/g, '').trim();
  return str;
}

export function normalizeMentorName(name: string | null | undefined): string {
  if (!name) return '';
  let str = name.trim();
  if (!str) return '';

  // Extract title prefix if present (mrs before mr)
  let prefix = '';
  const titleMatch = str.match(/^(dr|mrs|mr|ms|prof)\.?\s*/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    prefix = (title === 'dr' ? 'Dr.' : title === 'mrs' ? 'Mrs.' : title === 'mr' ? 'Mr.' : title === 'ms' ? 'Ms.' : 'Prof.') + ' ';
    str = str.substring(titleMatch[0].length);
  }

  // Replace dots and underscores with spaces
  str = str.replace(/[._]/g, ' ');

  // Capitalize each word
  const words = str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.length === 1) {
        return w.toUpperCase() + '.';
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });

  let joined = (prefix + words.join(' ')).trim();
  if (!prefix && joined.endsWith('.')) {
    joined = joined.replace(/\.$/, '');
  }

  return joined;
}

export function parseCSVLines(csvText: string): string[][] {
  const lines: string[][] = [];
  const rawLines = csvText.split(/\r\n|\n|\r/);

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if ((char === ',' || char === '\t') && !insideQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());

    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

const KNOWN_DEPTS = new Set([
  'CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML', 'CSBS', 'CYBER', 'AUTO', 'BIOTECH', 'CHEM',
]);

export function analyzeAndParseStudents(csvText: string): ParseResult {
  const lines = parseCSVLines(csvText);
  if (lines.length === 0) {
    return { rows: [], detectedMentors: [], totalParsed: 0, validCount: 0, invalidCount: 0, hasHeaders: false };
  }

  const firstLine = lines[0];
  const firstLineStr = firstLine.join(' ').toLowerCase();
  const containsUrl = firstLineStr.includes('http://') || firstLineStr.includes('https://') || firstLineStr.includes('leetcode.com') || firstLineStr.includes('leetcode.cn');
  const containsRegNo = firstLine.some((c) => /^\d{8,16}$/.test(c.replace(/\s+/g, '')));

  const hasHeaderKeywords =
    firstLineStr.includes('register number') ||
    firstLineStr.includes('reg no') ||
    firstLineStr.includes('reg_no') ||
    firstLineStr.includes('student name') ||
    firstLineStr.includes('student_name') ||
    firstLineStr.includes('leetcode id') ||
    firstLineStr.includes('leetcode profile') ||
    firstLineStr.includes('leetcode username') ||
    firstLineStr.includes('leetcode handle') ||
    firstLineStr.includes('mentor name') ||
    firstLineStr.includes('faculty name');

  const hasHeaders = !containsUrl && !containsRegNo && hasHeaderKeywords;

  const dataLines = hasHeaders ? lines.slice(1) : lines;
  const parsedRows: ParsedImportRow[] = [];
  const mentorSet = new Set<string>();

  dataLines.forEach((cells, index) => {
    let regNo = '';
    let name = '';
    let dept = 'CSE';
    let rawMentor = '';
    let phone = '';
    let leetcodeUrl = '';
    let solvedCount: number | undefined;

    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]?.trim() || '';
      if (!cell) continue;

      if (cell.includes('leetcode.com') || cell.includes('leetcode.cn') || cell.startsWith('@')) {
        leetcodeUrl = cell;
        continue;
      }

      const digitsOnly = cell.replace(/\s+/g, '');
      if (!regNo && digitsOnly.length >= 8 && digitsOnly.length <= 16 && /^[0-9A-Za-z]+$/.test(digitsOnly) && /\d/.test(digitsOnly)) {
        regNo = digitsOnly.toUpperCase();
        continue;
      }

      const upperCell = cell.toUpperCase();
      if (KNOWN_DEPTS.has(upperCell)) {
        dept = upperCell;
        continue;
      }

      if (!rawMentor && (/^(dr\.|mr\.|mrs\.|prof\.)/i.test(cell) || (c === 4 && !KNOWN_DEPTS.has(upperCell) && !/^\d+$/.test(cell.replace(/\s+/g, '')) && !cell.includes('leetcode')))) {
        rawMentor = cell;
        continue;
      }

      if (!phone && /^[0-9\s-]{10,14}$/.test(cell) && cell.replace(/\D/g, '').length === 10) {
        phone = cell;
        continue;
      }

      if (solvedCount === undefined && /^\d+$/.test(cell) && parseInt(cell) < 4000 && parseInt(cell) > 0) {
        solvedCount = parseInt(cell);
        continue;
      }

      if (!name && /^[A-Za-z\s.'()_-]{3,60}$/.test(cell) && !/^(dr\.|mr\.|mrs\.|prof\.)/i.test(cell)) {
        name = cell;
        continue;
      }
    }

    if (!regNo && cells[1] && cells[1].length >= 8) {
      regNo = cells[1].replace(/\s+/g, '').toUpperCase();
    }
    if (!name && cells[2]) {
      name = cells[2];
    }
    if (!rawMentor && cells[4] && cells[4].trim()) {
      const c4 = cells[4].trim();
      const isPhone = /^[0-9\s-]{10,14}$/.test(c4);
      const isUrl = c4.includes('leetcode');
      const isDept = KNOWN_DEPTS.has(c4.toUpperCase());
      const isNum = /^\d+$/.test(c4);
      if (!isPhone && !isUrl && !isDept && !isNum) {
        rawMentor = c4;
      }
    }
    if (!leetcodeUrl && cells[7] && cells[7].includes('leetcode')) {
      leetcodeUrl = cells[7];
    }

    const cleanRegNo = regNo.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanUsername = extractCleanLeetCodeUsername(leetcodeUrl);
    const cleanMentor = normalizeMentorName(rawMentor);

    if (cleanMentor) {
      mentorSet.add(cleanMentor);
    }

    let isValid = true;
    let validationError = '';

    if (!cleanRegNo) {
      isValid = false;
      validationError = 'Missing Register Number';
    } else if (!cleanName) {
      isValid = false;
      validationError = 'Missing Student Name';
    } else if (!cleanUsername) {
      isValid = false;
      validationError = 'Missing LeetCode Username / Profile URL';
    }

    parsedRows.push({
      id: `row_${index}_${cleanRegNo || Math.random().toString(36).substring(2, 6)}`,
      rawRegisterNumber: regNo,
      cleanRegisterNumber: cleanRegNo,
      name: cleanName || 'Unnamed Student',
      department: dept,
      rawMentor: rawMentor,
      cleanMentor: cleanMentor || 'Unassigned',
      phone: phone,
      rawLeetCode: leetcodeUrl,
      cleanLeetCode: cleanUsername,
      totalSolved: solvedCount,
      isValid,
      validationError: validationError || undefined,
      selected: isValid,
    });
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const detectedMentors = Array.from(mentorSet).sort();

  return {
    rows: parsedRows,
    detectedMentors,
    totalParsed: parsedRows.length,
    validCount,
    invalidCount,
    hasHeaders,
  };
}
