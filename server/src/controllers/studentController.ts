import { Response } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import * as studentService from '../services/studentService.js';
import * as importService from '../services/studentImportService.js';
import {
  isStaffAuthorizedForStudent,
  isStaffAuthorizedForSection,
} from '../services/studentAuthorizationService.js';
import { syncStudentLeetCode } from '../services/leetcodeService.js';
import { syncAllActiveGoogleSheets } from '../services/googleSheetsService.js';
import { checkAndTriggerLazyCatchUpSync } from '../services/cronService.js';

export async function getStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Lazy automatic snapshot catch-up check
    checkAndTriggerLazyCatchUpSync().catch(() => {});

    const { batchId, sectionId, department, search, allocationBatchId, subBatch, mentorId, currentYear, year } = req.query;

    const students = await studentService.getStudentsForUser(
      { userId: req.user.userId, role: req.user.role },
      {
        batchId: batchId as string | undefined,
        sectionId: sectionId as string | undefined,
        department: department as string | undefined,
        search: search as string | undefined,
        allocationBatchId: (allocationBatchId || subBatch) as string | undefined,
        mentorId: mentorId as string | undefined,
        currentYear: (currentYear || year) as string | undefined,
      }
    );

    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve students' });
  }
}

export async function getStudentDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;

    let student = await studentService.getStudentByIdForUser(
      { userId: req.user.userId, role: req.user.role },
      studentId
    );

    // If student has leetcode_username and no snapshots, automatically fetch LeetCode and snapshot immediately
    if (student && student.leetcode_username && (!student.snapshots || student.snapshots.length === 0)) {
      try {
        console.log(`[Auto-Snapshot] On-demand snapshot initialization for student ${student.name} (@${student.leetcode_username})`);
        await syncStudentLeetCode(studentId, { userId: req.user.userId, role: req.user.role as UserRole });
        const refreshed = await studentService.getStudentByIdForUser(
          { userId: req.user.userId, role: req.user.role },
          studentId
        );
        if (refreshed) {
          student = refreshed;
        }
      } catch (err: any) {
        console.warn(`[Auto-Snapshot] On-demand snapshot init note:`, err?.message || err);
      }
    }

    res.status(200).json({ student });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to retrieve student detail' });
  }
}

export async function createStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { register_number, name, department, batch_id, section_id, leetcode_username, mentor_id: body_mentor_id, sub_batch, allocation_batch_id, current_year } = req.body;
    let mentor_id = body_mentor_id;
    if (!mentor_id && req.user.role === 'STAFF') {
      mentor_id = req.user.userId;
    }

    if (!register_number || !name || !department || !batch_id || !section_id || !leetcode_username?.trim()) {
      res.status(400).json({ error: 'register_number, name, department, batch_id, section_id, and leetcode_username are required' });
      return;
    }

    // STAFF scope enforcement: validate the target section is within their responsibility
    if (req.user.role === 'STAFF') {
      const authorized = await isStaffAuthorizedForSection(req.user.userId, section_id);
      if (!authorized) {
        res.status(403).json({ error: 'Forbidden: You are not authorized to create students in this section' });
        return;
      }
    }

    let student = await studentService.createStudent({
      register_number,
      name,
      department,
      batch_id,
      section_id,
      sub_batch,
      allocation_batch_id,
      current_year,
      leetcode_username,
      mentor_id,
    });

    if (student && student.leetcode_username) {
      const authUser = { userId: req.user.userId, role: req.user.role as UserRole };
      try {
        console.log(`[Auto-Sync] Automatically fetching initial LeetCode details & snapshot for new student ${student.name} (@${student.leetcode_username})...`);
        await syncStudentLeetCode(student.id, authUser);

        // Refresh student record with newly generated snapshot
        const refreshed = await studentService.getStudentByIdForUser(authUser, student.id);
        if (refreshed) {
          student = refreshed;
        }
      } catch (syncErr: any) {
        console.warn(`[Auto-Sync] Initial LeetCode sync for new student ${student.id} (${student.leetcode_username}) note:`, syncErr?.message || syncErr);
      }

      // Automatically sync all active Google Sheets with the new student and their snapshot
      syncAllActiveGoogleSheets().catch((sheetErr: any) => {
        console.warn(`[Auto-Sync] Google Sheet auto-sync on student create note:`, sheetErr?.message || sheetErr);
      });
    }

    res.status(201).json({ message: 'Student created successfully with initial LeetCode snapshot synced', student });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to create student' });
  }
}

