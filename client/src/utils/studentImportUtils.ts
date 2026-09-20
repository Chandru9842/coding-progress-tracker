/**
 * Utility functions for parsing CSV files, auto-detecting student details,
 * cleaning LeetCode profile URLs, and handling mentor filtering.
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
  let str = input.trim();
  if (!str) return '';

  // Remove leading @
  if (str.startsWith('@')) {
    str = str.substring(1).trim();
  }

  // Remove query params and hash
  str = str.split('?')[0].split('#')[0].trim();

  // If full URL
  if (str.includes('leetcode.com') || str.includes('leetcode.cn')) {
    // Replace trailing slashes
    str = str.replace(/\/+$/, '');
    const parts = str.split('/').filter(Boolean);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      // Sometimes URLs have /u/_/username/
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

    // Only keep rows that have at least 1 non-empty cell
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
    return { rows: [], detectedMentors: [], detectedYears: [], detectedSections: [], totalParsed: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, hasHeaders: false };
  }

  // Filter out pure comment lines (e.g. starting with # or //)
  const nonCommentLines = lines.filter((l) => {
    const firstNonEmpty = l.find((c) => c.trim().length > 0);
    return firstNonEmpty && !firstNonEmpty.startsWith('#') && !firstNonEmpty.startsWith('//');
  });

  if (nonCommentLines.length === 0) {
    return { rows: [], detectedMentors: [], detectedYears: [], detectedSections: [], totalParsed: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, hasHeaders: false };
  }

  // Check if first line contains header keywords (never misidentify data rows with URLs or register numbers)
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
    firstLineStr.includes('leetcode') ||
    firstLineStr.includes('mentor') ||
    firstLineStr.includes('faculty') ||
    firstLineStr.includes('advisor') ||
    firstLineStr.includes('staff name');

  const hasHeaders = !containsUrl && !containsRegNo && hasHeaderKeywords;

  // Header column index detection (exact position mapping)
  let regNoCol = -1;
  let nameCol = -1;
  let deptCol = -1;
  let secCol = -1;
  let mentorCol = -1;
  let leetcodeCol = -1;
  let yearCol = -1;
  let studyYearCol = -1;
  let dobCol = -1;
  let solvedCol = -1;

  if (hasHeaders) {
    firstLine.forEach((h, idx) => {
      const hClean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (regNoCol === -1 && (hClean.includes('reg') || hClean.includes('roll') || hClean.includes('usn') || hClean === 'rno' || hClean.includes('regno') || hClean.includes('registernumber') || hClean.includes('studentreg'))) {
        regNoCol = idx;
      } else if (nameCol === -1 && (hClean.includes('studentname') || hClean.includes('candidatename') || hClean === 'name' || hClean.includes('fullname') || hClean.includes('nameofstudent'))) {
        nameCol = idx;
      } else if (mentorCol === -1 && (hClean.includes('mentor') || hClean.includes('faculty') || hClean.includes('staff') || hClean.includes('advisor') || hClean.includes('guide') || hClean.includes('tutor') || hClean.includes('incharge') || hClean.includes('counselor'))) {
        mentorCol = idx;
      } else if (leetcodeCol === -1 && (hClean.includes('leetcode') || hClean.includes('handle') || hClean.includes('profile') || hClean.includes('username') || hClean === 'lc' || hClean.includes('lcurl') || hClean.includes('profileurl'))) {
        leetcodeCol = idx;
      } else if (deptCol === -1 && (hClean.includes('dept') || hClean.includes('department') || hClean.includes('branch'))) {
        deptCol = idx;
      } else if (secCol === -1 && (hClean.includes('sec') || hClean.includes('section'))) {
        secCol = idx;
      } else if (studyYearCol === -1 && (hClean.includes('studyyear') || hClean.includes('currentyear') || hClean === 'year' || hClean === 'class')) {
        studyYearCol = idx;
      } else if (yearCol === -1 && (hClean.includes('academicyear') || hClean.includes('batchyear') || hClean.includes('batch'))) {
        yearCol = idx;
      } else if (dobCol === -1 && (hClean.includes('dob') || hClean.includes('birth') || hClean.includes('dateofbirth'))) {
        dobCol = idx;
      } else if (solvedCol === -1 && (hClean.includes('solved') || hClean.includes('problems') || hClean.includes('score') || hClean.includes('count'))) {
        solvedCol = idx;
      }
    });
  }

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

    // Fast-path: If columns mapped from header, extract them directly
    if (hasHeaders) {
      if (regNoCol >= 0 && cells[regNoCol]) {
        const val = cells[regNoCol].replace(/\s+/g, '');
        if (val.length >= 8 && /\d/.test(val) && !val.includes('/')) {
          regNo = val.toUpperCase();
        }
      }
      if (nameCol >= 0 && cells[nameCol]) {
        name = cells[nameCol].trim();
      }
      if (mentorCol >= 0 && cells[mentorCol]) {
        const mVal = cells[mentorCol].trim();
        if (mVal && !mVal.includes('leetcode') && !/^\d{8,}$/.test(mVal)) {
          rawMentor = mVal;
        }
      }
      if (leetcodeCol >= 0 && cells[leetcodeCol]) {
        leetcodeUrl = cells[leetcodeCol].trim();
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
      if (studyYearCol >= 0 && cells[studyYearCol]) {
        currentYear = cells[studyYearCol].trim();
        yearSet.add(currentYear);
      }
      if (yearCol >= 0 && cells[yearCol]) {
        academicYear = cells[yearCol].trim().replace(/\s+/g, '').replace('/', '-');
        yearSet.add(academicYear);
      }
      if (dobCol >= 0 && cells[dobCol]) {
        const dVal = cells[dobCol].trim();
        const dateMatch = dVal.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/) || dVal.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
        if (dateMatch) dob = dateMatch[1].replace(/[-/]/g, '.');
      }
      if (solvedCol >= 0 && cells[solvedCol]) {
        const num = parseInt(cells[solvedCol].replace(/\D/g, ''), 10);
        if (!isNaN(num)) solvedCount = num;
      }
    }

    // Search cells by pattern
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]?.trim() || '';
      if (!cell) continue;

      // 1. Check for LeetCode URL or username
      if (cell.includes('leetcode.com') || cell.includes('leetcode.cn') || cell.startsWith('@')) {
        leetcodeUrl = cell;
        continue;
      }

      // 2. Check for Academic Year range (e.g. 2023-2027, 2024-2028)
      if (!academicYear && /^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(cell)) {
        academicYear = cell.replace(/\s+/g, '').replace('/', '-');
        yearSet.add(academicYear);
        continue;
      }

      // 3. Check for Study Year (e.g. 1st Year, 2nd Year, 3rd Year, 4th Year, II Year, III Year, IV Year)
      if (!currentYear && /^(1st|2nd|3rd|4th|I|II|III|IV)\s*year/i.test(cell)) {
        currentYear = cell.trim();
        yearSet.add(currentYear);
        continue;
      }

      // 4. Check for Section (e.g. Section A, Sec-B, A, B, C)
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

      // 5. Check for Register Number: 4-25 digits/characters with numbers (e.g. 814723104001, 21CS001, 717821P101, 21CS01)
      const digitsOnly = cell.replace(/\s+/g, '');
      if (!regNo && digitsOnly.length >= 4 && digitsOnly.length <= 25 && /^[0-9A-Za-z_-]+$/.test(digitsOnly) && /\d/.test(digitsOnly) && !cell.includes('/')) {
        regNo = digitsOnly.toUpperCase();
        continue;
      }

      // 6. Check for Department
      const upperCell = cell.toUpperCase();
      if (KNOWN_DEPTS.has(upperCell)) {
        dept = upperCell;
        continue;
      }

      // 7. Check for Mentor (starts with title prefix OR contains dot name e.g. chandru.m, muthuraj.a OR is mentor column)
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

      // 8. Check for Date of Birth in independent cell (e.g. 07.12.2005, 14/05/2006, 2005-12-07)
      if (!dob && !cell.includes('leetcode') && !/^(20\d\d)\s*[-/–]\s*(20\d\d)$/.test(cell)) {
        const dateMatch = cell.match(/(?:dob[:\s]*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i) || cell.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
        if (dateMatch) {
          const numDigits = cell.replace(/\D/g, '').length;
          if (numDigits >= 6 && numDigits <= 8) {
            dob = dateMatch[1].replace(/[-/]/g, '.');
          }
        }
      }

      // 9. Check for Solved Count integer
      if (solvedCount === undefined && /^\d+$/.test(cell) && parseInt(cell, 10) < 4000 && parseInt(cell, 10) > 0) {
        solvedCount = parseInt(cell, 10);
        continue;
      }

      // 10. Check for Student Name (alphabetic words, uppercase names like "AADEESH C", "SARAVANAKUMAR V")
      if (!name && /^[A-Za-z\s.'()_-]{3,60}$/.test(cell) && !/^(dr\.|mr\.|mrs\.|prof\.|er\.)/i.test(cell) && !cell.includes('http') && !cell.includes('leetcode')) {
        name = cell;
        continue;
      }
    }

    // Fallback based on fixed column positions if pattern matching missed
    if (!regNo && cells[1] && cells[1].trim().length >= 4 && !cells[1].includes('/')) {
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

    // Validation
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
        return; // Remove duplicate record immediately: do NOT add to import list!
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

/**
 * Generates a clean sample CSV template for faculty download.
 * Excludes extra personal info like phone numbers and reflects the strict sample intake schema.
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

  const csvContent = [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  return csvContent;
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

