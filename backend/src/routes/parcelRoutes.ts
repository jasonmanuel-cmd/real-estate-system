import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

/**
 * GET /api/parcels/search
 * Search parcels (for adding to leads)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, countyName, propertyType, limit = '50' } = req.query;

    const where: any = {};

    // Search by address or APN
    // Provider-agnostic case-insensitivity: SQLite LIKE is case-insensitive
    // for ASCII but Postgres LIKE is not, and mode:'insensitive' breaks SQLite.
    // Match the raw, upper, and lower variants of the query instead.
    if (q) {
      const qs = q as string;
      where.OR = [
        { situsAddress: { contains: qs } },
        { situsAddress: { contains: qs.toUpperCase() } },
        { situsAddress: { contains: qs.toLowerCase() } },
        { apn: { contains: qs } },
      ];
    }

    if (countyName) {
      where.countyName = countyName;
    }

    if (propertyType) {
      where.propertyType = propertyType;
    }

    const parcels = await prisma.parcel.findMany({
      where,
      include: {
        owner: true,
        score: true,
      },
      take: parseInt(limit as string),
    });

    res.json({ parcels });
  } catch (error: any) {
    logger.error('Error searching parcels:', error);
    res.status(500).json({ error: 'Failed to search parcels' });
  }
});

/**
 * GET /api/parcels/:apn
 * Get parcel details
 */
router.get('/:apn', async (req: Request, res: Response) => {
  try {
    const { apn } = req.params;

    const parcel = await prisma.parcel.findFirst({
      where: { apn },
      include: {
        owner: true,
        score: true,
        signals: {
          orderBy: { severity: 'desc' },
        },
        deeds: {
          orderBy: { recordingDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    res.json({ parcel });
  } catch (error: any) {
    logger.error('Error fetching parcel:', error);
    res.status(500).json({ error: 'Failed to fetch parcel' });
  }
});

export default router;
