import { prisma } from '../../db/client.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import * as batchService from '../../services/batchService.js';
import * as staffService from '../../services/staffService.js';
import { bulkImportStudents, findBestStaffMatch } from '../../services/studentImportService.js';
import { analyzeAndParseStudents } from '../../utils/studentImportUtils.js';

export async function runMultiMentorBulkImportTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Multi-Mentor Bulk Import Test Suite ---');

    // 1. Setup 3 Staff Mentors
    const mentor1 = await staffService.createStaff({
      name: 'Dr. A. Muthuraj',
      email: `muthuraj_${Date.now()}@college.edu`,
      password: 'StaffPass123!',
    });

    const mentor2 = await staffService.createStaff({
      name: 'Mrs. K. Devi',
      email: `devi_${Date.now()}@college.edu`,
      password: 'StaffPass123!',
    });

    const mentor3 = await staffService.createStaff({
      name: 'Mr. Shyam Sundar',
      email: `shyam_${Date.now()}@college.edu`,
      password: 'StaffPass123!',
    });

    const staffList = [
      { id: mentor1.id, name: mentor1.name, role: 'STAFF' },
      { id: mentor2.id, name: mentor2.name, role: 'STAFF' },
      { id: mentor3.id, name: mentor3.name, role: 'STAFF' },
    ];

    details.push('Pass: Created 3 distinct staff mentors (Dr. A. Muthuraj, Mrs. K. Devi, Mr. Shyam Sundar).');

    // 2. Setup Academic Batch & Section
    const batch = await batchService.createBatch({
      batch_name: '2024-2028 CSE Multi-Mentor Batch',
      start_year: 2024,
      end_year: 2028,
      department: 'CSE',
    });

    const section = await batchService.createSection(batch.id, 'CSE-A');
    details.push('Pass: Created target Academic Batch and Section.');

    // 3. Create simulated multi-mentor Excel/CSV content (60 students across 3 mentors)
    const rows: string[] = [];
    rows.push('S.No,Register Number,Student Name,Mentor Name,Section,LeetCode Username');
    
    // 20 students for Dr. A. Muthuraj
    for (let i = 1; i <= 20; i++) {
      const reg = `9536241040${i < 10 ? '0' + i : i}`;
      rows.push(`${i},${reg},Muthu Student ${i},Dr. A. Muthuraj,CSE-A,test_muthu_${i}`);
    }
    // 20 students for Mrs. K. Devi
    for (let i = 21; i <= 40; i++) {
      const reg = `9536241040${i}`;
      rows.push(`${i},${reg},Devi Student ${i},Mrs. K. Devi,CSE-A,test_devi_${i}`);
    }
    // 20 students for Mr. Shyam Sundar
    for (let i = 41; i <= 60; i++) {
      const reg = `9536241040${i}`;
      rows.push(`${i},${reg},Shyam Student ${i},Mr. Shyam Sundar,CSE-A,test_shyam_${i}`);
    }

    const rawCsvText = rows.join('\n');

    // Test Case 1: Dynamic Parsing & Fuzzy Mentor Match
    const parseResult = analyzeAndParseStudents(rawCsvText);
    if (parseResult.rows.length !== 60) {
      throw new Error(`Expected 60 parsed rows, got ${parseResult.rows.length}`);
    }
    if (parseResult.detectedMentors.length !== 3) {
      throw new Error(`Expected 3 detected mentors, got ${parseResult.detectedMentors.length}: ${JSON.stringify(parseResult.detectedMentors)}`);
    }

    const match1 = findBestStaffMatch('Dr. A. Muthuraj', staffList.map(s => ({ id: s.id, name: s.name, email: `${s.name}@college.edu` })));
    const match2 = findBestStaffMatch('Mrs. K. Devi', staffList.map(s => ({ id: s.id, name: s.name, email: `${s.name}@college.edu` })));
    const match3 = findBestStaffMatch('Mr. Shyam Sundar', staffList.map(s => ({ id: s.id, name: s.name, email: `${s.name}@college.edu` })));

    if (!match1 || match1 !== mentor1.id) throw new Error('Failed to match Dr. A. Muthuraj to staff');
    if (!match2 || match2 !== mentor2.id) throw new Error('Failed to match Mrs. K. Devi to staff');
    if (!match3 || match3 !== mentor3.id) throw new Error('Failed to match Mr. Shyam Sundar to staff');

    details.push('Pass: Parsed 60 rows and accurately matched all 3 mentors to their staff IDs.');

    // Test Case 2: Selective Import of ONE Mentor's students (Dr. A. Muthuraj)
    // Filter down to Muthuraj's rows only
    const muthurajRows = parseResult.rows.filter((r) => r.cleanMentor === 'Dr. A. Muthuraj');
    if (muthurajRows.length !== 20) {
      throw new Error(`Expected 20 students for Muthuraj, found ${muthurajRows.length}`);
    }

    const adminUser = { userId: 'admin_test_user', role: 'ADMIN' as const };
    const importRes = await bulkImportStudents(
      {
        students: muthurajRows.map((r) => ({
          register_number: r.cleanRegisterNumber,
          name: r.name,
          department: 'CSE',
          batch_id: batch.id,
          section_id: section.id,
          leetcode_username: r.cleanLeetCode,
          mentor_name: r.cleanMentor,
          mentor_id: mentor1.id,
        })),
        targetScope: {
          batch_id: batch.id,
          section_id: section.id,
          mentor_id: mentor1.id,
        },
      },
      adminUser
    );

    if (importRes.createdCount !== 20) {
      throw new Error(`Expected 20 created students, got ${importRes.createdCount}`);
    }
    details.push('Pass: Successfully imported ONLY Dr. A. Muthuraj\'s 20 students.');

    // Verify in database / store that Muthuraj has exactly 20 students and others have 0
    if (!process.env.DATABASE_URL) {
      const muthurajAssignments = inMemoryStore.staffStudentAssignments.filter(
        (a) => a.staff_id === mentor1.id
      );
      const deviAssignments = inMemoryStore.staffStudentAssignments.filter(
        (a) => a.staff_id === mentor2.id
      );
      const shyamAssignments = inMemoryStore.staffStudentAssignments.filter(
        (a) => a.staff_id === mentor3.id
      );

      if (muthurajAssignments.length !== 20) {
        throw new Error(`Expected 20 assignments for Muthuraj, found ${muthurajAssignments.length}`);
      }
      if (deviAssignments.length !== 0 || shyamAssignments.length !== 0) {
        throw new Error(`Expected 0 assignments for Devi and Shyam, found Devi=${deviAssignments.length}, Shyam=${shyamAssignments.length}`);
      }
    } else {
      const muthurajAssignments = await prisma.staffStudentAssignment.findMany({
        where: { staff_id: mentor1.id },
      });
      const deviAssignments = await prisma.staffStudentAssignment.findMany({
        where: { staff_id: mentor2.id },
      });
      if (muthurajAssignments.length !== 20) {
        throw new Error(`Expected 20 assignments for Muthuraj in DB, found ${muthurajAssignments.length}`);
      }
      if (deviAssignments.length !== 0) {
        throw new Error(`Expected 0 assignments for Devi in DB, found ${deviAssignments.length}`);
      }
    }
    details.push('Pass: Verified database integrity: Muthuraj has 20 students, other mentors have 0.');

    // Test Case 3: Import the remaining students (40 students belonging to Devi & Shyam)
    const remainingRows = parseResult.rows.filter((r) => r.cleanMentor !== 'Dr. A. Muthuraj');
    const remainingImportRes = await bulkImportStudents(
      {
        students: remainingRows.map((r) => {
          let assignedStaffId = r.cleanMentor === 'Mrs. K. Devi' ? mentor2.id : mentor3.id;
          return {
            register_number: r.cleanRegisterNumber,
            name: r.name,
            department: 'CSE',
            batch_id: batch.id,
            section_id: section.id,
            leetcode_username: r.cleanLeetCode,
            mentor_name: r.cleanMentor,
            mentor_id: assignedStaffId,
          };
        }),
        targetScope: {
          batch_id: batch.id,
          section_id: section.id,
        },
      },
      adminUser
    );

    if (remainingImportRes.createdCount !== 40) {
      throw new Error(`Expected 40 created students for remaining import, got ${remainingImportRes.createdCount}`);
    }

    if (!process.env.DATABASE_URL) {
      const deviCount = inMemoryStore.staffStudentAssignments.filter((a) => a.staff_id === mentor2.id).length;
      const shyamCount = inMemoryStore.staffStudentAssignments.filter((a) => a.staff_id === mentor3.id).length;
      if (deviCount !== 20 || shyamCount !== 20) {
        throw new Error(`Expected 20 students each for Devi & Shyam, got Devi=${deviCount}, Shyam=${shyamCount}`);
      }
    } else {
      const deviCount = await prisma.staffStudentAssignment.count({ where: { staff_id: mentor2.id } });
      const shyamCount = await prisma.staffStudentAssignment.count({ where: { staff_id: mentor3.id } });
      if (deviCount !== 20 || shyamCount !== 20) {
        throw new Error(`Expected 20 students each for Devi & Shyam in DB, got Devi=${deviCount}, Shyam=${shyamCount}`);
      }
    }

    details.push('Pass: Successfully imported remaining 40 students with exact mentor-to-student assignments.');

    return {
      name: 'Multi-Mentor Bulk Import & Selective Mentor Import Test',
      passed: true,
      details,
    };
  } catch (err: any) {
    return {
      name: 'Multi-Mentor Bulk Import & Selective Mentor Import Test',
      passed: false,
      message: err.message,
      details,
    };
  }
}
