import { JobStatus } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { signalsEngine } from '../services/signalsEngine';
import { scoringEngine } from '../services/scoringEngine';

export interface EtlAdapter {
  name: string;
  countyName: string;
  extract(): Promise<any[]>;
  transform(rawData: any[]): Promise<any[]>;
  load(transformedData: any[]): Promise<void>;
}

export interface EtlJobResult {
  jobId: string;
  status: JobStatus;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: string[];
}

/**
 * ETL Runner - orchestrates data ingestion pipelines
 */
export class EtlRunner {
  /**
   * Run an ETL job for a specific adapter
   */
  async runJob(adapter: EtlAdapter, options?: {
    generateSignals?: boolean;
    calculateScores?: boolean;
  }): Promise<EtlJobResult> {
    const jobId = await this.createJob(adapter);

    try {
      logger.info(`Starting ETL job ${jobId} for ${adapter.name}`);

      // Mark job as running
      await this.updateJob(jobId, { status: JobStatus.RUNNING, startedAt: new Date() });

      // EXTRACT
      logger.info(`[${jobId}] Extracting data...`);
      const rawData = await adapter.extract();
      logger.info(`[${jobId}] Extracted ${rawData.length} records`);

      // TRANSFORM
      logger.info(`[${jobId}] Transforming data...`);
      const transformedData = await adapter.transform(rawData);
      logger.info(`[${jobId}] Transformed ${transformedData.length} records`);

      // LOAD
      logger.info(`[${jobId}] Loading data...`);
      await adapter.load(transformedData);
      logger.info(`[${jobId}] Loaded ${transformedData.length} records`);

      // POST-PROCESSING: Generate signals
      if (options?.generateSignals !== false) {
        logger.info(`[${jobId}] Generating signals...`);
        const signalResult = await signalsEngine.generateSignalsForAllParcels({
          countyName: adapter.countyName,
        });
        logger.info(`[${jobId}] Generated ${signalResult.signalsGenerated} signals`);
      }

      // POST-PROCESSING: Calculate scores
      if (options?.calculateScores !== false) {
        logger.info(`[${jobId}] Calculating scores...`);
        const scoreResult = await scoringEngine.calculateScoresForAllParcels({
          countyName: adapter.countyName,
        });
        logger.info(`[${jobId}] Calculated scores for ${scoreResult.processed} parcels`);
      }

      // Mark job as completed
      await this.updateJob(jobId, {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        recordsProcessed: rawData.length,
        recordsSucceeded: transformedData.length,
        recordsFailed: rawData.length - transformedData.length,
      });

      logger.info(`[${jobId}] Job completed successfully`);

      return {
        jobId,
        status: JobStatus.COMPLETED,
        recordsProcessed: rawData.length,
        recordsSucceeded: transformedData.length,
        recordsFailed: rawData.length - transformedData.length,
        errors: [],
      };
    } catch (error: any) {
      logger.error(`[${jobId}] Job failed:`, error);

      // Mark job as failed
      await this.updateJob(jobId, {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorLog: error.message,
      });

      return {
        jobId,
        status: JobStatus.FAILED,
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Create a new ETL job record
   */
  private async createJob(adapter: EtlAdapter): Promise<string> {
    const job = await prisma.etlJob.create({
      data: {
        jobType: adapter.name,
        countyName: adapter.countyName,
        status: JobStatus.PENDING,
      },
    });

    return job.id;
  }

  /**
   * Update ETL job status
   */
  private async updateJob(jobId: string, data: any) {
    await prisma.etlJob.update({
      where: { id: jobId },
      data,
    });
  }
}

export const etlRunner = new EtlRunner();
