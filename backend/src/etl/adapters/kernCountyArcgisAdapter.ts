import axios from 'axios';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { EtlAdapter } from '../etlRunner';

/**
 * Kern County Assessor ArcGIS adapter - REAL DATA
 *
 * Source: Kern County parcel feature service (2026 Final tax roll),
 * published via ArcGIS Server. Serves countywide secured-roll parcels
 * with APN, situs address, use code/description, land/improvement/net
 * assessed values, and acreage.
 *
 * Note: owner names are NOT available from this source - California law
 * prohibits counties from publishing them in bulk data. Owner enrichment
 * must come from a separate source (kerndata.com, title pull, list
 * purchase). Parcels load without owner records.
 *
 * Config:
 *   KERN_ARCGIS_URL   - feature service query endpoint (default: Shafter-hosted
 *                       copy of the county 2026 Final roll)
 *   KERN_ARCGIS_LIMIT - max records per import (default 5000)
 */

const DEFAULT_URL =
  'https://gis.shafter.com/server/rest/services/Parcels_2026F_SMC/MapServer/1/query';

interface ArcgisRecord {
  APN: string;
  ADDR_SITUS?: string;
  USE_CODE?: string;
  USE_DESC?: string;
  LAND_VAL?: number;
  IMP_VAL?: number;
  NET_VAL?: number;
  SHAPE_ACRE?: number;
  ROLL?: string;
}

export class KernCountyArcgisAdapter implements EtlAdapter {
  name = 'kern_county_arcgis';
  countyName = 'Kern';

  private queryUrl = process.env.KERN_ARCGIS_URL || DEFAULT_URL;
  private limit = parseInt(process.env.KERN_ARCGIS_LIMIT || '5000');

  /**
   * EXTRACT: page through the ArcGIS feature service.
   * ROLL='1' filters to the secured tax roll.
   */
  async extract(): Promise<ArcgisRecord[]> {
    logger.info(
      `Extracting Kern County parcels from ArcGIS service (limit ${this.limit})`
    );

    const records: ArcgisRecord[] = [];
    const pageSize = 1000; // ArcGIS server max per request
    let offset = 0;

    while (records.length < this.limit) {
      const batch = Math.min(pageSize, this.limit - records.length);
      const url =
        `${this.queryUrl}?where=ROLL%3D%271%27` +
        `&outFields=APN,ADDR_SITUS,USE_CODE,USE_DESC,LAND_VAL,IMP_VAL,NET_VAL,SHAPE_ACRE,ROLL` +
        `&returnGeometry=false&resultRecordCount=${batch}` +
        `&resultOffset=${offset}&f=json`;

      const response = await axios.get(url, { timeout: 60000 });

      if (response.data.error) {
        throw new Error(`ArcGIS query error: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      if (features.length === 0) break;

      for (const f of features) {
        records.push(f.attributes);
      }

      logger.info(`Fetched ${records.length} parcels (offset ${offset})`);

      offset += features.length;
      if (features.length < batch) break; // exhausted
    }

    logger.info(`Extracted ${records.length} total Kern County parcels`);
    return records;
  }

  /**
   * TRANSFORM: map ArcGIS attributes to the parcel schema,
   * mirroring the CSV adapter's output shape.
   */
  async transform(rawData: ArcgisRecord[]): Promise<any[]> {
    const transformed: any[] = [];

    for (const r of rawData) {
      try {
        if (!r.APN) continue;

        // Parse situs "835 PHEASANT RUN DR, BAKERSFIELD" into parts
        const situs = (r.ADDR_SITUS || '').trim();
        let address = situs;
        let city = '';
        const commaIdx = situs.lastIndexOf(',');
        if (commaIdx > 0) {
          address = situs.slice(0, commaIdx).trim();
          city = situs.slice(commaIdx + 1).trim();
        }

        const parcelData = {
          countyFips: '06029',
          countyName: 'Kern',

          apn: this.normalizeApn(r.APN),

          situsAddress: this.normalizeAddress(address),
          city: city ? city.toUpperCase() : null,
          zip: null, // not provided by this source

          propertyType: this.mapPropertyType(r.USE_CODE, r.USE_DESC),
          landUseCode: r.USE_CODE || null,
          lotSize: r.SHAPE_ACRE || null,
          buildingSqft: null, // not provided by this source
          yearBuilt: null, // not provided by this source
          bedrooms: null,
          bathrooms: null,
          units: null,

          assessedValueTotal: r.NET_VAL || null,
          assessedValueLand: r.LAND_VAL || null,
          assessedValueImprovement: r.IMP_VAL || null,
          taxYear: 2026,

          // Owner names unavailable from this source (CA law)
          owner: null,

          dataSourceName: 'Kern County ArcGIS 2026 Final Roll',
          dataSourceDate: new Date(),

          lat: null,
          lng: null,
        };

        transformed.push(parcelData);
      } catch (error: any) {
        logger.warn(`Failed to transform ArcGIS record:`, error);
      }
    }

    logger.info(
      `Successfully transformed ${transformed.length}/${rawData.length} records`
    );
    return transformed;
  }

  /**
   * LOAD: upsert parcels (no owner records for this source).
   */
  async load(transformedData: any[]): Promise<void> {
    let loaded = 0;
    let failed = 0;

    for (const data of transformedData) {
      try {
        const { owner, ...parcelFields } = data; // owner not available from this source
        await prisma.parcel.upsert({
          where: { apn: parcelFields.apn },
          create: parcelFields,
          update: parcelFields,
        });
        loaded++;
      } catch (error: any) {
        logger.error(`Failed to load parcel ${data.apn}:`, error);
        failed++;
      }
    }

    logger.info(`Loaded ${loaded} parcels, ${failed} failed`);
  }

  // ============ HELPERS ============

  private normalizeApn(apn: string): string {
    if (!apn) return '';
    return apn.replace(/[-\s]/g, '').toUpperCase();
  }

  private normalizeAddress(address: string): string {
    if (!address) return '';
    return address.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private mapPropertyType(useCode?: string, useDesc?: string): string {
    const desc = (useDesc || '').toUpperCase();
    const code = (useCode || '').trim();

    if (desc.includes('SINGLE FAMILY')) return 'SFR';
    if (desc.includes('MULTI') || desc.includes('APARTMENT')) return 'MULTIFAMILY';
    if (desc.includes('COMMERCIAL')) return 'COMMERCIAL';
    if (desc.includes('INDUSTRIAL')) return 'COMMERCIAL';
    if (desc.includes('VACANT') || desc.includes('UNDEVELOPED')) return 'LAND';
    if (desc.includes('RURAL') || desc.includes('AG') || desc.includes('FARM')) {
      return desc.includes('RESIDENCE') ? 'SFR' : 'LAND';
    }
    // Kern use-code leading digit heuristics
    if (code.startsWith('0')) return 'SFR';
    if (code.startsWith('1')) return 'MULTIFAMILY';
    if (code.startsWith('2')) return 'COMMERCIAL';
    if (code.startsWith('5') || code.startsWith('6')) return 'LAND';
    return 'OTHER';
  }
}

export const kernCountyArcgisAdapter = new KernCountyArcgisAdapter();
