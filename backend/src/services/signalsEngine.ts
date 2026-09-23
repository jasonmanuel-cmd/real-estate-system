import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// Signal types (SQLite uses strings instead of enums)
type SignalType =
  | 'NON_OWNER_OCCUPIED'
  | 'LONG_OWNERSHIP'
  | 'RECENT_DEED'
  | 'EQUITY_PROXY'
  | 'PORTFOLIO_OWNER'
  | 'HIGH_LAND_RATIO'
  | 'LARGE_LOT'
  | 'BELOW_MARKET_VALUE'
  | 'CODE_CASE'
  | 'PERMIT_ISSUE'
  | 'TAX_DELINQUENT'
  | 'FIRE_DAMAGE'
  | 'FORECLOSURE_RELATED';

interface SignalDefinition {
  type: SignalType;
  severity: number;
  checkCondition: (parcel: any, context: any) => boolean;
  getMetadata: (parcel: any, context: any) => any;
}

/**
 * Signals Engine - generates investment signals from parcel data
 * This is the "moat" - sophisticated signal stacking that creates value
 */
export class SignalsEngine {
  private signalDefinitions: SignalDefinition[] = [];

  constructor() {
    this.initializeSignalDefinitions();
  }

  /**
   * Initialize all signal definitions
   */
  private initializeSignalDefinitions() {
    this.signalDefinitions = [
      // BASELINE SIGNAL 1: Non-owner occupied
      {
        type: 'NON_OWNER_OCCUPIED',
        severity: 3,
        checkCondition: (parcel, context) => {
          if (!parcel.owner?.mailingAddressStandardized || !parcel.situsAddress) {
            return false;
          }
          // Simple comparison - can be enhanced with fuzzy matching
          const mailingNormalized = this.normalizeAddress(parcel.owner.mailingAddressStandardized);
          const situsNormalized = this.normalizeAddress(parcel.situsAddress);
          return mailingNormalized !== situsNormalized;
        },
        getMetadata: (parcel) => ({
          mailingAddress: parcel.owner?.mailingAddressStandardized,
          situsAddress: parcel.situsAddress,
        }),
      },

      // BASELINE SIGNAL 2: Long ownership (various thresholds)
      {
        type: 'LONG_OWNERSHIP',
        severity: 2,
        checkCondition: (parcel, context) => {
          const yearsOwned = context.yearsOwned;
          return yearsOwned >= 10;
        },
        getMetadata: (parcel, context) => ({
          yearsOwned: context.yearsOwned,
          lastSaleDate: context.lastSaleDate,
        }),
      },

      // BASELINE SIGNAL 3: Recent deed activity
      {
        type: 'RECENT_DEED',
        severity: 3,
        checkCondition: (parcel, context) => {
          return context.hasRecentDeed;
        },
        getMetadata: (parcel, context) => ({
          recentDeedDate: context.recentDeedDate,
          recentDeedType: context.recentDeedType,
        }),
      },

      // BASELINE SIGNAL 4: Equity proxy (long ownership + assessed value)
      {
        type: 'EQUITY_PROXY',
        severity: 3,
        checkCondition: (parcel, context) => {
          const yearsOwned = context.yearsOwned;
          const assessedValue = parcel.assessedValueTotal;

          // High equity proxy: owned 15+ years AND assessed value above county median
          return yearsOwned >= 15 && assessedValue && assessedValue > (context.countyMedianValue || 0);
        },
        getMetadata: (parcel, context) => ({
          yearsOwned: context.yearsOwned,
          assessedValue: parcel.assessedValueTotal,
          countyMedianValue: context.countyMedianValue,
        }),
      },

      // BASELINE SIGNAL 5: Portfolio owner
      {
        type: 'PORTFOLIO_OWNER',
        severity: 2,
        checkCondition: (parcel, context) => {
          return context.ownerParcelCount >= 2;
        },
        getMetadata: (parcel, context) => ({
          ownerParcelCount: context.ownerParcelCount,
          ownerName: parcel.owner?.ownerNameClean,
        }),
      },

      // VALUE SIGNAL 1: High land-to-value ratio (teardown/redevelopment potential)
      // Land worth >= 70% of total assessed value means improvements add little -
      // classic candidate for redevelopment or a lowball land offer.
      {
        type: 'HIGH_LAND_RATIO',
        severity: 3,
        checkCondition: (parcel, context) => {
          const land = parcel.assessedValueLand;
          const total = parcel.assessedValueTotal;
          if (!land || !total) return false;
          // NET_VAL can be below LAND_VAL when exemptions apply; use the
          // gross basis (land + improvements) for the ratio so it stays <= 1.
          const gross = Math.max(total, land + (parcel.assessedValueImprovement || 0));
          return land / gross >= 0.7 && gross > 50000;
        },
        getMetadata: (parcel) => {
          const land = parcel.assessedValueLand;
          const total = parcel.assessedValueTotal;
          const gross = Math.max(total, land + (parcel.assessedValueImprovement || 0));
          return {
            landValue: land,
            totalValue: total,
            ratio: gross ? Number((land / gross).toFixed(2)) : null,
          };
        },
      },

      // VALUE SIGNAL 2: Large residential lot (subdivision/lot-split potential)
      {
        type: 'LARGE_LOT',
        severity: 2,
        checkCondition: (parcel) => {
          if (!parcel.lotSize) return false;
          const isResidential = ['SFR', 'MULTIFAMILY'].includes(parcel.propertyType);
          return isResidential && parcel.lotSize >= 1.0;
        },
        getMetadata: (parcel) => ({
          lotSizeAcres: parcel.lotSize,
          propertyType: parcel.propertyType,
        }),
      },

      // VALUE SIGNAL 3: Below-market assessed value vs county average for its type
      {
        type: 'BELOW_MARKET_VALUE',
        severity: 2,
        checkCondition: (parcel, context) => {
          const total = parcel.assessedValueTotal;
          const avg = context.countyAvgValueForType;
          if (!total || !avg) return false;
          return total < avg * 0.5 && total > 20000;
        },
        getMetadata: (parcel, context) => ({
          assessedValue: parcel.assessedValueTotal,
          countyAvgForType: context.countyAvgValueForType,
        }),
      },

      // OPTIONAL SIGNAL: Code enforcement cases
      {
        type: 'CODE_CASE',
        severity: 4,
        checkCondition: (parcel, context) => {
          return context.hasOpenCodeCase;
        },
        getMetadata: (parcel, context) => ({
          caseCount: context.codeCaseCount,
          caseDetails: context.codeCases,
        }),
      },

      // OPTIONAL SIGNAL: Tax delinquency
      {
        type: 'TAX_DELINQUENT',
        severity: 5,
        checkCondition: (parcel, context) => {
          return context.isTaxDelinquent;
        },
        getMetadata: (parcel, context) => ({
          delinquentAmount: context.delinquentAmount,
          delinquentYears: context.delinquentYears,
        }),
      },

      // OPTIONAL SIGNAL: Foreclosure-related deed activity
      {
        type: 'FORECLOSURE_RELATED',
        severity: 5,
        checkCondition: (parcel, context) => {
          return context.hasForeclosureDeed;
        },
        getMetadata: (parcel, context) => ({
          deedType: context.foreclosureDeedType,
          deedDate: context.foreclosureDeedDate,
        }),
      },
    ];
  }

