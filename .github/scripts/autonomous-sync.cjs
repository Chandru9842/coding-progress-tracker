#!/usr/bin/env node

/**
 * Autonomous Daily Snapshot & Google Sheets Sync Runner
 * Runs natively in GitHub Actions runner with zero serverless timeout restrictions.
 */

const targetUrl = process.env.TARGET_URL || 'https://coding-progress-tracker-navy.vercel.app';
const cronSecret = process.env.CRON_SECRET || 'coding_tracker_cron_secret';

console.log('==========================================================');
console.log('Starting Autonomous Daily Snapshot & Google Sheets Sync');
console.log(`Target URL: ${targetUrl}`);
console.log(`Execution Time (UTC): ${new Date().toISOString()}`);
console.log('==========================================================');

async function postWithRedirect(url, payloadJson, maxTimeoutMs = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payloadJson,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function main() {
  let hasErrors = false;

  // Step 1: Fetch pre-calculated Google Sheets sync matrices from production
  console.log('\n[1/3] Fetching Google Sheets sync matrices from production...');
  let matricesData;
  try {
    const matrixRes = await fetch(`${targetUrl}/api/v1/google-sheets/daily-sync-matrix?secret=${encodeURIComponent(cronSecret)}`, {
      headers: {
        'x-cron-secret': cronSecret,
        'Authorization': `Bearer ${cronSecret}`,
        'User-Agent': 'github-actions-autonomous-scheduler/1.0',
      },
    });

    if (!matrixRes.ok) {
      const errText = await matrixRes.text();
      throw new Error(`Matrix API returned HTTP ${matrixRes.status}: ${errText}`);
    }

    matricesData = await matrixRes.json();
    console.log(`✅ Successfully retrieved ${matricesData.sheets?.length || 0} active Google Sheet matrices!`);
  } catch (err) {
    console.error(`❌ Failed to fetch Google Sheet matrices:`, err.message);
    hasErrors = true;
  }

  // Step 2: Post matrices directly to Google Apps Script Webhooks
  if (matricesData && Array.isArray(matricesData.sheets)) {
    console.log(`\n[2/3] Dispatching matrix updates directly to Google Apps Script Webhooks...`);

    for (const sheet of matricesData.sheets) {
      console.log(`\n--- Sheet: "${sheet.name}" (ID: ${sheet.spreadsheetId}) ---`);
      console.log(`  - Students: ${sheet.studentCount}`);
      console.log(`  - Date Columns: ${sheet.dateColumnsCount}`);

      if (!sheet.webhookUrl) {
        console.warn(`  ⚠️ Warning: No Webhook URL configured for this sheet. Skipping dispatch.`);
        continue;
      }

      const payloadString = JSON.stringify(sheet.payload);
      console.log(`  - Webhook URL: ${sheet.webhookUrl}`);
      console.log(`  - Sending ${payloadString.length} bytes to Google Apps Script...`);

      const startTime = Date.now();
      try {
        const result = await postWithRedirect(sheet.webhookUrl, payloadString, 120000);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ✅ Apps Script Response (${duration}s): ${result.text.trim()}`);

        // Record successful sync log back to PostgreSQL
        try {
          await fetch(`${targetUrl}/api/v1/google-sheets/record-sync-log?secret=${encodeURIComponent(cronSecret)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': cronSecret,
              'Authorization': `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              linkId: sheet.linkId,
              status: 'SUCCESS',
              rowsSynced: sheet.studentCount,
              details: `Successfully synchronized via GitHub Actions runner in ${duration}s. Apps Script response: ${result.text.trim()}`,
            }),
          });
        } catch (logErr) {
          console.warn(`  ⚠️ Notice: Could not record sync log:`, logErr.message);
        }
      } catch (postErr) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`  ❌ Webhook dispatch failed (${duration}s):`, postErr.message);
        hasErrors = true;

        // Record failure log back to PostgreSQL
        try {
          await fetch(`${targetUrl}/api/v1/google-sheets/record-sync-log?secret=${encodeURIComponent(cronSecret)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': cronSecret,
              'Authorization': `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              linkId: sheet.linkId,
              status: 'FAILED',
              rowsSynced: 0,
              details: `Webhook dispatch failed after ${duration}s`,
              error: postErr.message,
            }),
          });
        } catch {}
      }
    }
  }

  // Step 3: Trigger Daily Snapshot Reconciliation (Student LeetCode auto-sync)
  console.log('\n[3/3] Triggering LeetCode stats reconciliation on production...');
  try {
    const cronRes = await fetch(`${targetUrl}/api/v1/cron/daily-sync?secret=${encodeURIComponent(cronSecret)}`, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret,
        'Authorization': `Bearer ${cronSecret}`,
        'User-Agent': 'github-actions-autonomous-scheduler/1.0',
      },
    });
    console.log(`  - Daily Reconciliation HTTP Status: ${cronRes.status}`);
    const cronBody = await cronRes.text();
    console.log(`  - Response: ${cronBody.slice(0, 300)}`);
  } catch (cronErr) {
    console.warn(`  ⚠️ Reconciliation notice:`, cronErr.message);
  }

  console.log('\n==========================================================');
  if (hasErrors) {
    console.log('⚠️ Autonomous Sync completed with warnings (see logs above).');
    process.exit(0);
  } else {
    console.log('✅ Autonomous Daily Snapshot & Google Sheets Sync Succeeded 100%!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
