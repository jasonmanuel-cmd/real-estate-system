import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log slow queries
prisma.$on('query', (e: any) => {
  if (e.duration > 1000) {
    logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
  }
});

export default prisma;
