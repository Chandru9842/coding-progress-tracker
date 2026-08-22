import { Response } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import * as studentService from '../services/studentService.js';
import {
  isStaffAuthorizedForStudent,
  isStaffAuthorizedForSection,
} from '../services/studentAuthorizationService.js';
import { syncStudentLeetCode } from '../services/leetcodeService.js';

export async function getStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { batchId, sectionId, department, search, allocationBatchId, subBatch, mentorId } = req.query;

    const students = await studentService.getStudentsForUser(
      { userId: req.user.userId, role: req.user.role },
      {
        batchId: batchId as string | undefined,
        sectionId: sectionId as string | undefined,
        department: department as string | undefined,
        search: search as string | undefined,
        allocationBatchId: (allocationBatchId || subBatch) as string | undefined,
        mentorId: mentorId as string | undefined,
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

    const student = await studentService.getStudentByIdForUser(
      { userId: req.user.userId, role: req.user.role },
      studentId
    );

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
      setImmediate(() => {
        syncStudentLeetCode(student.id, authUser).catch((syncErr: any) => {
          console.warn(`Automatic initial LeetCode sync for new student ${student.id} (${student.leetcode_username}) warned:`, syncErr.message);
        });
      });
    }

    res.status(201).json({ message: 'Student created successfully', student });
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

    const student = await studentService.updateStudent(studentId, {
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
      setImmediate(() => {
        syncStudentLeetCode(student.id, authUser).catch((syncErr: any) => {
          console.warn(`Automatic LeetCode sync for updated student ${student.id} (${student.leetcode_username}) warned:`, syncErr.message);
        });
      });
    }

    res.status(200).json({ message: 'Student updated successfully', student });
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

