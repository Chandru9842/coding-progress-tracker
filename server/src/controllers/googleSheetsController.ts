import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as googleSheetsService from '../services/googleSheetsService.js';

export async function getLinks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const links = await googleSheetsService.getGoogleSheetLinksForUser({
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json({ links });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch Google Sheet links' });
  }
}

export async function createLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const link = await googleSheetsService.createGoogleSheetLink(
      { userId: req.user.userId, role: req.user.role },
      req.body
    );
    res.status(201).json({ message: 'Google Sheet linked and initial data synchronized successfully', link });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to create Google Sheet link' });
  }
}

export async function getLinkDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const link = await googleSheetsService.getGoogleSheetLinkById(req.params.linkId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json({ link });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch Google Sheet link detail' });
  }
}

export async function triggerSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await googleSheetsService.syncGoogleSheetLink(req.params.linkId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json({ message: 'Google Sheet synchronization completed', data: result });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to synchronize Google Sheet' });
  }
}

export async function deleteLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const permanent = req.query.permanent === 'true';
    const result = await googleSheetsService.deleteGoogleSheetLink(
      req.params.linkId,
      {
        userId: req.user.userId,
        role: req.user.role,
      },
      permanent
    );
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to delete Google Sheet link' });
  }
}

export async function getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const logs = await googleSheetsService.getGoogleSheetLinkLogs(req.params.linkId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json({ logs });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch sync logs' });
  }
}

export async function updateLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const link = await googleSheetsService.updateGoogleSheetLink(
      req.params.linkId,
      { userId: req.user.userId, role: req.user.role },
      req.body
    );
    res.status(200).json({ message: 'Google Sheet link updated successfully', link });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to update Google Sheet link' });
  }
}

export async function triggerSyncAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await googleSheetsService.syncAllGoogleSheetLinks({
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json({ message: `Successfully synchronized ${result.successful} Google Sheet link(s)`, data: result });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to synchronize Google Sheets' });
  }
}

export async function getAutomationStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { getDailyAutomationStatus } = await import('../services/cronService.js');
    const status = getDailyAutomationStatus();
    res.status(200).json({ status });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve automation status' });
  }
}

export async function testWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await googleSheetsService.testGoogleSheetWebhook(req.params.linkId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to test Google Sheet webhook' });
  }
}

export async function runDailyAutomationNow(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { executeFullDailyReconciliation } = await import('../services/cronService.js');
    const summary = await executeFullDailyReconciliation(true);
    res.status(200).json({
      message: 'Zero-Error daily automation executed successfully across all students and sheets',
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to execute daily automation' });
  }
}

export async function getGoogleSheetsSyncStatusController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const syncStatus = await googleSheetsService.getGoogleSheetsSyncStatus({
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json(syncStatus);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve Google Sheets sync status' });
  }
}

