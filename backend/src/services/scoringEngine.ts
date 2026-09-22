import prisma from '../config/database';
import { logger } from '../utils/logger';

// Signal types (SQLite uses strings instead of enums)
type SignalType =
  | 'NON_OWNER_OCCUPIED'
  | 'LONG_OWNERSHIP'
  | 'RECENT_DEED'
  | 'EQUITY_PROXY'
  | 'PORTFOLIO_OWNER'
  | 'CODE_CASE'
  | 'PERMIT_ISSUE'
  | 'TAX_DELINQUENT'
  | 'FIRE_DAMAGE'
  | 'FORECLOSURE_RELATED';

interface ScoreComponent {
  signalType: string;
  weight: number;
  contribution: number;
  reason: string;
}

/**
 * Scoring Engine - converts signals into 0-100 scores with explanations
 * Configurable weights allow tuning based on market feedback
 */
export class ScoringEngine {
  private defaultWeights: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultWeights();
  }

  /**
   * Initialize default signal weights
   * These can be overridden by database config
   */
  private initializeDefaultWeights() {
    this.defaultWeights.set('NON_OWNER_OCCUPIED', 15);
    this.defaultWeights.set('LONG_OWNERSHIP', 20); // Will vary by years
    this.defaultWeights.set('RECENT_DEED', 15);
    this.defaultWeights.set('EQUITY_PROXY', 15);
    this.defaultWeights.set('PORTFOLIO_OWNER', 15);
    this.defaultWeights.set('CODE_CASE', 20);
    this.defaultWeights.set('PERMIT_ISSUE', 10);
    this.defaultWeights.set('TAX_DELINQUENT', 25);
    this.defaultWeights.set('FORECLOSURE_RELATED', 25);
    this.defaultWeights.set('FIRE_DAMAGE', 20);
  }

  /**
   * Calculate score for a single parcel
   */
  async calculateScoreForParcel(apn: string): Promise<{
    scoreTotal: number;
    components: ScoreComponent[];
    topReasons: string[];
    confidenceLevel: number;
  }> {
    try {
      const parcel = await prisma.parcel.findFirst({
        where: { apn },
        include: {
          signals: true,
          owner: true,
        },
      });

      if (!parcel) {
        throw new Error(`Parcel not found: ${apn}`);
      }

      // Load weights from database (or use defaults)
      const weights = await this.loadWeights();

      // Calculate score components
      const components: ScoreComponent[] = [];
      let totalScore = 0;

      for (const signal of parcel.signals) {
        const weight = weights.get(signal.signalType) || 0;
        let contribution = weight;

        // Adjust contribution based on signal severity and metadata
        contribution = this.adjustContribution(signal, weight);

        const reason = this.generateReason(signal);

        components.push({
          signalType: signal.signalType,
          weight,
          contribution,
          reason,
        });

        totalScore += contribution;
      }

      // Apply data quality penalty
      const dataQualityPenalty = this.calculateDataQualityPenalty(parcel);
      totalScore -= dataQualityPenalty;

      // Cap at 100
      totalScore = Math.min(100, Math.max(0, totalScore));

      // Determine confidence level (0-1)
      const confidenceLevel = this.calculateConfidence(parcel, components);

      // Get top 3 reasons
      const topReasons = components
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 3)
        .map(c => c.reason);

      // Save score to database
      await prisma.score.upsert({
        where: { parcelId: parcel.id },
        create: {
          parcelId: parcel.id,
          scoreTotal: Math.round(totalScore),
          scoreComponents: JSON.stringify({ components }), // Store as JSON string for SQLite
          topReasons: topReasons.join(', '), // Store as comma-separated string for SQLite
          confidenceLevel,
        },
        update: {
          scoreTotal: Math.round(totalScore),
          scoreComponents: JSON.stringify({ components }), // Store as JSON string for SQLite
          topReasons: topReasons.join(', '), // Store as comma-separated string for SQLite
          confidenceLevel,
          updatedAt: new Date(),
        },
      });

      return {
        scoreTotal: Math.round(totalScore),
        components,
        topReasons,
        confidenceLevel,
      };
    } catch (error) {
      logger.error(`Error calculating score for parcel ${apn}:`, error);
      throw error;
    }
  }

  /**
   * Calculate scores for all parcels (or filtered set)
   */
  async calculateScoresForAllParcels(
    filters?: { countyName?: string; limit?: number }
  ): Promise<{ processed: number }> {
    try {
      const where: any = {};
      if (filters?.countyName) {
        where.countyName = filters.countyName;
      }

      const parcels = await prisma.parcel.findMany({
        where,
        select: { apn: true },
        take: filters?.limit,
      });

      for (const parcel of parcels) {
        await this.calculateScoreForParcel(parcel.apn);
      }

      logger.info(`Calculated scores for ${parcels.length} parcels`);

      return { processed: parcels.length };
    } catch (error) {
      logger.error('Error calculating scores for all parcels:', error);
      throw error;
    }
  }

  /**
   * Adjust contribution based on signal-specific logic
   */
  private adjustContribution(signal: any, baseWeight: number): number {
    let contribution = baseWeight;

    // Parse rawPayload from JSON string (SQLite storage)
    let payload: any = {};
    try {
      payload = signal.rawPayload ? JSON.parse(signal.rawPayload) : {};
    } catch (e) {
      payload = {};
    }

    switch (signal.signalType) {
      case 'LONG_OWNERSHIP':
        // Increase weight for longer ownership
        const yearsOwned = payload?.yearsOwned || 0;
        if (yearsOwned >= 20) {
          contribution = baseWeight * 1.5;
        } else if (yearsOwned >= 15) {
          contribution = baseWeight * 1.25;
        } else if (yearsOwned >= 10) {
          contribution = baseWeight;
        } else {
          contribution = baseWeight * 0.5;
        }
        break;

      case 'PORTFOLIO_OWNER':
        // Increase weight for larger portfolios
        const parcelCount = payload?.ownerParcelCount || 0;
        if (parcelCount >= 20) {
          contribution = baseWeight * 2;
        } else if (parcelCount >= 6) {
          contribution = baseWeight * 1.5;
        } else if (parcelCount >= 2) {
          contribution = baseWeight;
        }
        break;

      case 'RECENT_DEED':
        // Adjust based on deed type
        const deedType = payload?.recentDeedType || '';
        if (deedType.toLowerCase().includes('quitclaim')) {
          contribution = baseWeight * 1.3; // Quitclaims often indicate distress
        } else if (deedType.toLowerCase().includes('trustee')) {
          contribution = baseWeight * 1.5; // Trustee deeds are high-value signals
        }
        break;

      default:
        // Use severity multiplier for other signals
        contribution = baseWeight * (signal.severity / 3);
    }

    return contribution;
  }

  /**
   * Generate human-readable reason for a signal
   */
  private generateReason(signal: any): string {
    // Parse rawPayload from JSON string (SQLite storage)
    let payload: any = {};
    try {
      payload = signal.rawPayload ? JSON.parse(signal.rawPayload) : {};
    } catch (e) {
      payload = {};
    }

    switch (signal.signalType) {
      case 'NON_OWNER_OCCUPIED':
        return 'Non-owner occupied (investor property)';

      case 'LONG_OWNERSHIP':
        const years = payload?.yearsOwned || 0;
        return `Owned ${years} years (potential equity)`;

      case 'RECENT_DEED':
        const deedType = payload?.recentDeedType || 'deed';
        return `Recent ${deedType} activity`;

      case 'EQUITY_PROXY':
        return 'High equity proxy (long ownership + value)';

      case 'PORTFOLIO_OWNER':
        const count = payload?.ownerParcelCount || 0;
        return `Portfolio owner (${count} properties)`;

      case 'CODE_CASE':
        return 'Open code enforcement case';

      case 'PERMIT_ISSUE':
        return 'Permit issues detected';

      case 'TAX_DELINQUENT':
        return 'Tax delinquency';

      case 'FORECLOSURE_RELATED':
        return 'Foreclosure-related deed activity';

      case 'FIRE_DAMAGE':
        return 'Fire damage reported';

      default:
        return signal.signalType.replace(/_/g, ' ').toLowerCase();
    }
  }

  /**
   * Calculate data quality penalty
   */
  private calculateDataQualityPenalty(parcel: any): number {
    let penalty = 0;

    // Penalize missing critical fields
    if (!parcel.owner) penalty += 5;
    if (!parcel.assessedValueTotal) penalty += 3;
    if (!parcel.propertyType || parcel.propertyType === 'OTHER') penalty += 3;
    if (!parcel.buildingSqft && parcel.propertyType !== 'LAND') penalty += 2;
    if (!parcel.lat || !parcel.lng) penalty += 2;

    return penalty;
  }

  /**
   * Calculate confidence level (0-1) based on data completeness
   */
  private calculateConfidence(parcel: any, components: ScoreComponent[]): number {
    let confidence = 1.0;

    // Reduce confidence for missing data
    if (!parcel.owner) confidence -= 0.15;
    if (!parcel.assessedValueTotal) confidence -= 0.1;
    if (!parcel.buildingSqft && parcel.propertyType !== 'LAND') confidence -= 0.1;
    if (!parcel.lat || !parcel.lng) confidence -= 0.05;

    // Reduce confidence if very few signals
    if (components.length < 2) confidence -= 0.2;
    if (components.length < 1) confidence -= 0.3;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Load weights from database (or use defaults)
   */
  private async loadWeights(): Promise<Map<string, number>> {
    try {
      const dbWeights = await prisma.scoreWeight.findMany({
        where: { isActive: true },
      });

      if (dbWeights.length === 0) {
        return this.defaultWeights;
      }

      const weights = new Map<string, number>();
      for (const weight of dbWeights) {
        weights.set(weight.signalType, weight.weight);
      }

      // Fill in any missing weights with defaults
      for (const [signalType, defaultWeight] of this.defaultWeights.entries()) {
        if (!weights.has(signalType)) {
          weights.set(signalType, defaultWeight);
        }
      }

      return weights;
    } catch (error) {
      logger.warn('Failed to load weights from database, using defaults', error);
      return this.defaultWeights;
    }
  }

  /**
   * Update signal weight configuration
   */
  async updateWeight(signalType: string, weight: number, description?: string) {
    await prisma.scoreWeight.upsert({
      where: { signalType },
      create: {
        signalType,
        weight,
        description,
        isActive: true,
      },
      update: {
        weight,
        description,
        updatedAt: new Date(),
      },
    });

    logger.info(`Updated weight for ${signalType}: ${weight}`);
  }

  /**
   * Get current weight configuration
   */
  async getWeights() {
    const dbWeights = await prisma.scoreWeight.findMany({
      where: { isActive: true },
    });

    if (dbWeights.length === 0) {
      // Return defaults as array
      return Array.from(this.defaultWeights.entries()).map(([signalType, weight]) => ({
        signalType,
        weight,
        description: null,
      }));
    }

    return dbWeights;
  }
}

export const scoringEngine = new ScoringEngine();
