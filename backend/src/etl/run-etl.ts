#!/usr/bin/env ts-node
/**
 * Standalone ETL runner script
 *
 * Usage:
 *   npm run etl:run -- kern_county_assessor
 *   ts-node src/etl/run-etl.ts kern_county_assessor
 */

import dotenv from 'dotenv';
import { etlRunner } from './etlRunner';
import { kernCountyAssessorAdapter } from './adapters/kernCountyAssessorAdapter';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  const adapterName = process.argv[2];

  if (!adapterName) {
    console.error('Usage: npm run etl:run -- <adapter_name>');
    console.error('Available adapters: kern_county_assessor');
    process.exit(1);
  }

  let adapter;

  switch (adapterName) {
    case 'kern_county_assessor':
      adapter = kernCountyAssessorAdapter;
      break;
    default:
      console.error(`Unknown adapter: ${adapterName}`);
      process.exit(1);
  }

  try {
    logger.info(`Starting ETL job: ${adapterName}`);
    const result = await etlRunner.runJob(adapter);
    logger.info('ETL job completed:', result);
    process.exit(0);
  } catch (error) {
    logger.error('ETL job failed:', error);
    process.exit(1);
  }
}

main();
