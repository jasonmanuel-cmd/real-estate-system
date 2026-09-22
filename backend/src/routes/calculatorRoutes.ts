import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { dealCalculator } from '../services/dealCalculator';
import { PropertyType } from '../types';

const router = Router();

router.use(authenticate);

/**
 * POST /api/calculator/wholesale
 */
router.post('/wholesale', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateWholesale(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/brrrr
 */
router.post('/brrrr', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateBrrrr(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/rental
 */
router.post('/rental', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateRental(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/multifamily
 */
router.post('/multifamily', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateMultifamily(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/commercial
 */
router.post('/commercial', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateCommercial(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/land
 */
router.post('/land', (req: Request, res: Response) => {
  try {
    const result = dealCalculator.calculateLand(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/calculator/all
 * Calculate all applicable strategies for a property
 */
router.post('/all', (req: Request, res: Response) => {
  try {
    const { propertyType, inputs } = req.body;
    const results = dealCalculator.calculateAllStrategies(propertyType as PropertyType, inputs);
    res.json({ strategies: results });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
