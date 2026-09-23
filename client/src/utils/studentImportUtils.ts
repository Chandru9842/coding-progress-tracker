import * as XLSX from 'xlsx';

/**
 * Utility functions for parsing CSV and Excel files, auto-detecting student details,
 * cleaning LeetCode profile URLs, configurable column mapping, and handling mentor filtering.
 */

export interface ParsedImportRow {
  id: string; // temporary client row id
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
  mentorStaffId?: string;
  phone?: string;
  rawLeetCode: string;
  cleanLeetCode: string;
  totalSolved?: number;
  isValid: boolean;
  isDuplicate?: boolean;
  validationError?: string;
  selected: boolean;
}

export interface AvailableColumn {
  index: number;
  letter: string; // "A", "B", "C"...
  headerName: string;
  sampleValues: string[];
}

export interface ActiveColumnMapping {
  regNoCol: number;
  nameCol: number;
  leetcodeCol: number;
  mentorCol: number;
  deptCol: number;
  secCol: number;
  yearCol: number;
  headerRowIndex: number;
}

export interface ColumnMappingConfig {
  headerRowIndex?: number; // -1 for no header row, or 0, 1, 2...
  regNoCol?: number; // -1 for auto
  nameCol?: number; // -1 for auto
  leetcodeCol?: number; // -1 for auto
  mentorCol?: number; // -1 for none/auto
  deptCol?: number; // -1 for none/auto
  secCol?: number; // -1 for none/auto
  yearCol?: number; // -1 for none/auto
  knownStaffList?: Array<{ id: string; name: string; email?: string }>;
}

