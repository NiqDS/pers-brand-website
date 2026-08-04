import { Cron } from 'croner';
import { config } from './config.js';
import { runWeeklyJob } from './newsletter/run.js';

let job: Cron | null = null;

/**
 * Start the in-process weekly schedule when SCHEDULER_ENABLED is set. A failed
 * run logs and is retried next tick — it never takes the web server down.
 *
 * In production on a host that may sleep the process, prefer the platform
 * scheduler / system cron hitting POST /admin/digest/run instead (see README).
 */
export function startScheduler(): void {
  if (!config.SCHEDULER_ENABLED) {
    console.log('scheduler disabled (set SCHEDULER_ENABLED=true to enable)');
    return;
  }
  job = new Cron(config.DIGEST_CRON, { timezone: config.DIGEST_TZ, name: 'weekly-digest' }, () => {
    console.log('scheduler: running weekly job');
    runWeeklyJob()
      .then((report) => console.log('scheduler: weekly job done', report))
      .catch((err: unknown) =>
        console.error('scheduler: weekly job failed:', (err as Error).message),
      );
  });
  console.log(
    `scheduler enabled: "${config.DIGEST_CRON}" (${config.DIGEST_TZ}); next run ${job
      .nextRun()
      ?.toISOString()}`,
  );
}

export function stopScheduler(): void {
  job?.stop();
  job = null;
}