export async function updateStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;
    const { register_number, name, department, batch_id, section_id, leetcode_username, mentor_id, sub_batch, allocation_batch_id, current_year } = req.body;

    // STAFF scope enforcement: must own the student, and destination section (if changing) must also be authorized
    if (req.user.role === 'STAFF') {
      const ownsStudent = await isStaffAuthorizedForStudent(req.user.userId, studentId);
      if (!ownsStudent) {
        res.status(403).json({ error: 'Forbidden: You are not authorized to update this student' });
        return;
      }

      // If changing section, validate that the destination section is also within scope
      if (section_id) {
        const authorizedDest = await isStaffAuthorizedForSection(req.user.userId, section_id);
        if (!authorizedDest) {
          res.status(403).json({ error: 'Forbidden: You are not authorized to move students to this section' });
          return;
        }
      }
    }

    let student = await studentService.updateStudent(studentId, {
      register_number,
      name,
      department,
      batch_id,
      section_id,
      leetcode_username,
      mentor_id,
      sub_batch,
      allocation_batch_id,
      current_year,
    });

    if (student && student.leetcode_username) {
      const authUser = { userId: req.user.userId, role: req.user.role as UserRole };
      try {
        console.log(`[Auto-Sync] Automatically syncing LeetCode details & snapshot for student ${student.name} (@${student.leetcode_username})...`);
        await syncStudentLeetCode(student.id, authUser);

        const refreshed = await studentService.getStudentByIdForUser(authUser, student.id);
        if (refreshed) {
          student = refreshed;
        }
      } catch (syncErr: any) {
        console.warn(`[Auto-Sync] LeetCode sync for updated student ${student.id} (${student.leetcode_username}) note:`, syncErr?.message || syncErr);
      }

      // Automatically update linked Google Sheets with the updated student and snapshot
      syncAllActiveGoogleSheets().catch((sheetErr: any) => {
        console.warn(`[Auto-Sync] Google Sheet auto-sync on student update note:`, sheetErr?.message || sheetErr);
      });
    }

    res.status(200).json({ message: 'Student updated successfully with LeetCode snapshot synced', student });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to update student' });
  }
}

export async function deleteStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;

    // STAFF scope enforcement: must own the student
    if (req.user.role === 'STAFF') {
      const ownsStudent = await isStaffAuthorizedForStudent(req.user.userId, studentId);
      if (!ownsStudent) {
        res.status(403).json({ error: 'Forbidden: You are not authorized to delete this student' });
        return;
      }
    }

    const result = await studentService.deleteStudent(studentId);
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to delete student' });
  }
}

export async function bulkDeleteStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ error: 'studentIds array is required' });
      return;
    }

    // STAFF scope enforcement: must be authorized for all specified student IDs
    if (req.user.role === 'STAFF') {
      for (const id of studentIds) {
        const ownsStudent = await isStaffAuthorizedForStudent(req.user.userId, id);
        if (!ownsStudent) {
          res.status(403).json({ error: 'Forbidden: You are not authorized to delete one or more selected students' });
          return;
        }
      }
    }

    const result = await studentService.bulkDeleteStudents(studentIds);
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to delete selected students' });
  }
}

export async function bulkImportStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { students, targetScope } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'students array is required' });
      return;
    }

    const result = await importService.bulkImportStudents(
      { students, targetScope },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to bulk import students' });
  }
}