export interface ParseResult {
  rows: ParsedImportRow[];
  detectedMentors: string[];
  detectedYears: string[];
  detectedSections: string[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  hasHeaders: boolean;
  headerRowIndex: number;
  availableColumns: AvailableColumn[];
  activeMapping: ActiveColumnMapping;
}

/**
 * Converts column 0-indexed number to Excel-like letter (0 -> A, 1 -> B, 26 -> AA).
 */
export function columnIndexToLetter(idx: number): string {
  let letter = '';
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Extracts a clean LeetCode username from any format:
 * - https://leetcode.com/u/Dhipak_S/ -> Dhipak_S
 * - https://leetcode.com/u/Aadeesh-12 -> Aadeesh-12
 * - https://leetcode.com/u/_/___Anishka__08/ -> ___Anishka__08
 * - https://leetcode.com/Chandrum06/ -> Chandrum06
 * - @Chandrum06 -> Chandrum06
 * - Chandrum06 -> Chandrum06
 */
export function extractCleanLeetCodeUsername(input: string | null | undefined): string {
  if (!input) return '';
  let str = String(input).trim();
  if (!str) return '';

  // Remove leading @
  if (str.startsWith('@')) {
    str = str.substring(1).trim();
  }

  // Remove query params and hash
  str = str.split('?')[0].split('#')[0].trim();

  // If full URL
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

  // Fallback: clean any trailing or leading slashes/spaces
  str = str.replace(/^\/+|\/+$/g, '').trim();
  return str;
}

export function normalizeMentorName(name: string | null | undefined): string {
  if (!name) return '';
  let str = String(name).trim();
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

/**
 * Parses raw CSV text into array of tokens per line, respecting quotes.
 */
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
 * Checks if a string matches any known registered staff user in the system.
 */
export function matchesKnownStaff(
  text: string,
  staffList?: Array<{ id: string; name: string; email?: string }>
): boolean {
  if (!text || !staffList || staffList.length === 0) return false;
  const clean = text.trim().toLowerCase().replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
  if (!clean || clean.length < 2) return false;

  const tokens = text
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !['dr', 'mr', 'mrs', 'ms', 'prof', 'er'].includes(t));

  return staffList.some((s) => {
    const sClean = s.name.toLowerCase().replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
    if (sClean && clean && sClean === clean) return true;
    if (clean.length >= 3 && (sClean.includes(clean) || clean.includes(sClean))) return true;
    if (tokens.length > 0) {
      const sTokens = s.name
        .toLowerCase()
        .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      if (tokens.some((t) => sTokens.includes(t))) return true;
    }
    return false;
  });
}

/**
 * Determines whether a cell contains a mentor/faculty name (handles Indian faculty naming patterns:
 * e.g., "Devi", "K. Devi", "Devi K", "Mrs. Devi", "Dr. A. Muthuraj", or matches staff database).
 */
export function isLikelyMentorName(
  cell: string,
  staffList?: Array<{ id: string; name: string; email?: string }>
): boolean {
  if (!cell) return false;
  const trimmed = cell.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (trimmed.includes('leetcode') || trimmed.includes('http') || /^\d+$/.test(trimmed)) return false;
  if (KNOWN_DEPTS.has(trimmed.toUpperCase())) return false;

  // 1. Matches any known staff user in DB
  if (matchesKnownStaff(trimmed, staffList)) return true;

  // 2. Starts with standard academic / professional title (Dr, Mr, Mrs, Ms, Prof, Er)
  if (/^(dr|mr|mrs|ms|prof|er)\.?\s+/i.test(trimmed)) return true;

  // 3. Name with dot notation e.g., "Devi.S", "Muthu.R", "K.Devi"
  if (/^[a-zA-Z]{2,20}\.[a-zA-Z]{1,5}$/.test(trimmed) || /^[a-zA-Z]{1,5}\.[a-zA-Z]{2,20}$/.test(trimmed)) return true;

  return false;
}

/**
 * Universal Intelligent Analyzer & Parser for ANY Excel/CSV Sheet.
 * Works with any column ordering, custom column configurations, or automatic detection.
 */
export function analyzeAndParseStudents(
  input: string | (string | number)[][],
  customConfig?: ColumnMappingConfig,
  knownStaffListOverride?: Array<{ id: string; name: string; email?: string }>
): ParseResult {
  let lines: string[][] = [];

  if (typeof input === 'string') {
    const cleanedCSV = input.replace(/^\uFEFF/, '');
    lines = parseCSVLines(cleanedCSV);
  } else if (Array.isArray(input)) {
    lines = input.map((row) =>
      Array.isArray(row) ? row.map((c) => (c !== null && c !== undefined ? String(c).trim() : '')) : []
    ).filter((row) => row.some((c) => c.length > 0));
  }

  if (lines.length === 0) {
    return {
      rows: [],
      detectedMentors: [],
      detectedYears: [],
      detectedSections: [],
      totalParsed: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      hasHeaders: false,
      headerRowIndex: -1,
      availableColumns: [],
      activeMapping: {
        regNoCol: -1,
        nameCol: -1,
        leetcodeCol: -1,
        mentorCol: -1,
        deptCol: -1,
        secCol: -1,
        yearCol: -1,
        headerRowIndex: -1,
      },
    };
  }

  // Filter out pure comment lines (starting with # or //)
  const nonCommentLines = lines.filter((l) => {
    const firstNonEmpty = l.find((c) => c.trim().length > 0);
    return firstNonEmpty && !firstNonEmpty.startsWith('#') && !firstNonEmpty.startsWith('//');
  });

  if (nonCommentLines.length === 0) {
    return {
      rows: [],
      detectedMentors: [],
      detectedYears: [],
      detectedSections: [],
      totalParsed: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      hasHeaders: false,
      headerRowIndex: -1,
      availableColumns: [],
      activeMapping: {
        regNoCol: -1,
        nameCol: -1,
        leetcodeCol: -1,
        mentorCol: -1,
        deptCol: -1,
        secCol: -1,
        yearCol: -1,
        headerRowIndex: -1,
      },
    };
  }

  // Determine header row index
  let headerRowIndex = -1;
  let hasHeaders = false;

  if (customConfig?.headerRowIndex !== undefined) {
    headerRowIndex = customConfig.headerRowIndex;
    hasHeaders = headerRowIndex >= 0 && headerRowIndex < nonCommentLines.length;
  } else {
    // Auto-detect header row among first 3 rows
    for (let r = 0; r < Math.min(3, nonCommentLines.length); r++) {
      const row = nonCommentLines[r];
      const rowStr = row.join(' ').toLowerCase();
      const containsUrl = rowStr.includes('http://') || rowStr.includes('https://') || rowStr.includes('leetcode.com') || rowStr.includes('leetcode.cn');
      const containsRegNoPattern = row.some((c) => /^\d{10,16}$/.test(c.replace(/\s+/g, '')));

      const hasHeaderKeywords =
        rowStr.includes('register') ||
        rowStr.includes('reg no') ||
        rowStr.includes('reg_no') ||
        rowStr.includes('roll no') ||
        rowStr.includes('roll_no') ||
        rowStr.includes('usn') ||
        rowStr.includes('student name') ||
        rowStr.includes('student_name') ||
        rowStr.includes('candidate name') ||
        rowStr.includes('candidate_name') ||
        rowStr.includes('full name') ||
        rowStr.includes('leetcode') ||
        rowStr.includes('mentor') ||
        rowStr.includes('faculty') ||
        rowStr.includes('advisor');

      if (!containsUrl && !containsRegNoPattern && hasHeaderKeywords) {
        headerRowIndex = r;
        hasHeaders = true;
        break;
      }
    }
  }

  const headerLine = hasHeaders && headerRowIndex >= 0 ? nonCommentLines[headerRowIndex] : [];
  const maxCols = nonCommentLines.reduce((m, r) => Math.max(m, r.length), 0);
  const dataLines = hasHeaders && headerRowIndex >= 0 ? nonCommentLines.slice(headerRowIndex + 1) : nonCommentLines;

  // Build Available Columns metadata for UI mapping dropdowns
  const availableColumns: AvailableColumn[] = [];
  for (let c = 0; c < maxCols; c++) {
    const letter = columnIndexToLetter(c);
    const rawHeader = headerLine[c]?.trim() || '';
    const headerName = rawHeader || `Column ${letter}`;

    const sampleValues: string[] = [];
    for (const r of dataLines) {
      if (r[c] && r[c].trim()) {
        sampleValues.push(r[c].trim());
        if (sampleValues.length >= 3) break;
      }
    }

    availableColumns.push({
      index: c,
      letter,
      headerName,
      sampleValues,
    });
  }

  // Resolve Column Mappings (Custom override takes highest priority, then auto-detection)
  const effectiveStaffList = customConfig?.knownStaffList || knownStaffListOverride || [];
  let regNoCol = customConfig?.regNoCol !== undefined ? customConfig.regNoCol : -1;
  let nameCol = customConfig?.nameCol !== undefined ? customConfig.nameCol : -1;
  let leetcodeCol = customConfig?.leetcodeCol !== undefined ? customConfig.leetcodeCol : -1;
  let mentorCol = customConfig?.mentorCol !== undefined ? customConfig.mentorCol : -1;
  let deptCol = customConfig?.deptCol !== undefined ? customConfig.deptCol : -1;
  let secCol = customConfig?.secCol !== undefined ? customConfig.secCol : -1;
  let yearCol = customConfig?.yearCol !== undefined ? customConfig.yearCol : -1;

  // Step A: Header keyword auto-detection if not specified
  if (hasHeaders && headerLine.length > 0) {
    const isSNoHeader = (val: string) =>
      val === 'sno' ||
      val === 'slno' ||
      val === 'snumber' ||
      val === 'serial' ||
      val === 'serialno' ||
      val === 'serialnumber' ||
      val === 'no' ||
      val === '#' ||
      val === 'sl' ||
      val === 'srno';

    headerLine.forEach((h, idx) => {
      const hClean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      // Exclude obvious Serial Number columns from regNo, name, mentor
      if (isSNoHeader(hClean)) {
        return;
      }

      if (regNoCol === -1) {
        if (
          hClean.includes('reg') ||
          hClean.includes('roll') ||
          hClean.includes('usn') ||
          hClean === 'rno' ||
          hClean.includes('regno') ||
          hClean.includes('registernumber') ||
          hClean.includes('registration') ||
          hClean.includes('enrollment') ||
          hClean.includes('studentid') ||
          hClean.includes('admno')
        ) {
          regNoCol = idx;
        }
      }

      if (nameCol === -1) {
        if (
          hClean.includes('studentname') ||
          hClean.includes('candidatename') ||
          hClean.includes('fullname') ||
          hClean.includes('nameofstudent') ||
          hClean.includes('nameofcandidate') ||
          (hClean.includes('name') && !hClean.includes('mentor') && !hClean.includes('faculty') && !hClean.includes('staff') && !hClean.includes('college'))
        ) {
          nameCol = idx;
        }
      }

      if (leetcodeCol === -1) {
        if (
          hClean.includes('leetcode') ||
          hClean.includes('lcid') ||
          hClean.includes('lcurl') ||
          hClean.includes('handle') ||
          hClean.includes('profile') ||
          hClean.includes('username') ||
          hClean === 'lc'
        ) {
          leetcodeCol = idx;
        }
      }

      if (mentorCol === -1) {
        if (
          hClean.includes('mentor') ||
          hClean.includes('faculty') ||
          hClean.includes('staff') ||
          hClean.includes('advisor') ||
          hClean.includes('guide') ||
          hClean.includes('tutor') ||
          hClean.includes('incharge') ||
          hClean.includes('counselor') ||
          hClean.includes('teacher')
        ) {
          mentorCol = idx;
        }
      }

      if (deptCol === -1) {
        if (hClean.includes('dept') || hClean.includes('department') || hClean.includes('branch') || hClean.includes('programme') || hClean.includes('degree')) {
          deptCol = idx;
        }
      }

      if (secCol === -1) {
        if (hClean.includes('sec') || hClean.includes('section') || hClean.includes('division') || hClean === 'div') {
          secCol = idx;
        }
      }

      if (yearCol === -1) {
        if (hClean.includes('year') || hClean.includes('batch') || hClean.includes('academic') || hClean.includes('study')) {
          yearCol = idx;
        }
      }
    });
  }

  // Step B: Data pattern scan for any remaining unmapped columns
  if (regNoCol === -1 || nameCol === -1 || leetcodeCol === -1 || mentorCol === -1) {
    const colScores: Record<number, { reg: number; name: number; lc: number; mentor: number; dept: number }> = {};
    for (let c = 0; c < maxCols; c++) {
      colScores[c] = { reg: 0, name: 0, lc: 0, mentor: 0, dept: 0 };
    }

    dataLines.slice(0, 30).forEach((cells) => {
      cells.forEach((cellRaw, c) => {
        const cell = (cellRaw || '').trim();
        if (!cell) return;

        // Skip pure small integers in column 0 (likely S.No) from scoring as name or mentor
        if (/^\d{1,3}$/.test(cell) && c === 0 && maxCols > 2) {
          return;
        }

        // LeetCode URL / handle
        if (cell.includes('leetcode.com') || cell.includes('leetcode.cn') || (cell.startsWith('@') && !cell.includes(' '))) {
          colScores[c].lc += 4;
        }

        // Register Number: 4-25 alphanumeric with digits and no slash
        const digits = cell.replace(/\s+/g, '');
        if (digits.length >= 4 && digits.length <= 25 && /^[0-9A-Za-z_-]+$/.test(digits) && /\d/.test(digits) && !cell.includes('/')) {
          colScores[c].reg += 3;
        }

        // Mentor: Matches known staff or Indian mentor patterns (e.g. "Devi", "K. Devi", "Devi K")
        if (isLikelyMentorName(cell, effectiveStaffList)) {
          colScores[c].mentor += 5;
        }

        // Dept: matches known dept list
        if (KNOWN_DEPTS.has(cell.toUpperCase())) {
          colScores[c].dept += 3;
        }

        // Student Name: 3-50 letters, uppercase/capitalized name, not LeetCode, not Dept, not Mentor
        if (
          /^[A-Za-z\s.'()_-]{3,60}$/.test(cell) &&
          !cell.includes('http') &&
          !cell.includes('leetcode') &&
          !KNOWN_DEPTS.has(cell.toUpperCase()) &&
          !isLikelyMentorName(cell, effectiveStaffList)
        ) {
          colScores[c].name += 1;
        }
      });
    });

    if (leetcodeCol === -1) {
      let best = -1;
      let maxScore = 0;
      for (let c = 0; c < maxCols; c++) {
        if (colScores[c].lc > maxScore) {
          maxScore = colScores[c].lc;
          best = c;
        }
      }
      if (best !== -1) leetcodeCol = best;
    }

    if (regNoCol === -1) {
      let best = -1;
      let maxScore = 0;
      for (let c = 0; c < maxCols; c++) {
        if (c !== leetcodeCol && colScores[c].reg > maxScore) {
          maxScore = colScores[c].reg;
          best = c;
        }
      }
      if (best !== -1) regNoCol = best;
    }

    if (mentorCol === -1) {
      let best = -1;
      let maxScore = 0;
      for (let c = 0; c < maxCols; c++) {
        if (c !== leetcodeCol && c !== regNoCol && colScores[c].mentor > maxScore) {
          maxScore = colScores[c].mentor;
          best = c;
        }
      }
      if (best !== -1) mentorCol = best;
    }

    if (nameCol === -1) {
      let best = -1;
      let maxScore = 0;
      for (let c = 0; c < maxCols; c++) {
        if (c !== leetcodeCol && c !== regNoCol && c !== mentorCol && colScores[c].name > maxScore) {
          maxScore = colScores[c].name;
          best = c;
        }
      }
      if (best !== -1) nameCol = best;
    }

    if (deptCol === -1) {
      let best = -1;
      let maxScore = 0;
      for (let c = 0; c < maxCols; c++) {
        if (colScores[c].dept > maxScore) {
          maxScore = colScores[c].dept;
          best = c;
        }
      }
      if (best !== -1) deptCol = best;
    }
  }

  const activeMapping: ActiveColumnMapping = {
    regNoCol,
    nameCol,
    leetcodeCol,
    mentorCol,
    deptCol,
    secCol,
    yearCol,
    headerRowIndex,
  };

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

    // 1. Direct Column Extraction from mapped active columns
    if (regNoCol >= 0 && cells[regNoCol]) {
      const v = cells[regNoCol].replace(/\s+/g, '');
      if (v.length >= 4 && !v.includes('/')) {
        regNo = v.toUpperCase();
      }
    }
    if (nameCol >= 0 && cells[nameCol]) {
      name = cells[nameCol].trim();
    }
    if (leetcodeCol >= 0 && cells[leetcodeCol]) {
      leetcodeUrl = cells[leetcodeCol].trim();
    }
    if (mentorCol >= 0 && cells[mentorCol]) {
      const mVal = cells[mentorCol].trim();
      if (mVal && !mVal.includes('leetcode') && !/^\d{8,}$/.test(mVal)) {
        rawMentor = mVal;
      }
    }
    if (deptCol >= 0 && cells[deptCol]) {
      const dVal = cells[deptCol].trim().toUpperCase();
      if (KNOWN_DEPTS.has(dVal)) dept = dVal;
    }
    if (secCol >= 0 && cells[secCol]) {
      const sVal = cells[secCol].trim().toUpperCase().replace(/^SECTION\s*/i, '');
      if (sVal) {
        section = sVal;
        sectionSet.add(section);
      }
    }
    if (yearCol >= 0 && cells[yearCol]) {
      const yVal = cells[yearCol].trim();
      if (/^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(yVal)) {
        academicYear = yVal.replace(/\s+/g, '').replace('/', '-');
        yearSet.add(academicYear);
      } else if (/year/i.test(yVal) || /^[1-4]$/.test(yVal)) {
        currentYear = yVal;
        yearSet.add(currentYear);
      }
    }

    // 2. Intelligent Cell Scanning Fallback for any unmapped fields
    for (let c = 0; c < cells.length; c++) {
      const cell = (cells[c] || '').trim();
      if (!cell) continue;

      if (!leetcodeUrl && (cell.includes('leetcode.com') || cell.includes('leetcode.cn') || (cell.startsWith('@') && !cell.includes(' ')))) {
        leetcodeUrl = cell;
        continue;
      }

      if (!academicYear && /^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(cell)) {
        academicYear = cell.replace(/\s+/g, '').replace('/', '-');
        yearSet.add(academicYear);
        continue;
      }

      if (!currentYear && /^(1st|2nd|3rd|4th|I|II|III|IV)\s*year/i.test(cell)) {
        currentYear = cell;
        yearSet.add(currentYear);
        continue;
      }

      if (!section) {
        const secMatch = cell.match(/^(?:section|sec)[\s-_]*([A-Za-z0-9]+)$/i);
        if (secMatch && secMatch[1]) {
          section = secMatch[1].toUpperCase();
          sectionSet.add(section);
          continue;
        } else if (/^[A-D]$/i.test(cell) && (c === secCol || c === 3 || c === 4)) {
          section = cell.toUpperCase();
          sectionSet.add(section);
          continue;
        }
      }

      const digitsOnly = cell.replace(/\s+/g, '');
      if (!regNo && digitsOnly.length >= 4 && digitsOnly.length <= 25 && /^[0-9A-Za-z_-]+$/.test(digitsOnly) && /\d/.test(digitsOnly) && !cell.includes('/')) {
        regNo = digitsOnly.toUpperCase();
        continue;
      }

      const upperCell = cell.toUpperCase();
      if (KNOWN_DEPTS.has(upperCell) && dept === 'CSE') {
        dept = upperCell;
        continue;
      }

      if (!rawMentor) {
        if (isLikelyMentorName(cell, effectiveStaffList)) {
          rawMentor = cell;
          continue;
        }
      }

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

      if (
        !name &&
        /^[A-Za-z\s.'()_-]{3,60}$/.test(cell) &&
        !isLikelyMentorName(cell, effectiveStaffList) &&
        !cell.includes('http') &&
        !cell.includes('leetcode')
      ) {
        name = cell;
        continue;
      }
    }

    const cleanRegNo = regNo.trim().toUpperCase();

    // Extract DOB embedded in parentheses like "SARAVANAKUMAR V (07.12.2005)"
    if (name) {
      const nameDobMatch = name.match(/\(?\s*(?:dob[:\s]*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*\)?/i);
      if (nameDobMatch && !dob) {
        dob = nameDobMatch[1].replace(/[-/]/g, '.');
      }
    }

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
      validationError = 'Missing LeetCode Handle / Profile URL';
    }

    // Deduplication within uploaded sheet
    if (cleanRegNo && isValid) {
      if (seenRegNumbers.has(cleanRegNo)) {
        duplicateCount++;
        return; // Exclude duplicates automatically
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

  // Disambiguate identical names with DOB or last 4 digits of register number
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
    headerRowIndex,
    availableColumns,
    activeMapping,
  };
}

/**
 * Generates a clean sample CSV template for faculty download.
 */
export function generateSampleStudentCSV(): string {
  const headers = ['Register Number', 'Student Name', 'Department', 'Section', 'Study Year', 'Mentor Name', 'LeetCode Profile URL'];
  const sampleRows = [
    ['814723104001', 'AADEESH C', 'CSE', 'A', '1st Year', 'Mr. Shyam Sundar', 'https://leetcode.com/u/Aadeesh-12'],
    ['814723104002', 'AARTHI S', 'CSE', 'A', '1st Year', 'Mrs. K. Devi', 'https://leetcode.com/u/aarthi_46/'],
    ['814723104034', 'DHIPAK S', 'CSE', 'B', '2nd Year', 'Dr. A. Muthuraj', 'https://leetcode.com/u/Dhipak_S/'],
    ['814723104042', 'GOKULRAM V', 'CSE', 'B', '2nd Year', 'Dr. A. Muthuraj', 'https://leetcode.com/u/Gokulram_V/'],
    ['814723104029', 'CHANDRU M', 'CSE', 'A', '2nd Year', 'Mr. Shyam Sundar', 'https://leetcode.com/u/Chandrum06/'],
  ];

  return [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
}

export function downloadSampleCSVFile(): void {
  const csvContent = generateSampleStudentCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student_import_sample_template.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Generates and downloads a clean sample Excel workbook (.xlsx).
 */
export function downloadSampleExcelFile(): void {
  const headers = ['Register Number', 'Student Name', 'Department', 'Section', 'Study Year', 'Mentor Name', 'LeetCode Profile URL'];
  const sampleRows = [
    ['814723104001', 'AADEESH C', 'CSE', 'A', '1st Year', 'Mr. Shyam Sundar', 'https://leetcode.com/u/Aadeesh-12'],
    ['814723104002', 'AARTHI S', 'CSE', 'A', '1st Year', 'Mrs. K. Devi', 'https://leetcode.com/u/aarthi_46/'],
    ['814723104034', 'DHIPAK S', 'CSE', 'B', '2nd Year', 'Dr. A. Muthuraj', 'https://leetcode.com/u/Dhipak_S/'],
    ['814723104042', 'GOKULRAM V', 'CSE', 'B', '2nd Year', 'Dr. A. Muthuraj', 'https://leetcode.com/u/Gokulram_V/'],
    ['814723104029', 'CHANDRU M', 'CSE', 'A', '2nd Year', 'Mr. Shyam Sundar', 'https://leetcode.com/u/Chandrum06/'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, 'student_import_sample_template.xlsx');
}
