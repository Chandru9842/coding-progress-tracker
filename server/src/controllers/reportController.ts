import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as reportService from '../services/reportService.js';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';

export async function getReportFilters(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const filtersData = await reportService.getReportFilters({
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json(filtersData);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to retrieve report filters' });
  }
}

export async function getReportData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      academicYear,
      department,
      batchId,
      sectionId,
      allocationBatchId,
      staffId,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      activityStatus,
    } = req.query;

    const data = await reportService.getReportData(
      {
        academicYear: academicYear as string,
        department: department as string,
        batchId: batchId as string,
        sectionId: sectionId as string,
        allocationBatchId: allocationBatchId as string,
        staffId: staffId as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        activityStatus: activityStatus as any,
      },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json(data);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to retrieve report data' });
  }
}

export async function getStudentDailyProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;
    const { fromDate, toDate } = req.query;

    const data = await reportService.getStudentDailyProgress(
      studentId,
      { userId: req.user.userId, role: req.user.role },
      { fromDate: fromDate as string, toDate: toDate as string }
    );

    res.status(200).json(data);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to retrieve student daily progress' });
  }
}

export async function exportCsvReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      academicYear,
      department,
      batchId,
      sectionId,
      allocationBatchId,
      staffId,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      activityStatus,
    } = req.body;

    const result = await reportService.exportCsvReport(
      {
        academicYear,
        department,
        batchId,
        sectionId,
        allocationBatchId,
        staffId,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
        activityStatus,
      },
      { userId: req.user.userId, role: req.user.role }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).send(result.csvContent);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to export CSV report' });
  }
}

export async function exportExcelReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      academicYear,
      department,
      batchId,
      sectionId,
      allocationBatchId,
      staffId,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      activityStatus,
    } = req.body;

    const result = await reportService.exportExcelReport(
      {
        academicYear,
        department,
        batchId,
        sectionId,
        allocationBatchId,
        staffId,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
        activityStatus,
      },
      { userId: req.user.userId, role: req.user.role }
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).send(Buffer.from(result.buffer));
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to export Excel report' });
  }
}

export async function generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { reportType, batchId, sectionId, fromDate, toDate } = req.body;

    const result = await reportService.generateReport(
      { reportType: reportType || 'SUMMARY', batchId, sectionId, fromDate, toDate },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json({
      message: 'Report generated successfully',
      report: result.report,
      fileName: result.fileName,
      totalRecords: result.totalRecords,
      csvContent: result.csvContent,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to generate report' });
  }
}

export async function listReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const reports = await reportService.listReportsForUser({
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve reports history' });
  }
}

export async function downloadReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { reportId } = req.params;
    let report: any = null;

    if (!process.env.DATABASE_URL) {
      report = inMemoryStore.generatedReports.find((r) => r.id === reportId);
    } else {
      report = await prisma.generatedReport.findUnique({
        where: { id: reportId },
      });
    }

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const isExcel = (report.file_name && report.file_name.endsWith('.xlsx')) || report.report_type === 'EXCEL';

    if (isExcel) {
      const result = await reportService.exportExcelReport(
        {
          batchId: report.batch_id || undefined,
          sectionId: report.section_id || undefined,
        },
        { userId: req.user.userId, role: req.user.role }
      );

      const downloadFileName = (report.file_name && report.file_name.endsWith('.xlsx'))
        ? report.file_name
        : result.fileName;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.status(200).send(Buffer.from(result.buffer));
    } else {
      const result = await reportService.exportCsvReport(
        {
          batchId: report.batch_id || undefined,
          sectionId: report.section_id || undefined,
        },
        { userId: req.user.userId, role: req.user.role }
      );

      const downloadFileName = (report.file_name && report.file_name.endsWith('.csv'))
        ? report.file_name
        : result.fileName;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.status(200).send(result.csvContent);
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to download report' });
  }
}

export async function deleteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reportService.deleteReport(req.params.reportId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to delete report audit entry' });
  }
}

export async function bulkDeleteReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { reportIds } = req.body;
    const result = await reportService.bulkDeleteReports(reportIds, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to bulk delete report audit entries' });
  }
}

export async function clearAllReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reportService.clearAllReports({
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to clear report audit history' });
  }
}
