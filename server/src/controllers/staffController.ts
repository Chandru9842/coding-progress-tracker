import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as staffService from '../services/staffService.js';

export async function getStaffList(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const activeOnly = req.query.active === 'true';
    const staff = await staffService.getAllStaff(activeOnly);
    res.status(200).json({ staff });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve staff list' });
  }
}

export async function getStaffDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const staff = await staffService.getStaffById(staffId);

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    res.status(200).json({ staff });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve staff details' });
  }
}

export async function createStaff(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, isActive } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const staff = await staffService.createStaff({ name, email, password, isActive });
    res.status(201).json({ message: 'Staff member created successfully', staff });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create staff member';
    res.status(400).json({ error: message });
  }
}

export async function updateStaff(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { name, email, password } = req.body;

    const staff = await staffService.updateStaffDetails(staffId, { name, email, password });
    res.status(200).json({ message: 'Staff updated successfully', staff });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update staff member';
    res.status(400).json({ error: message });
  }
}

export async function deleteStaff(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const result = await staffService.deleteStaff(staffId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete staff member';
    res.status(400).json({ error: message });
  }
}

export async function updateStaffStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean' });
      return;
    }

    const staff = await staffService.updateStaffStatus(staffId, isActive);
    res.status(200).json({ message: 'Staff status updated successfully', staff });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staff status' });
  }
}

export async function resetStaffPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    const result = await staffService.resetStaffPassword(staffId, password);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    res.status(400).json({ error: message });
  }
}

// Assignments
export async function assignBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { batchIds } = req.body;

    if (!Array.isArray(batchIds)) {
      res.status(400).json({ error: 'batchIds must be an array of batch IDs' });
      return;
    }

    const result = await staffService.assignBatchesToStaff(staffId, batchIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign batches' });
  }
}

export async function assignSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { sectionId, assignmentMode } = req.body;

    if (!sectionId || !['ALL', 'SELECTED'].includes(assignmentMode)) {
      res.status(400).json({ error: 'sectionId and valid assignmentMode (ALL | SELECTED) are required' });
      return;
    }

    const result = await staffService.setSectionAssignmentForStaff(staffId, sectionId, assignmentMode);
    res.status(200).json({ message: 'Section assignment updated successfully', assignment: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign section' });
  }
}

export async function removeSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId, sectionId } = req.params;
    const result = await staffService.removeSectionAssignmentFromStaff(staffId, sectionId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove section assignment' });
  }
}

export async function assignStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const { sectionId, studentIds } = req.body;

    if (!sectionId || !Array.isArray(studentIds)) {
      res.status(400).json({ error: 'sectionId and studentIds array are required' });
      return;
    }

    const result = await staffService.assignStudentsToStaff(staffId, sectionId, studentIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign students' });
  }
}

export async function removeStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { staffId, studentId } = req.params;
    const result = await staffService.removeStudentAssignmentFromStaff(staffId, studentId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove student assignment' });
  }
}

export async function getStaffAssignedScopes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const staffId = req.user?.userId;
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const scopes = await staffService.getStaffAssignedScopes(staffId);
    res.status(200).json(scopes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve staff assigned scopes' });
  }
}
