import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { stringify } from 'csv-stringify/sync';
import { LeadStatus } from '@prisma/client';

export class ExportController {
  /**
   * POST /api/export/mailing-list
   * Export mailing list CSV
   */
  async exportMailingList(req: AuthRequest, res: Response) {
    try {
      const { leadIds, filters } = req.body;

      let leads: any[];

      if (leadIds && leadIds.length > 0) {
        // Export specific leads
        leads = await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          include: {
            parcel: {
              include: {
                owner: true,
                score: true,
              },
            },
          },
        });
      } else {
        // Export based on filters
        const where: any = {};

        if (filters?.status) {
          where.status = { in: filters.status };
        }

        if (filters?.minScore) {
          where.parcel = {
            score: {
              scoreTotal: { gte: filters.minScore },
            },
          };
        }

        leads = await prisma.lead.findMany({
          where,
          include: {
            parcel: {
              include: {
                owner: true,
                score: true,
              },
            },
          },
          take: filters?.limit || 1000,
        });
      }

      // Format for mailing list
      const mailingData = leads.map(lead => ({
        'Owner Name': lead.parcel.owner?.ownerNameClean || '',
        'Mailing Address': lead.parcel.owner?.mailingAddressStandardized || '',
        'Mailing City': lead.parcel.owner?.mailingCity || '',
        'Mailing State': lead.parcel.owner?.mailingState || '',
        'Mailing Zip': lead.parcel.owner?.mailingZip || '',
        'Property Address': lead.parcel.situsAddress,
        'Property City': lead.parcel.city || '',
        'Property Zip': lead.parcel.zip || '',
        County: lead.parcel.countyName,
        APN: lead.apn,
        Score: lead.parcel.score?.scoreTotal || 0,
        'Top Reason': lead.parcel.score?.topReasons?.[0] || '',
        'Property Type': lead.parcel.propertyType,
        Tags: lead.tags.join(', '),
        Notes: lead.notes || '',
      }));

      const csv = stringify(mailingData, { header: true });

      // Log export for audit
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'export_mailing_list',
          resource: 'lead',
          metadata: {
            count: leads.length,
            filters,
          },
        },
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="mailing-list-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      logger.error('Error exporting mailing list:', error);
      res.status(500).json({ error: 'Failed to export mailing list' });
    }
  }

  /**
   * POST /api/export/call-sheet
   * Export call sheet CSV (when phone enrichment is added)
   */
  async exportCallSheet(req: AuthRequest, res: Response) {
    try {
      const { leadIds } = req.body;

      if (!leadIds || leadIds.length === 0) {
        return res.status(400).json({ error: 'Lead IDs are required' });
      }

      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        include: {
          parcel: {
            include: {
              owner: true,
              score: true,
            },
          },
        },
      });

      // Format for call sheet
      const callData = leads.map(lead => ({
        'Owner Name': lead.parcel.owner?.ownerNameClean || '',
        Phone: '', // To be filled when enrichment is added
        'Property Address': lead.parcel.situsAddress,
        County: lead.parcel.countyName,
        Score: lead.parcel.score?.scoreTotal || 0,
        'Call Script Notes': lead.parcel.score?.topReasons?.join('; ') || '',
        'Last Contact': '', // Would come from outreach logs
        Status: lead.status,
      }));

      const csv = stringify(callData, { header: true });

      // Log export
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'export_call_sheet',
          resource: 'lead',
          metadata: { count: leads.length },
        },
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="call-sheet-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      logger.error('Error exporting call sheet:', error);
      res.status(500).json({ error: 'Failed to export call sheet' });
    }
  }

  /**
   * POST /api/export/property-data
   * Export detailed property data
   */
  async exportPropertyData(req: AuthRequest, res: Response) {
    try {
      const { leadIds } = req.body;

      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        include: {
          parcel: {
            include: {
              owner: true,
              score: true,
              signals: true,
            },
          },
        },
      });

      const propertyData = leads.map(lead => ({
        APN: lead.apn,
        'Property Address': lead.parcel.situsAddress,
        City: lead.parcel.city || '',
        Zip: lead.parcel.zip || '',
        County: lead.parcel.countyName,
        'Property Type': lead.parcel.propertyType,
        'Building Sqft': lead.parcel.buildingSqft || '',
        'Lot Size': lead.parcel.lotSize || '',
        'Year Built': lead.parcel.yearBuilt || '',
        Bedrooms: lead.parcel.bedrooms || '',
        Bathrooms: lead.parcel.bathrooms || '',
        'Assessed Value': lead.parcel.assessedValueTotal || '',
        'Owner Name': lead.parcel.owner?.ownerNameClean || '',
        'Mailing Address': lead.parcel.owner?.mailingAddressStandardized || '',
        Score: lead.parcel.score?.scoreTotal || 0,
        'Signal Count': lead.parcel.signals?.length || 0,
        'Top Signals': lead.parcel.score?.topReasons?.join('; ') || '',
        'Lead Status': lead.status,
        Tags: lead.tags.join(', '),
      }));

      const csv = stringify(propertyData, { header: true });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'export_property_data',
          resource: 'lead',
          metadata: { count: leads.length },
        },
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="property-data-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      logger.error('Error exporting property data:', error);
      res.status(500).json({ error: 'Failed to export property data' });
    }
  }
}

export const exportController = new ExportController();
