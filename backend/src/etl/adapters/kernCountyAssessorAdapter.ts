import { EtlAdapter } from '../etlRunner';
import { PropertyType, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import axios from 'axios';
import fs from 'fs';
import csv from 'csv-parser';

/**
 * Kern County Assessor Data Adapter
 *
 * DATA SOURCE OPTIONS:
 * 1. Kern County Assessor API (if available)
 * 2. Bulk download CSV from county website
 * 3. Manual CSV upload
 *
 * This adapter implements option 2/3 (CSV import)
 * Modify the extract() method based on actual data source
 */
export class KernCountyAssessorAdapter implements EtlAdapter {
  name = 'kern_county_assessor';
  countyName = 'Kern';

  // Configure data source
  private dataSourceUrl = process.env.KERN_COUNTY_DATA_SOURCE_URL || '';
  private dataSourceFile = process.env.KERN_COUNTY_DATA_FILE || './data/kern_assessor.csv';

  /**
   * EXTRACT: Get raw data from source
   *
   * Implementation options:
   * - Download from URL
   * - Read from local file
   * - Call API
   */
  async extract(): Promise<any[]> {
    logger.info(`Extracting Kern County assessor data from ${this.dataSourceFile}`);

    // Option 1: Download from URL (if available)
    if (this.dataSourceUrl) {
      return this.extractFromUrl();
    }

    // Option 2: Read from local file
    if (fs.existsSync(this.dataSourceFile)) {
      return this.extractFromFile();
    }

    throw new Error('No data source configured for Kern County. Please set KERN_COUNTY_DATA_FILE or KERN_COUNTY_DATA_SOURCE_URL');
  }

  /**
   * Extract from URL (download CSV)
   */
  private async extractFromUrl(): Promise<any[]> {
    try {
      const response = await axios.get(this.dataSourceUrl, { responseType: 'stream' });

      return new Promise((resolve, reject) => {
        const results: any[] = [];
        response.data
          .pipe(csv())
          .on('data', (data: any) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error: any) => reject(error));
      });
    } catch (error: any) {
      logger.error('Error downloading data:', error);
      throw error;
    }
  }

  /**
   * Extract from local CSV file
   */
  private async extractFromFile(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      fs.createReadStream(this.dataSourceFile)
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error: any) => reject(error));
    });
  }

  /**
   * TRANSFORM: Clean and normalize raw data
   *
   * Map county-specific field names to our schema
   * This mapping will vary by county - update based on actual data structure
   */
  async transform(rawData: any[]): Promise<any[]> {
    const transformed: any[] = [];

    for (const row of rawData) {
      try {
        // IMPORTANT: Adjust field mappings based on actual Kern County data structure
        // Common field names from assessor data:
        // - APN (Assessor Parcel Number)
        // - SITUS_ADDRESS, SIT_ADDR, PROPERTY_ADDRESS
        // - OWNER_NAME, OWNER1, OWNER2
        // - MAIL_ADDRESS, MAILING_ADDR
        // - ASSESSED_VALUE, LAND_VALUE, IMPROVEMENT_VALUE
        // - PROPERTY_TYPE, USE_CODE, LAND_USE
        // - SQUARE_FEET, LOT_SIZE, YEAR_BUILT

        const parcelData = {
          // County info
          countyFips: '06029', // Kern County FIPS code
          countyName: 'Kern',

          // APN (normalize: remove dashes, standardize format)
          apn: this.normalizeApn(row.APN || row.apn || row['Assessor Parcel Number']),

          // Situs address (property location)
          situsAddress: this.normalizeAddress(
            row.SITUS_ADDRESS || row.SIT_ADDR || row['Property Address'] || row.ADDRESS
          ),
          city: row.SITUS_CITY || row.CITY || null,
          zip: row.SITUS_ZIP || row.ZIP || row['Zip Code'] || null,

          // Property characteristics
          propertyType: this.mapPropertyType(row.USE_CODE || row.LAND_USE || row['Property Type']),
          landUseCode: row.USE_CODE || row.LAND_USE || null,
          lotSize: this.parseNumber(row.LOT_SIZE || row['Lot Size (Acres)']) || null,
          buildingSqft: this.parseNumber(row.BUILDING_SQFT || row.SQUARE_FEET || row['Building Sq Ft']) || null,
          yearBuilt: this.parseNumber(row.YEAR_BUILT || row['Year Built']) || null,
          bedrooms: this.parseNumber(row.BEDROOMS || row.BEDS) || null,
          bathrooms: this.parseNumber(row.BATHROOMS || row.BATHS) || null,
          units: this.parseNumber(row.UNITS || row['Number of Units']) || null,

          // Assessed values
          assessedValueTotal: this.parseNumber(row.ASSESSED_VALUE || row['Total Assessed Value']) || null,
          assessedValueLand: this.parseNumber(row.LAND_VALUE || row['Land Value']) || null,
          assessedValueImprovement: this.parseNumber(row.IMPROVEMENT_VALUE || row['Improvement Value']) || null,
          taxYear: this.parseNumber(row.TAX_YEAR || new Date().getFullYear()),

          // Owner information
          owner: {
            ownerNameRaw: row.OWNER_NAME || row.OWNER1 || row['Owner Name'] || 'Unknown',
            ownerNameClean: this.cleanOwnerName(row.OWNER_NAME || row.OWNER1 || row['Owner Name']),
            ownerType: this.determineOwnerType(row.OWNER_NAME || row.OWNER1 || row['Owner Name']),
            mailingAddressStandardized: this.normalizeAddress(
              row.MAIL_ADDRESS || row.MAILING_ADDR || row['Mailing Address']
            ),
            mailingCity: row.MAIL_CITY || null,
            mailingState: row.MAIL_STATE || null,
            mailingZip: row.MAIL_ZIP || null,
          },

          // Data source metadata
          dataSourceName: 'Kern County Assessor',
          dataSourceDate: new Date(),
        };

        // Geocoding (optional - can be done in post-processing)
        // For now, leave lat/lng null - can add geocoding service later
        parcelData['lat'] = null;
        parcelData['lng'] = null;

        transformed.push(parcelData);
      } catch (error: any) {
        logger.warn(`Failed to transform row:`, error);
        // Continue processing other rows
      }
    }

    logger.info(`Successfully transformed ${transformed.length}/${rawData.length} records`);
    return transformed;
  }

  /**
   * LOAD: Insert/update data in database
   */
  async load(transformedData: any[]): Promise<void> {
    let loaded = 0;
    let failed = 0;

    for (const data of transformedData) {
      try {
        // Upsert owner
        let owner = null;
        if (data.owner) {
          owner = await prisma.owner.upsert({
            where: {
              id: `${this.countyName}-${data.owner.ownerNameClean}-${data.owner.mailingAddressStandardized || 'no-mail'}`,
            },
            create: {
              id: `${this.countyName}-${data.owner.ownerNameClean}-${data.owner.mailingAddressStandardized || 'no-mail'}`,
              ...data.owner,
            },
            update: data.owner,
          });
        }

        // Upsert parcel
        await prisma.parcel.upsert({
          where: {
            countyFips_apn: {
              countyFips: data.countyFips,
              apn: data.apn,
            },
          },
          create: {
            ...data,
            ownerId: owner?.id,
            owner: undefined, // Remove nested owner object
          },
          update: {
            ...data,
            ownerId: owner?.id,
            owner: undefined,
          },
        });

        loaded++;
      } catch (error: any) {
        logger.error(`Failed to load parcel ${data.apn}:`, error);
        failed++;
      }
    }

    logger.info(`Loaded ${loaded} parcels, ${failed} failed`);
  }

  // ============ HELPER METHODS ============

  private normalizeApn(apn: string): string {
    if (!apn) return '';
    // Remove dashes, spaces, and standardize
    return apn.replace(/[-\s]/g, '').toUpperCase();
  }

  private normalizeAddress(address: string): string {
    if (!address) return '';
    return address
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private cleanOwnerName(name: string): string {
    if (!name) return 'Unknown';
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private determineOwnerType(name: string): 'PERSON' | 'ENTITY' | 'UNKNOWN' {
    if (!name) return 'UNKNOWN';

    const entityKeywords = ['LLC', 'INC', 'CORP', 'LP', 'TRUST', 'PARTNERSHIP', 'COMPANY', 'CO'];
    const nameUpper = name.toUpperCase();

    for (const keyword of entityKeywords) {
      if (nameUpper.includes(keyword)) {
        return 'ENTITY';
      }
    }

    // Check if it looks like a person name (has comma, or multiple words without entity keywords)
    if (nameUpper.includes(',')) {
      return 'PERSON';
    }

    return 'UNKNOWN';
  }

  private mapPropertyType(useCode: string): PropertyType {
    if (!useCode) return PropertyType.OTHER;

    const code = useCode.toUpperCase();

    // Common patterns (adjust based on Kern County codes)
    if (code.includes('SFR') || code.includes('SINGLE') || code.includes('RESIDENTIAL')) {
      return PropertyType.SFR;
    }
    if (code.includes('LAND') || code.includes('VACANT')) {
      return PropertyType.LAND;
    }
    if (code.includes('MULTI') || code.includes('APARTMENT') || code.includes('DUPLEX')) {
      return PropertyType.MULTIFAMILY;
    }
    if (code.includes('COMM') || code.includes('OFFICE') || code.includes('RETAIL') || code.includes('INDUSTRIAL')) {
      return PropertyType.COMMERCIAL;
    }

    return PropertyType.OTHER;
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace(/[,$]/g, ''));
    return isNaN(num) ? null : num;
  }
}

export const kernCountyAssessorAdapter = new KernCountyAssessorAdapter();
