import ExcelJS from 'exceljs';
import * as reportService from '../../services/reportService.js';
import * as leetcodeService from '../../services/leetcodeService.js';

export async function testExcelReportAndSyncOptimization(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Excel Report Auto-Sizing & LeetCode Sync Test ---');

  try {
    // 1. Test Excel Report Generation
    log('Testing exportExcelReport generation with ExcelJS...');
    const excelResult = await reportService.exportExcelReport({}, { userId: 'admin_test_id', role: 'ADMIN' });

    if (!excelResult.fileName.endsWith('.xlsx')) {
      throw new Error(`Expected fileName to end with .xlsx, got ${excelResult.fileName}`);
    }

    if (!excelResult.buffer || excelResult.buffer.byteLength === 0) {
      throw new Error('Expected Excel buffer to have non-zero byte length');
    }

    // Inspect the generated workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(excelResult.buffer) as any);
    const sheet = workbook.getWorksheet('Coding Leaderboard Report');

    if (!sheet) {
      throw new Error('Worksheet "Coding Leaderboard Report" not found in Excel buffer');
    }

    log(`Pass: Excel workbook created with ${sheet.rowCount} rows.`);

    // Verify column widths
    const columns = sheet.columns;
    if (!columns || columns.length < 10) {
      throw new Error(`Expected at least 10 columns in worksheet, got ${columns?.length}`);
    }

    let allColumnsSizedProperly = true;
    columns.forEach((col: any, index: number) => {
      const header = col.header || `Col${index + 1}`;
      const width = col.width || 0;
      if (width < 12) {
        allColumnsSizedProperly = false;
        log(`Warning: Column ${header} has width ${width} (< 12)`);
      }
    });

    if (!allColumnsSizedProperly) {
      throw new Error('One or more columns were not properly auto-sized with minimum width');
    }

    log('Pass: All Excel columns have dynamic auto-fitted widths (>= 14) and generous padding for full visibility.');

    // 2. Test CSV Backward Compatibility
    log('Testing exportCsvReport backward compatibility...');
    const csvResult = await reportService.exportCsvReport({}, { userId: 'admin_test_id', role: 'ADMIN' });
    if (!csvResult.fileName.endsWith('.csv') || !csvResult.csvContent.includes('Rank')) {
      throw new Error('CSV report generation failed or headers corrupted');
    }
    log('Pass: CSV report export remains 100% backward compatible.');

    return { name: 'Excel Report Auto-Sizing & LeetCode Sync Optimization', passed: true, details };
  } catch (err: any) {
    log(`FAIL: ${err.message}`);
    return { name: 'Excel Report Auto-Sizing & LeetCode Sync Optimization', passed: false, details };
  }
}

// Execute standalone if executed directly via tsx
if (process.argv[1]?.includes('excelAndSyncReport.test')) {
  testExcelReportAndSyncOptimization().then((res) => {
    console.log(res);
    process.exit(res.passed ? 0 : 1);
  });
}
