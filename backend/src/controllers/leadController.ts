import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

// Type aliases for SQLite (no enums)
type PropertyType = 'SFR' | 'LAND' | 'MULTIFAMILY' | 'COMMERCIAL' | 'OTHER';
type LeadStatus = 'NEW' | 'RESEARCHED' | 'MAILED' | 'CALLED' | 'UNDER_CONTRACT' | 'ARCHIVED' | 'LOST';

export class LeadController {
  /**
   * GET /api/leads
   * Get lead feed with filters and pagination
   */
  async getLeads(req: AuthRequest, res: Response) {
    try {
      const {
        page = '1',
        limit = '50',
        sortBy = 'score',
        sortOrder = 'desc',
        countyName,
        city,
        zip,
        propertyType,
        minScore,
        maxScore,
        status,
        nonOwnerOccupied,
        minYearsOwned,
        tags,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      // Build parcel filters
      const parcelWhere: any = {};

      if (countyName) parcelWhere.countyName = countyName;
      if (city) parcelWhere.city = city;
      if (zip) parcelWhere.zip = zip;
      if (propertyType) parcelWhere.propertyType = propertyType as PropertyType;

      if (Object.keys(parcelWhere).length > 0) {
        where.parcel = parcelWhere;
      }

      // Score filters
      if (minScore || maxScore) {
        where.parcel = {
          ...where.parcel,
          score: {
            scoreTotal: {
              ...(minScore && { gte: parseInt(minScore as string) }),
              ...(maxScore && { lte: parseInt(maxScore as string) }),
            },
          },
        };
      }

      // Status filter
      if (status) {
        where.status = status as LeadStatus;
      }

      // Tags filter
      if (tags) {
        const tagArray = (tags as string).split(',');
        where.tags = { hasSome: tagArray };
      }

      // Signal filters
      if (nonOwnerOccupied === 'true') {
        where.parcel = {
          ...where.parcel,
          signals: {
            some: { signalType: 'NON_OWNER_OCCUPIED' },
          },
        };
      }

      if (minYearsOwned) {
        // This would require a complex query - simplified for now
        // In production, consider adding a computed field or indexed view
      }

      // Sorting
      let orderBy: any = {};
      switch (sortBy) {
        case 'score':
          orderBy = { parcel: { score: { scoreTotal: sortOrder } } };
          break;
        case 'updated':
          orderBy = { updatedAt: sortOrder };
          break;
        case 'created':
          orderBy = { createdAt: sortOrder };
          break;
        default:
          orderBy = { parcel: { score: { scoreTotal: 'desc' } } };
      }

      // Execute query
      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: {
            parcel: {
              include: {
                owner: true,
                score: true,
                signals: {
                  orderBy: { severity: 'desc' },
                  take: 5,
                },
              },
            },
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.lead.count({ where }),
      ]);

      res.json({
        leads: leads.map(lead => this.formatLead(lead)),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching leads:', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  }

  /**
   * GET /api/leads/:id
   * Get detailed lead profile
   */
  async getLead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          parcel: {
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
          },
          outreachLogs: {
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.json(this.formatLeadDetail(lead));
    } catch (error: any) {
      logger.error('Error fetching lead:', error);
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  }

  /**
   * POST /api/leads
   * Create a new lead from a parcel
   */
  async createLead(req: AuthRequest, res: Response) {
    try {
      const { apn } = req.body;

      if (!apn) {
        return res.status(400).json({ error: 'APN is required' });
      }

      // Check if parcel exists
      const parcel = await prisma.parcel.findFirst({ where: { apn } });
      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      // Check if lead already exists
      const existingLead = await prisma.lead.findUnique({ where: { parcelId: parcel.id } });
      if (existingLead) {
        return res.status(400).json({ error: 'Lead already exists for this parcel' });
      }

      // Create lead
      const lead = await prisma.lead.create({
        data: {
          parcelId: parcel.id,
          status: 'NEW',
          assignedTo: req.user?.id,
        },
        include: {
          parcel: {
            include: {
              owner: true,
              score: true,
            },
          },
        },
      });

      res.status(201).json(this.formatLead(lead));
    } catch (error: any) {
      logger.error('Error creating lead:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }

  /**
   * PATCH /api/leads/:id
   * Update lead (status, tags, notes, etc.)
   */
  async updateLead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, tags, notes, nextActionAt, arvEstimate, rentEstimate, rehabEstimate } =
        req.body;

      const updateData: any = {};

      if (status) updateData.status = status;
      if (tags) updateData.tags = tags;
      if (notes !== undefined) updateData.notes = notes;
      if (nextActionAt) updateData.nextActionAt = new Date(nextActionAt);
      if (arvEstimate !== undefined) updateData.arvEstimate = arvEstimate;
      if (rentEstimate !== undefined) updateData.rentEstimate = rentEstimate;
      if (rehabEstimate !== undefined) updateData.rehabEstimate = rehabEstimate;

      const lead = await prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          parcel: {
            include: {
              owner: true,
              score: true,
            },
          },
        },
      });

      res.json(this.formatLead(lead));
    } catch (error: any) {
      logger.error('Error updating lead:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }

  /**
   * POST /api/leads/:id/outreach
   * Log an outreach attempt
   */
  async logOutreach(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { method, outcome, note } = req.body;

      if (!method) {
        return res.status(400).json({ error: 'Outreach method is required' });
      }

      const log = await prisma.outreachLog.create({
        data: {
          leadId: id,
          method,
          outcome,
          note,
        },
      });

      res.status(201).json(log);
    } catch (error: any) {
      logger.error('Error logging outreach:', error);
      res.status(500).json({ error: 'Failed to log outreach' });
    }
  }

  /**
   * DELETE /api/leads/:id
   * Delete a lead (archive)
   */
  async deleteLead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Update status to ARCHIVED instead of deleting
      await prisma.lead.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting lead:', error);
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  }

  /**
   * Format lead for API response
   */
  private formatLead(lead: any) {
    return {
      id: lead.id,
      apn: lead.parcel.apn,
      status: lead.status,
      tags: lead.tags,
      notes: lead.notes,
      nextActionAt: lead.nextActionAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      property: {
        address: lead.parcel.situsAddress,
        city: lead.parcel.city,
        zip: lead.parcel.zip,
        county: lead.parcel.countyName,
        propertyType: lead.parcel.propertyType,
        buildingSqft: lead.parcel.buildingSqft,
        lotSize: lead.parcel.lotSize,
        yearBuilt: lead.parcel.yearBuilt,
        lat: lead.parcel.lat,
        lng: lead.parcel.lng,
      },
      owner: lead.parcel.owner
        ? {
            name: lead.parcel.owner.ownerNameClean,
            mailingAddress: lead.parcel.owner.mailingAddressStandardized,
            mailingCity: lead.parcel.owner.mailingCity,
            mailingState: lead.parcel.owner.mailingState,
            mailingZip: lead.parcel.owner.mailingZip,
          }
        : null,
      score: lead.parcel.score
        ? {
            total: lead.parcel.score.scoreTotal,
            topReasons: lead.parcel.score.topReasons,
            confidence: lead.parcel.score.confidenceLevel,
          }
        : null,
      signals: lead.parcel.signals?.slice(0, 3).map((s: any) => ({
        type: s.signalType,
        severity: s.severity,
        date: s.signalDate,
      })),
      estimates: {
        arv: lead.arvEstimate,
        rent: lead.rentEstimate,
        rehab: lead.rehabEstimate,
      },
    };
  }

  /**
   * Format detailed lead for single view
   */
  private formatLeadDetail(lead: any) {
    return {
      ...this.formatLead(lead),
      allSignals: lead.parcel.signals,
      deeds: lead.parcel.deeds,
      outreachHistory: lead.outreachLogs,
    };
  }
}

export const leadController = new LeadController();
