import cron from 'node-cron';
import { etlRunner } from './etlRunner';
import { kernCountyAssessorAdapter } from './adapters/kernCountyAssessorAdapter';
import { logger } from '../utils/logger';

/**
 * ETL Scheduler - runs ETL jobs on a schedule
 */
export class EtlScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start the scheduler
   */
  start() {
    const enabled = process.env.ETL_ENABLED === 'true';
    const schedule = process.env.ETL_SCHEDULE || '0 2 * * *'; // Default: 2 AM daily

    if (!enabled) {
      logger.info('ETL scheduler is disabled (ETL_ENABLED=false)');
      return;
    }

    logger.info(`Starting ETL scheduler with cron: ${schedule}`);

    // Schedule Kern County assessor data refresh
    const kernTask = cron.schedule(schedule, async () => {
      logger.info('Running scheduled Kern County ETL job...');
      try {
        const result = await etlRunner.runJob(kernCountyAssessorAdapter);
        logger.info('Scheduled Kern County ETL job completed:', result);
      } catch (error) {
        logger.error('Scheduled Kern County ETL job failed:', error);
      }
    });

    this.tasks.set('kern_county_assessor', kernTask);

    logger.info('ETL scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    for (const [name, task] of this.tasks.entries()) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    this.tasks.clear();
  }

  /**
   * Trigger a manual ETL run (bypasses schedule)
   */
  async runManual(adapterName: string) {
    logger.info(`Running manual ETL job: ${adapterName}`);

    switch (adapterName) {
      case 'kern_county_assessor':
        return etlRunner.runJob(kernCountyAssessorAdapter);
      default:
        throw new Error(`Unknown adapter: ${adapterName}`);
    }
  }
}

export const etlScheduler = new EtlScheduler();
