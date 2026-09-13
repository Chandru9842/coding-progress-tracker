/**
 * Shared utility functions for parsing CSV files, auto-detecting student details,
 * cleaning LeetCode profile URLs, and handling mentor filtering.
 */

export interface ParsedImportRow {
  id: string;
  rawRegisterNumber: string;
  cleanRegisterNumber: string;
  name: string;
  dob?: string;
  department: string;
  section?: string;
  academicYear?: string;
  currentYear?: string;
  rawMentor: string;
  cleanMentor: string;
  phone?: string;
  rawLeetCode: string;
  cleanLeetCode: string;
  totalSolved?: number;
  isValid: boolean;
  isDuplicate?: boolean;
  validationError?: string;
  selected: boolean;
}

export interface ParseResult {
  rows: ParsedImportRow[];
  detectedMentors: string[];
  detectedYears?: string[];
  detectedSections?: string[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
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
  const titleMatch = str.match(/^(dr|mrs|mr|ms|prof|er)\.?\s*/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    prefix = (title === 'dr' ? 'Dr.' : title === 'mrs' ? 'Mrs.' : title === 'mr' ? 'Mr.' : title === 'ms' ? 'Ms.' : title === 'prof' ? 'Prof.' : 'Er.') + ' ';
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
  'CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML', 'CSBS', 'CYBER', 'AUTO', 'BIOTECH', 'CHEM', 'MCA', 'BCA',
]);

/**
 * Intelligently analyzes parsed CSV matrix and auto-detects columns:
 * - Automatically removes duplicates from sheet.
 * - Disambiguates students with identical name & initial using Date of Birth (DOB).
 * - Discards extraneous columns (phone numbers, parent info, addresses, etc.).
 * - Detects mentors, study years, sections, and flags non-mentor students cleanly.
 */
export function analyzeAndParseStudents(csvText: string): ParseResult {
  const cleanedCSV = csvText.replace(/^\uFEFF/, '');
  const lines = parseCSVLines(cleanedCSV);
  if (lines.length === 0) {
    return { rows: [], detectedMentors: [], totalParsed: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, hasHeaders: false };
  }

  // Filter out pure comment lines (e.g. starting with # or //)
  const nonCommentLines = lines.filter((l) => {
    const firstNonEmpty = l.find((c) => c.trim().length > 0);
    return firstNonEmpty && !firstNonEmpty.startsWith('#') && !firstNonEmpty.startsWith('//');
  });

  if (nonCommentLines.length === 0) {
    return { rows: [], detectedMentors: [], totalParsed: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, hasHeaders: false };
  }

  const firstLine = nonCommentLines[0];
  const firstLineStr = firstLine.join(' ').toLowerCase();
  const containsUrl = firstLineStr.includes('http://') || firstLineStr.includes('https://') || firstLineStr.includes('leetcode.com') || firstLineStr.includes('leetcode.cn');
  const containsRegNo = firstLine.some((c) => /^\d{8,16}$/.test(c.replace(/\s+/g, '')));

  const hasHeaderKeywords =
    firstLineStr.includes('register number') ||
    firstLineStr.includes('reg no') ||
    firstLineStr.includes('reg_no') ||
    firstLineStr.includes('roll no') ||
    firstLineStr.includes('student name') ||
    firstLineStr.includes('student_name') ||
    firstLineStr.includes('candidate name') ||
    firstLineStr.includes('leetcode id') ||
    firstLineStr.includes('leetcode profile') ||
    firstLineStr.includes('leetcode username') ||
    firstLineStr.includes('leetcode handle') ||
    firstLineStr.includes('mentor name') ||
    firstLineStr.includes('faculty name') ||
    firstLineStr.includes('staff name');

  const hasHeaders = !containsUrl && !containsRegNo && hasHeaderKeywords;

  const dataLines = hasHeaders ? nonCommentLines.slice(1) : nonCommentLines;
  const parsedRows: ParsedImportRow[] = [];
  const mentorSet = new Set<string>();
  const yearSet = new Set<string>();
  const sectionSet = new Set<string>();
  const seenRegNumbers = new Map<string, number>();
  let duplicateCount = 0;

  dataLines.forEach((cells, index) => {
    let regNo = '';
    let name = '';
    let dept = 'CSE';
    let section = '';
    let rawMentor = '';
    let dob = '';
    let leetcodeUrl = '';
    let academicYear = '';
    let currentYear = '';
    let solvedCount: number | undefined;

    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]?.trim() || '';
      if (!cell) continue;

      if (cell.includes('leetcode.com') || cell.includes('leetcode.cn') || cell.startsWith('@')) {
        leetcodeUrl = cell;
        continue;
      }

      if (!academicYear && /^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(cell)) {
        academicYear = cell.replace(/\s+/g, '').replace('/', '-');
        yearSet.add(academicYear);
        continue;
      }

      if (!currentYear && /^(1st|2nd|3rd|4th|I|II|III|IV)\s*year/i.test(cell)) {
        currentYear = cell.trim();
        yearSet.add(currentYear);
        continue;
      }

      if (!section) {
        const secMatch = cell.match(/^(?:section|sec)[\s-_]*([A-Za-z0-9]+)$/i);
        if (secMatch && secMatch[1]) {
          section = secMatch[1].toUpperCase();
          sectionSet.add(section);
          continue;
        } else if (/^[A-D]$/i.test(cell) && (firstLineStr.includes('sec') || c === 3 || c === 4)) {
          section = cell.toUpperCase();
          sectionSet.add(section);
          continue;
        }
      }

      const digitsOnly = cell.replace(/\s+/g, '');
      if (!regNo && digitsOnly.length >= 8 && digitsOnly.length <= 18 && /^[0-9A-Za-z]+$/.test(digitsOnly) && /\d/.test(digitsOnly) && !cell.includes('/')) {
        regNo = digitsOnly.toUpperCase();
        continue;
      }

      const upperCell = cell.toUpperCase();
      if (KNOWN_DEPTS.has(upperCell)) {
        dept = upperCell;
        continue;
      }

      if (!rawMentor) {
        if (/^(dr|mr|mrs|ms|prof|er)\.?\s*/i.test(cell)) {
          rawMentor = cell;
          continue;
        } else if (/^[a-zA-Z]{2,15}\.[a-zA-Z]{1,5}$/.test(cell)) {
          rawMentor = cell;
          continue;
        } else if (c === 4 && !KNOWN_DEPTS.has(upperCell) && !/^\d+$/.test(cell.replace(/\s+/g, '')) && !cell.includes('leetcode') && !cell.includes('/')) {
          rawMentor = cell;
          continue;
        }
      }

      // Check for Date of Birth in independent cell (e.g. 07.12.2005, 14/05/2006, 2005-12-07)
      if (!dob && !cell.includes('leetcode') && !/^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(cell)) {
        const dateMatch = cell.match(/(?:dob[:\s]*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i) || cell.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
        if (dateMatch) {
          const numDigits = cell.replace(/\D/g, '').length;
          if (numDigits >= 6 && numDigits <= 8) {
            dob = dateMatch[1].replace(/[-/]/g, '.');
          }
        }
      }

      if (solvedCount === undefined && /^\d+$/.test(cell) && parseInt(cell, 10) < 4000 && parseInt(cell, 10) > 0) {
        solvedCount = parseInt(cell, 10);
        continue;
      }

      if (!name && /^[A-Za-z\s.'()_-]{3,60}$/.test(cell) && !/^(dr\.|mr\.|mrs\.|prof\.|er\.)/i.test(cell) && !cell.includes('http') && !cell.includes('leetcode')) {
        name = cell;
        continue;
      }
    }

    if (!regNo && cells[1] && cells[1].length >= 8 && !cells[1].includes('/')) {
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
      if (!isPhone && !isUrl && !isDept && !isNum && !c4.includes('/')) {
        rawMentor = c4;
      }
    }
    if (!leetcodeUrl && cells[7] && cells[7].includes('leetcode')) {
      leetcodeUrl = cells[7];
    }

    const cleanRegNo = regNo.trim().toUpperCase();

    // Extract DOB from name if embedded in parentheses like "SARAVANAKUMAR V (07.12.2005)"
    if (name) {
      const nameDobMatch = name.match(/\(?\s*(?:dob[:\s]*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*\)?/i);
      if (nameDobMatch && !dob) {
        dob = nameDobMatch[1].replace(/[-/]/g, '.');
      }
    }

    // Clean base student name (remove date patterns and clean whitespace)
    let cleanName = name
      .replace(/\(?\s*(?:dob[:\s]*)?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanUsername = extractCleanLeetCodeUsername(leetcodeUrl);
    const cleanMentor = normalizeMentorName(rawMentor) || 'Unassigned';

    if (cleanMentor && cleanMentor !== 'Unassigned') {
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

    // AI Deduplication Engine: Automatically remove duplicates from sheet
    if (cleanRegNo && isValid) {
      if (seenRegNumbers.has(cleanRegNo)) {
        duplicateCount++;
        return; // Exclude duplicate row immediately
      }
      seenRegNumbers.set(cleanRegNo, parsedRows.length);
    }

    parsedRows.push({
      id: `row_${index}_${cleanRegNo || Math.random().toString(36).substring(2, 6)}`,
      rawRegisterNumber: regNo,
      cleanRegisterNumber: cleanRegNo,
      name: cleanName || 'Unnamed Student',
      dob: dob || undefined,
      department: dept,
      section: section || undefined,
      academicYear: academicYear || undefined,
      currentYear: currentYear || undefined,
      rawMentor: rawMentor,
      cleanMentor: cleanMentor || 'Unassigned',
      rawLeetCode: leetcodeUrl,
      cleanLeetCode: cleanUsername,
      totalSolved: solvedCount,
      isValid,
      isDuplicate: false,
      validationError: validationError || undefined,
      selected: isValid,
    });
  });

  // Disambiguate students who share the exact same name and initial using Date of Birth (DOB)
  const nameGroups = new Map<string, ParsedImportRow[]>();
  for (const row of parsedRows) {
    if (!row.isValid) continue;
    const normKey = row.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!nameGroups.has(normKey)) {
      nameGroups.set(normKey, []);
    }
    nameGroups.get(normKey)!.push(row);
  }

  for (const [, group] of nameGroups.entries()) {
    if (group.length > 1) {
      // Multiple students share identical name & initial! Disambiguate with DOB
      for (const row of group) {
        if (row.dob) {
          row.name = `${row.name} (DOB: ${row.dob})`;
        } else if (row.cleanRegisterNumber) {
          row.name = `${row.name} (${row.cleanRegisterNumber.slice(-4)})`;
        }
      }
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const hasUnassigned = parsedRows.some((r) => r.cleanMentor === 'Unassigned');
  const detectedMentors = Array.from(mentorSet).sort();
  if (hasUnassigned) {
    detectedMentors.push('Unassigned');
  }

  return {
    rows: parsedRows,
    detectedMentors,
    detectedYears: Array.from(yearSet).sort(),
    detectedSections: Array.from(sectionSet).sort(),
    totalParsed: parsedRows.length,
    validCount,
    invalidCount,
    duplicateCount,
    hasHeaders,
  };
}

