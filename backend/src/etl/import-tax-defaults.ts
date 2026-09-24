/**
 * Import Kern County tax-defaulted parcels (published delinquent list).
 *
 * Source: Kern County Treasurer-Tax Collector's published Notice of
 * Delinquent Taxes (public notice, printed in county newspapers Aug 2026).
 * Contains APN, owner name, and amount owed.
 *
 * Matches against existing parcels; for unmatched APNs, creates a new
 * parcel record with data from the notice itself (owner + delinquency).
 *
 * Usage: ts-node src/etl/import-tax-defaults.ts <path-to-json>
 *   JSON: [{ apn: "052-623-13-01-1", amount: 47.00, owner: "NAME" }]
 */

import dotenv from 'dotenv';
import prisma from '../config/database';
import { logger } from '../utils/logger';

dotenv.config();

interface TaxDefaultRecord {
  apn: string;
  amount: number;
  owner: string;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: ts-node import-tax-defaults.ts <path-to-json>');
    process.exit(1);
  }

  const records: TaxDefaultRecord[] = JSON.parse(
    require('fs').readFileSync(jsonPath, 'utf8')
  );
  console.log(`Loaded ${records.length} tax-default records`);

  let matched = 0;
  let created = 0;
  let ownersCreated = 0;
  let signalsCreated = 0;

  for (const rec of records) {
    try {
      if (!rec.apn) continue;

      // Published APN: 052-623-13-01-1 (book-page-parcel-sub-ownership-check)
      // Our DB APN: first 8 digits (book-page-parcel), or TD-prefixed for
      // tax-default stub records created by a previous run of this importer.
      const apn8 = rec.apn.replace(/-/g, '').slice(0, 8);

      let parcel =
        (await prisma.parcel.findFirst({ where: { apn: apn8 } })) ||
        (await prisma.parcel.findFirst({ where: { apn: `TD${apn8}` } }) as any);

      if (!parcel) {
        // Create a parcel record from the notice data
        parcel = await prisma.parcel.create({
          data: {
            apn: `TD${apn8}`, // prefix: tax-default record, not in assessor pull
            countyFips: '06029',
            countyName: 'Kern',
            situsAddress: '',
            propertyType: 'OTHER',
            dataSourceName: 'Kern TTC Published Delinquent List (Aug 2026)',
            dataSourceDate: new Date(),
          },
        });
        created++;
      } else {
        matched++;
      }

      // Owner record from the public notice
      let ownerId: string | null = null;
      if (rec.owner) {
        const ownerIdStr = `Kern-TD-${rec.owner}`;
        const existingOwner = await prisma.owner.findUnique({
          where: { id: ownerIdStr },
        });
        if (!existingOwner) {
          await prisma.owner.create({
            data: {
              id: ownerIdStr,
              ownerNameRaw: rec.owner,
              ownerNameClean: rec.owner,
              ownerType: /LLC|INC|CORP|TRUST|LP|COMPANY|CO\b|FOUNDATION|CHURCH|ESTATE/.test(rec.owner)
                ? 'ENTITY'
                : 'PERSON',
              mailingAddressStandardized: '',
            },
          });
          ownersCreated++;
        }
        ownerId = ownerIdStr;

        await prisma.parcel.update({
          where: { id: parcel.id },
          data: { ownerId },
        });
      }

      // TAX_DELINQUENT signal with the actual amount owed
      await prisma.signal.deleteMany({
        where: { parcelId: parcel.id, signalType: 'TAX_DELINQUENT' },
      });
      await prisma.signal.create({
        data: {
          parcelId: parcel.id,
          signalType: 'TAX_DELINQUENT',
          severity: rec.amount > 10000 ? 5 : rec.amount > 1000 ? 4 : 3,
          signalDate: new Date(),
          sourceName: 'Kern County TTC Published Delinquent List (Aug 2026)',
          rawPayload: JSON.stringify({
            delinquentAmount: rec.amount,
            delinquentYears: '2024-2025',
            owner: rec.owner,
          }),
        },
      });
      signalsCreated++;
    } catch (err: any) {
      console.error(`Failed ${rec.apn}: ${err.message}`);
    }
  }

  console.log(
    `Matched existing: ${matched} | New parcel records: ${created} | Owners: ${ownersCreated} | Signals: ${signalsCreated}`
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});