  /**
   * Generate signals for a single parcel
   */
  async generateSignalsForParcel(apn: string): Promise<number> {
    try {
      const parcel = await prisma.parcel.findFirst({
        where: { apn },
        include: {
          owner: true,
          deeds: {
            orderBy: { recordingDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!parcel) {
        logger.warn(`Parcel not found: ${apn}`);
        return 0;
      }

      // Build context for signal evaluation
      const context = await this.buildParcelContext(parcel);

      // Delete existing DERIVED signals for this parcel, but PRESERVE
      // externally imported ones (TAX_DELINQUENT from the county's published
      // delinquent list, etc.) - those carry source data we can't re-derive.
      const externalTypes = ['TAX_DELINQUENT'];
      const existingSignals = await prisma.signal.findMany({
        where: { parcelId: parcel.id },
        select: { signalType: true },
      });
      const derivedTypes = existingSignals
        .map((s: any) => s.signalType)
        .filter((t: string) => !externalTypes.includes(t));
      if (derivedTypes.length > 0) {
        await prisma.signal.deleteMany({
          where: { parcelId: parcel.id, signalType: { in: derivedTypes } },
        });
      }

      // Generate new signals
      let signalsGenerated = 0;
      const signalsToCreate: Prisma.SignalCreateManyInput[] = [];

      for (const signalDef of this.signalDefinitions) {
        if (signalDef.checkCondition(parcel, context)) {
          const metadata = signalDef.getMetadata(parcel, context);
          signalsToCreate.push({
            parcelId: parcel.id,
            signalType: signalDef.type,
            severity: signalDef.severity,
            signalDate: new Date(),
            sourceName: 'system',
            rawPayload: JSON.stringify(metadata), // Store as JSON string for SQLite
          });
          signalsGenerated++;
        }
      }

      if (signalsToCreate.length > 0) {
        await prisma.signal.createMany({ data: signalsToCreate });
      }

      return signalsGenerated;
    } catch (error) {
      logger.error(`Error generating signals for parcel ${apn}:`, error);
      throw error;
    }
  }

  /**
   * Generate signals for all parcels (or filtered set)
   */
  async generateSignalsForAllParcels(
    filters?: { countyName?: string; limit?: number }
  ): Promise<{ processed: number; signalsGenerated: number }> {
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

      let totalSignals = 0;
      for (const parcel of parcels) {
        const signalsCount = await this.generateSignalsForParcel(parcel.apn);
        totalSignals += signalsCount;
      }

      logger.info(`Generated ${totalSignals} signals for ${parcels.length} parcels`);

      return {
        processed: parcels.length,
        signalsGenerated: totalSignals,
      };
    } catch (error) {
      logger.error('Error generating signals for all parcels:', error);
      throw error;
    }
  }

  /**
   * Build context data needed for signal evaluation
   */
  private async buildParcelContext(parcel: any): Promise<any> {
    const context: any = {};

    // Calculate years owned from most recent deed
    if (parcel.deeds && parcel.deeds.length > 0) {
      const lastDeed = parcel.deeds[0];
      const lastSaleDate = new Date(lastDeed.recordingDate);
      context.lastSaleDate = lastSaleDate;
      context.yearsOwned = (new Date().getFullYear() - lastSaleDate.getFullYear());
    } else {
      context.yearsOwned = 0;
    }

    // Check for recent deed activity (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentDeeds = parcel.deeds?.filter(
      (deed: any) => new Date(deed.recordingDate) >= ninetyDaysAgo
    );

    context.hasRecentDeed = recentDeeds && recentDeeds.length > 0;
    if (context.hasRecentDeed) {
      context.recentDeedDate = recentDeeds[0].recordingDate;
      context.recentDeedType = recentDeeds[0].docType;
    }

    // Check for foreclosure-related deeds
    const foreclosureKeywords = ['trustee', 'foreclosure', 'REO', 'bank'];
    const foreclosureDeed = parcel.deeds?.find((deed: any) =>
      foreclosureKeywords.some(keyword =>
        deed.docType?.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    context.hasForeclosureDeed = !!foreclosureDeed;
    if (foreclosureDeed) {
      context.foreclosureDeedType = foreclosureDeed.docType;
      context.foreclosureDeedDate = foreclosureDeed.recordingDate;
    }

    // Count parcels owned by same owner (portfolio detection)
    if (parcel.owner) {
      const ownerParcelCount = await prisma.parcel.count({
        where: { ownerId: parcel.owner.id },
      });
      context.ownerParcelCount = ownerParcelCount;
    } else {
      context.ownerParcelCount = 1;
    }

    // Get county median assessed value for equity proxy
    const countyStats = await prisma.parcel.aggregate({
      where: {
        countyName: parcel.countyName,
        propertyType: parcel.propertyType,
        assessedValueTotal: { not: null },
      },
      _avg: { assessedValueTotal: true },
    });
    context.countyMedianValue = countyStats._avg.assessedValueTotal || 0;

    // Average assessed value for this property type in the county
    // (used by BELOW_MARKET_VALUE signal)
    const typeStats = await prisma.parcel.aggregate({
      where: {
        countyName: parcel.countyName,
        propertyType: parcel.propertyType,
        assessedValueTotal: { not: null },
      },
      _avg: { assessedValueTotal: true },
    });
    context.countyAvgValueForType = typeStats._avg.assessedValueTotal || 0;

    // Check for code cases (if data available)
    // This would require additional tables/data sources
    context.hasOpenCodeCase = false;
    context.codeCaseCount = 0;
    context.codeCases = [];

    // Check for tax delinquency (if data available)
    context.isTaxDelinquent = false;
    context.delinquentAmount = 0;
    context.delinquentYears = 0;

    return context;
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[.,#]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln)\b/g, '')
      .trim();
  }
}

export const signalsEngine = new SignalsEngine();
