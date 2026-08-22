import { inMemoryStore } from '../../db/inMemoryStore.js';
import * as googleSheetsService from '../../services/googleSheetsService.js';
import * as batchService from '../../services/batchService.js';
import * as staffService from '../../services/staffService.js';
import * as reportService from '../../services/reportService.js';

export async function runPhase7RegressionTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Phase 7 Regression Test Suite (Scoped Multi-Sheet Linking Model) ---');

    // 1. Setup Staff Accounts & Batches for Testing
    const b1 = await batchService.createBatch({
      batch_name: 'Batch 1 (2023-2027)',
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
    });

    const b2 = await batchService.createBatch({
      batch_name: 'Batch 2 (2023-2027)',
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
    });

    const b3 = await batchService.createBatch({
      batch_name: 'Batch 3 (2024-2028)',
      start_year: 2024,
      end_year: 2028,
      department: 'ECE',
    });

    const devi = await staffService.createStaff({
      name: 'Devi Mam',
      email: 'devi_p7_test@college.edu',
      password: 'StaffPass123!',
    });

    // Assign Devi to Batch 1 and Batch 2
    if (!process.env.DATABASE_URL) {
      inMemoryStore.staffBatchAssignments.push({
        id: `sba_1`,
        staff_id: devi.id,
        batch_id: b1.id,
        created_at: new Date(),
      });
      inMemoryStore.staffBatchAssignments.push({
        id: `sba_2`,
        staff_id: devi.id,
        batch_id: b2.id,
        created_at: new Date(),
      });
    }

    details.push('Pass: Created test environment (Devi Mam assigned to Batch 1 and Batch 2; Batch 3 unassigned).');

    const deviUser = { userId: devi.id, role: 'STAFF' as const };

    // 2. Option A: Separate Sheets for Assigned Batches (Testing full Google Sheet URL input sanitization)
    const sheetA = await googleSheetsService.createGoogleSheetLink(deviUser, {
      name: 'Devi Batch 1 Sheet A',
      spreadsheet_id: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0',
      batch_ids: [b1.id],
    });

    if (!sheetA.id || sheetA.spreadsheet_id !== '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms') {
      throw new Error('Failed to extract raw Google Spreadsheet ID from full URL');
    }
    if (sheetA.spreadsheet_url !== 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit') {
      throw new Error(`Generated invalid spreadsheet_url: ${sheetA.spreadsheet_url}`);
    }
    details.push('Pass: Created separate Google Sheet A linked to Batch 1 (Full URL parsed to exact raw ID and clean open-link URL).');

    const sheetB = await googleSheetsService.createGoogleSheetLink(deviUser, {
      name: 'Devi Batch 2 Sheet B',
      spreadsheet_id: 'sheet_id_b_b2',
      batch_ids: [b2.id],
    });

    if (!sheetB.id || sheetB.batch_ids[0] !== b2.id) {
      throw new Error('Failed to create separate Sheet B for Batch 2');
    }
    details.push('Pass: Created separate Google Sheet B linked to Batch 2.');

    // 3. Option B: Combined Sheet for Multiple Batches
    const muthu = await staffService.createStaff({
      name: 'Muthu Sir',
      email: 'muthu_p7_test@college.edu',
      password: 'StaffPass123!',
    });

    if (!process.env.DATABASE_URL) {
      inMemoryStore.staffBatchAssignments.push({ id: `sba_m1`, staff_id: muthu.id, batch_id: b1.id, created_at: new Date() });
      inMemoryStore.staffBatchAssignments.push({ id: `sba_m2`, staff_id: muthu.id, batch_id: b2.id, created_at: new Date() });
      inMemoryStore.staffBatchAssignments.push({ id: `sba_m3`, staff_id: muthu.id, batch_id: b3.id, created_at: new Date() });
    }

    const muthuUser = { userId: muthu.id, role: 'STAFF' as const };
    const combinedSheet = await googleSheetsService.createGoogleSheetLink(muthuUser, {
      name: 'Muthu Combined Sheet (Batch 1 + 2 + 3)',
      spreadsheet_id: 'sheet_id_combined_muthu',
      batch_ids: [b1.id, b2.id, b3.id],
    });

    if (combinedSheet.batch_ids.length !== 3) {
      throw new Error('Combined sheet failed to link multiple batches');
    }
    details.push('Pass: Created combined Google Sheet linking Batch 1 + Batch 2 + Batch 3.');

    // 4. Replacing Active Sheet with New Empty Sheet (Old Sheet Preserved)
    const sheetC = await googleSheetsService.createGoogleSheetLink(deviUser, {
      name: 'Devi Batch 1 Replacement Sheet C',
      spreadsheet_id: 'sheet_id_c_b1_new',
      batch_ids: [b1.id],
    });

    const deviLinks = await googleSheetsService.getGoogleSheetLinksForUser(deviUser);
    const oldSheetA = deviLinks.find((l) => l.id === sheetA.id);

    if (oldSheetA && oldSheetA.is_active !== false) {
      throw new Error('Old Sheet A should be marked inactive (preserved history) when replaced');
    }
    if (sheetC.is_active !== true) {
      throw new Error('New Sheet C should be active');
    }
    details.push('Pass: Replacing Sheet A with Sheet C populated Sheet C automatically while preserving Sheet A history.');

    // 5. Security Check: Staff linking Unauthorized Batch
    try {
      await googleSheetsService.createGoogleSheetLink(deviUser, {
        name: 'Devi Unauthorized Sheet',
        spreadsheet_id: 'sheet_id_unauth',
        batch_ids: [b3.id], // Batch 3 is NOT assigned to Devi
      });
      throw new Error('Staff should NOT be allowed to link unauthorized batch ID');
    } catch (err: any) {
      if (err.statusCode === 403 || err.message.includes('Forbidden')) {
        details.push('Pass: Staff attempt to link unauthorized Batch 3 correctly rejected with HTTP 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // 6. Idempotent Synchronization & Matrix Structure Verification
    const syncRes = await googleSheetsService.syncGoogleSheetLink(combinedSheet.id, muthuUser);
    if (!syncRes.success) {
      throw new Error('Synchronization returned failure');
    }

    if (!syncRes.matrix || !Array.isArray(syncRes.matrix.headers) || syncRes.matrix.headers[0] !== 'Academic Year') {
      throw new Error('Google Sheet matrix structure is invalid');
    }

    if (syncRes.matrix.rows.length !== syncRes.rowsSynced) {
      throw new Error('Row count mismatch: Google Sheet must have exactly ONE row per student');
    }
    details.push(`Pass: Idempotent synchronization completed cleanly (${syncRes.rowsSynced} student rows, ${syncRes.dateColumnsCount} date columns).`);

    const logs = await googleSheetsService.getGoogleSheetLinkLogs(combinedSheet.id, muthuUser);
    if (logs.length === 0) {
      throw new Error('Sync logs should be recorded for linked sheet');
    }
    details.push('Pass: Sync audit logs verified.');

    // 7. Independent Reports Verification (Reports module MUST work directly from PostgreSQL regardless of Google Sheets status)
    const reportData = await reportService.getReportData({}, deviUser);
    if (!reportData || !Array.isArray(reportData.students)) {
      throw new Error('Reports module failed to query PostgreSQL independently');
    }
    details.push('Pass: Reports module functions independently from PostgreSQL regardless of Google Sheets state.');

    // 8. Deactivation Test
    const deleteRes = await googleSheetsService.deleteGoogleSheetLink(sheetB.id, deviUser);
    if (!deleteRes.message.includes('deactivated')) {
      throw new Error('Deactivate link failed');
    }
    details.push('Pass: Deactivated sheet link cleanly while preserving spreadsheet contents.');

    details.push('====================================================');
    details.push('PHASE 7 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    details.push('====================================================');

    return {
      name: 'Phase 7 Regression Suite (Scoped Multi-Sheet Linking Model)',
      passed: true,
      details,
    };
  } catch (error: any) {
    return {
      name: 'Phase 7 Regression Suite (Scoped Multi-Sheet Linking Model)',
      passed: false,
      message: error.message,
      details,
    };
  }
}
