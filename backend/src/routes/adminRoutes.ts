import { Router, Request, Response } from 'express';
import { authenticate, auditAction } from '../middleware/auth';
import { signalsEngine } from '../services/signalsEngine';
import { scoringEngine } from '../services/scoringEngine';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

/**
 * POST /api/admin/signals/generate
 * Manually trigger signal generation
 */
router.post('/signals/generate', auditAction('run', 'signal_generation'), async (req: Request, res: Response) => {
  try {
    const { countyName, limit } = req.body;

    const result = await signalsEngine.generateSignalsForAllParcels({ countyName, limit });

    res.json(result);
  } catch (error: any) {
    logger.error('Error generating signals:', error);
    res.status(500).json({ error: 'Failed to generate signals' });
  }
});

/**
 * POST /api/admin/scores/calculate
 * Manually trigger score calculation
 */
router.post('/scores/calculate', auditAction('run', 'score_calculation'), async (req: Request, res: Response) => {
  try {
    const { countyName, limit } = req.body;

    const result = await scoringEngine.calculateScoresForAllParcels({ countyName, limit });

    res.json(result);
  } catch (error: any) {
    logger.error('Error calculating scores:', error);
    res.status(500).json({ error: 'Failed to calculate scores' });
  }
});

/**
 * GET /api/admin/weights
 * Get current score weights
 */
router.get('/weights', async (req: Request, res: Response) => {
  try {
    const weights = await scoringEngine.getWeights();
    res.json({ weights });
  } catch (error: any) {
    logger.error('Error fetching weights:', error);
    res.status(500).json({ error: 'Failed to fetch weights' });
  }
});

/**
 * PUT /api/admin/weights/:signalType
 * Update a score weight
 */
router.put('/weights/:signalType', auditAction('update', 'score_weight'), async (req: Request, res: Response) => {
  try {
    const { signalType } = req.params;
    const { weight, description } = req.body;

    await scoringEngine.updateWeight(signalType as any, weight, description);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error updating weight:', error);
    res.status(500).json({ error: 'Failed to update weight' });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      totalParcels,
      totalLeads,
      leadsByStatus,
      parcelsByCounty,
      avgScore,
      recentJobs,
    ] = await Promise.all([
      prisma.parcel.count(),
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.parcel.groupBy({
        by: ['countyName'],
        _count: true,
      }),
      prisma.score.aggregate({
        _avg: { scoreTotal: true },
      }),
      prisma.etlJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      totalParcels,
      totalLeads,
      leadsByStatus,
      parcelsByCounty,
      avgScore: avgScore._avg.scoreTotal,
      recentJobs,
    });
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/jobs
 * Get ETL job history
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;

    const jobs = await prisma.etlJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ jobs });
  } catch (error: any) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;

    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    res.json({ logs });
  } catch (error: any) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
