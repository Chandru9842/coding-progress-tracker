import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as batchService from '../services/batchService.js';
import { isStaffAuthorizedForBatch } from '../services/studentAuthorizationService.js';

export async function getBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let batches;
    if (req.user.role === 'ADMIN') {
      batches = await batchService.getAllBatches();
    } else {
      batches = await batchService.getBatchesForStaff(req.user.userId);
    }

    res.status(200).json({ batches });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve batches' });
  }
}

export async function createBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { batch_name, start_year, end_year, department } = req.body;

    if (!batch_name || !start_year || !end_year || !department) {
      res.status(400).json({ error: 'batch_name, start_year, end_year, and department are required' });
      return;
    }

    const batch = await batchService.createBatch({
      batch_name,
      start_year: Number(start_year),
      end_year: Number(end_year),
      department,
    });

    res.status(201).json({ message: 'Batch created successfully', batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create batch';
    res.status(400).json({ error: message });
  }
}

export async function updateBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;
    const { batch_name, start_year, end_year, department } = req.body;

    const batch = await batchService.updateBatch(batchId, {
      batch_name,
      start_year,
      end_year,
      department,
    });

    res.status(200).json({ message: 'Batch updated successfully', batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update batch';
    res.status(400).json({ error: message });
  }
}

export async function deleteBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;
    const result = await batchService.deleteBatch(batchId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete batch' });
  }
}

export async function getBatchDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { batchId } = req.params;

    if (req.user.role === 'STAFF') {
      const isAuthorized = await isStaffAuthorizedForBatch(req.user.userId, batchId);
      if (!isAuthorized) {
        res.status(403).json({ error: 'Forbidden: You are not authorized to view this batch' });
        return;
      }
    }

    const batch = await batchService.getBatchById(batchId);

    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    res.status(200).json({ batch });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve batch details' });
  }
}

export async function createSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Section name is required' });
      return;
    }

    const section = await batchService.createSection(batchId, name);
    res.status(201).json({ message: 'Section created successfully', section });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to create section' });
  }
}

export async function updateSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Section name is required' });
      return;
    }

    const section = await batchService.updateSection(sectionId, name);
    res.status(200).json({ message: 'Section updated successfully', section });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to update section' });
  }
}

export async function deleteSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;
    const result = await batchService.deleteSection(sectionId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
}

export async function getBatchSections(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;
    const sections = await batchService.getSectionsByBatch(batchId);
    res.status(200).json({ sections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve sections' });
  }
}

export async function getAllocationBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;
    const staffId = req.user?.role === 'STAFF' ? req.user.userId : undefined;
    const allocation_batches = await batchService.getAllocationBatchesBySection(sectionId, staffId);
    res.status(200).json({ allocation_batches });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve allocation batches' });
  }
}

export async function createAllocationBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Allocation batch name is required' });
      return;
    }

    const allocation_batch = await batchService.createAllocationBatch(sectionId, name.trim());
    res.status(201).json({ message: 'Allocation batch created successfully', allocation_batch });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to create allocation batch' });
  }
}

export async function updateAllocationBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { allocationBatchId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Allocation batch name is required' });
      return;
    }

    const allocation_batch = await batchService.updateAllocationBatch(allocationBatchId, name.trim());
    res.status(200).json({ message: 'Allocation batch updated successfully', allocation_batch });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ error: error.message || 'Failed to update allocation batch' });
  }
}

export async function deleteAllocationBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { allocationBatchId } = req.params;
    const result = await batchService.deleteAllocationBatch(allocationBatchId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete allocation batch' });
  }
}

export async function assignStudentsToAllocationBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sectionId, allocationBatchId } = req.params;
    const { student_ids } = req.body;

    if (!Array.isArray(student_ids)) {
      res.status(400).json({ error: 'student_ids must be an array' });
      return;
    }

    await batchService.assignStudentsToAllocationBatch(sectionId, allocationBatchId, student_ids);
    res.status(200).json({ message: 'Students assigned to allocation batch successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to assign students to allocation batch' });
  }
}
