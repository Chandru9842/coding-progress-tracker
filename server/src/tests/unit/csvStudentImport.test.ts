import { analyzeAndParseStudents, extractCleanLeetCodeUsername, normalizeMentorName } from '../../utils/studentImportUtils.js';

const sampleUserData = `
57,814723104001,AADEESH C,CSE,Mr.Shyam Sundar,63801 99850,,https://leetcode.com/u/Aadeesh-12,254,124/111/19
58,814723104002,AARTHI S,CSE,Mrs.K.Devi,95003 34806,,https://leetcode.com/u/aarthi_46/,193,47/113/33
73,814723104020,ANISHKA P,CSE,Mrs.K.Devi,95003 34806,,https://leetcode.com/u/_/___Anishka__08/,,
82,814723104029,CHANDRU M,CSE,Mr.Shyam Sundar,63801 99850,,https://leetcode.com/u/Chandrum06/,259,101/144/14
87,814723104034,DHIPAK S,CSE,Dr.A.Muthuraj,9486715098,,https://leetcode.com/u/Dhipak_S/,58,34/18/6
92,814723104042,GOKULRAM V,CSE,Dr.A.Muthuraj,9486715098,,https://leetcode.com/u/Gokulram_V/,35,31/3/1
93,814723104043,GOWTHAM S,CSE,Dr.A.Muthuraj,9486715098,,https://leetcode.com/u/gowthams14/,123,62/46/15
,814723104301,Saravanakumar V,CSE,Dr.A.Muthuraj,9486715098,,https://leetcode.com/u/saravanakumar12345678/,58,14/30/14
120,814723104064,yugguguigu,cse,chandru.m,9789224484,,https://leetcode.com/u/Arularasan010/,,
121,814723104065,VIKRAM S,CSE,Mrs.K.Devi,95003 34806,2023-2027,https://leetcode.com/u/vikram_s/,120,2nd Year
`;

async function testSmartCSVImport() {
  console.log('--- Testing Smart CSV Auto-Detection & URL Extraction ---');

  // Test URL Extraction
  const u1 = extractCleanLeetCodeUsername('https://leetcode.com/u/Dhipak_S/');
  const u2 = extractCleanLeetCodeUsername('https://leetcode.com/u/_/___Anishka__08/');
  const u3 = extractCleanLeetCodeUsername('https://leetcode.com/u/Chandrum06/');
  const u4 = extractCleanLeetCodeUsername('@Aadeesh-12');
  
  if (u1 !== 'Dhipak_S') throw new Error(`Expected Dhipak_S, got ${u1}`);
  if (u2 !== '___Anishka__08') throw new Error(`Expected ___Anishka__08, got ${u2}`);
  if (u3 !== 'Chandrum06') throw new Error(`Expected Chandrum06, got ${u3}`);
  if (u4 !== 'Aadeesh-12') throw new Error(`Expected Aadeesh-12, got ${u4}`);
  console.log('✔ URL extraction verified for all patterns');

  // Test Parsing Full CSV Matrix
  const parsed = analyzeAndParseStudents(sampleUserData);
  console.log(`✔ Total Parsed: ${parsed.totalParsed}, Valid: ${parsed.validCount}`);
  console.log('✔ Detected Mentors:', parsed.detectedMentors);
  console.log('✔ Rows:', parsed.rows.map(r => ({ reg: r.cleanRegisterNumber, name: r.name, mentor: r.cleanMentor, year: r.academicYear, studyYear: r.currentYear, lc: r.cleanLeetCode })));

  if (!parsed.detectedMentors.includes('Chandru M')) {
    throw new Error('Expected "Chandru M" to be in detected mentors!');
  }

  const vikram = parsed.rows.find((r) => r.cleanRegisterNumber === '814723104065');
  if (!vikram || vikram.academicYear !== '2023-2027' || vikram.currentYear !== '2nd Year') {
    throw new Error('Failed to auto-detect academic year or study year for student Vikram S');
  }
  console.log('✔ Auto-detected academic year "2023-2027" and study year "2nd Year"');

  const chandruStudent = parsed.rows.find((r) => r.cleanRegisterNumber === '814723104064');
  if (!chandruStudent || chandruStudent.cleanMentor !== 'Chandru M' || chandruStudent.cleanLeetCode !== 'Arularasan010') {
    throw new Error('Failed to accurately parse student with mentor chandru.m');
  }
  console.log('✔ Verified detection of mentor "chandru.m" -> "Chandru M" and LeetCode handle "Arularasan010"');

  const muthurajStudents = parsed.rows.filter((r) => r.cleanMentor.includes('Muthuraj'));
  console.log(`✔ Muthuraj Students Count: ${muthurajStudents.length}`);
  if (muthurajStudents.length !== 4) {
    throw new Error(`Expected 4 Muthuraj students, got ${muthurajStudents.length}`);
  }

  const dhipak = muthurajStudents.find((s) => s.cleanRegisterNumber === '814723104034');
  if (!dhipak || dhipak.cleanLeetCode !== 'Dhipak_S' || dhipak.name !== 'DHIPAK S') {
    throw new Error('Failed to accurately parse student Dhipak S');
  }

  console.log('✔ All Smart CSV Import assertions passed cleanly!');
}

testSmartCSVImport().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
