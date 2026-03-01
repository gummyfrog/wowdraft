const cron = require('node-cron');
const db = require('../db');
const { generateReport } = require('./reports');

const DAY_MAP = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

function startScheduler() {
  // Run daily at 6am UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily report check...');

    try {
      const today = new Date().getDay();
      const activeLeagues = await db.leagues()
        .find({ status: 'Active' })
        .toArray();

      for (const league of activeLeagues) {
        const reportDay = DAY_MAP[league.report_day];
        if (reportDay === undefined || reportDay !== today) continue;

        // Check if we already generated a report this week
        const lastReport = league.activity_reports && league.activity_reports.length > 0
          ? league.activity_reports[league.activity_reports.length - 1]
          : null;

        if (lastReport) {
          const lastReportDate = new Date(lastReport.time);
          const daysSince = (Date.now() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 6) {
            console.log(`[Scheduler] Skipping ${league.name} — report already generated this week`);
            continue;
          }
        }

        // Check if season is over
        const weeksDone = (league.activity_reports || []).length;
        if (weeksDone >= (league.season_length || 8)) {
          await db.leagues().updateOne(
            { code: league.code },
            { $set: { status: 'Completed' } }
          );
          console.log(`[Scheduler] ${league.name} season complete!`);
          continue;
        }

        console.log(`[Scheduler] Generating report for ${league.name}...`);
        try {
          await generateReport(league.code);
          console.log(`[Scheduler] Report generated for ${league.name}`);
        } catch (err) {
          console.error(`[Scheduler] Failed for ${league.name}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  console.log('Report scheduler started (daily at 6am UTC)');
}

module.exports = { startScheduler };
