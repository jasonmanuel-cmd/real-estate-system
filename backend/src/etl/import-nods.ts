/**
 * Import Kern County Notice of Default recordings (pre-foreclosure).
 *
 * Source: Kern County Recorder's Official Records search, document
 * class 0043 (Default Notice), last 60 days. Each record is a borrower
 * (grantor) who received a Notice of Default - the first formal step
 * of foreclosure. These owners are highly motivated sellers.
 *
 * Usage: ts-node src/etl/import-nods.ts <path-to-json>
 *   JSON: [{ doc: "226085350", date: "07/24/2026", desc: "Default Notice", parties: "NAME (R) | NAME (R)" }]
 */

import dotenv from 'dotenv';
import prisma from '../config/database';

dotenv.config();

interface NodRecord {
  doc: string;
  date: string;
  desc: string;
  parties: string;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: ts-node import-nods.ts <path-to-json>');
    process.exit(1);
  }

  const records: NodRecord[] = JSON.parse(
    require('fs').readFileSync(jsonPath, 'utf8')
  );
  console.log(`Loaded ${records.length} NOD records`);

  let deedsCreated = 0;
  let linkedToParcel = 0;
  const ownerNames = new Set<string>();

  for (const rec of records) {
    try {
      // Grantors (R) are the defaulting borrowers
      const parties = rec.parties
        .split('|')
        .map((p) => p.replace(/\(R\)/g, '').replace(/\(E\)/g, '').trim())
        .filter((p) => p && p.length > 2);
      const primaryBorrower = parties[0] || 'UNKNOWN';
      ownerNames.add(primaryBorrower);

      // Try to link to an existing parcel by owner name (owners from the
      // tax-default import or assessor data)
      const owner = await prisma.owner.findFirst({
        where: { ownerNameClean: primaryBorrower },
      });

      let parcelId: string | null = null;
      if (owner) {
        const parcel = await prisma.parcel.findFirst({
          where: { ownerId: owner.id },
        });
        if (parcel) {
          parcelId = parcel.id;
          linkedToParcel++;
        }
      }

      // Record the NOD. Deeds require a parcelId; for borrowers not yet
      // matched to a parcel, create a stub parcel so the record is kept.
      let targetParcelId = parcelId;
      if (!targetParcelId) {
        const stubApn = `NOD${rec.doc}`;
        let stub = await prisma.parcel.findFirst({ where: { apn: stubApn } });
        if (!stub) {
          stub = await prisma.parcel.create({
            data: {
              apn: stubApn,
              countyFips: '06029',
              countyName: 'Kern',
              situsAddress: '',
              propertyType: 'OTHER',
              dataSourceName: 'Kern County Recorder NOD recordings (Jul-Sep 2026)',
              dataSourceDate: new Date(),
            },
          });
        }
        targetParcelId = stub.id;

        // Attach the borrower as owner
        if (primaryBorrower !== 'UNKNOWN') {
          const ownerIdStr = `Kern-NOD-${primaryBorrower}`;
          const existing = await prisma.owner.findUnique({ where: { id: ownerIdStr } });
          if (!existing) {
            await prisma.owner.create({
              data: {
                id: ownerIdStr,
                ownerNameRaw: primaryBorrower,
                ownerNameClean: primaryBorrower,
                ownerType: /LLC|INC|CORP|TRUST|LP|COMPANY|CO\b/.test(primaryBorrower) ? 'ENTITY' : 'PERSON',
                mailingAddressStandardized: '',
              },
            });
          }
          await prisma.parcel.update({
            where: { id: targetParcelId },
            data: { ownerId: ownerIdStr },
          });
        }
      }

      await prisma.deed.create({
        data: {
          parcelId: targetParcelId,
          docType: 'Default Notice',
          recordingDate: new Date(rec.date),
          grantorName: parties.join('; '),
          instrumentNumber: rec.doc,
        },
      });
      deedsCreated++;
    } catch (err: any) {
      console.error(`Failed ${rec.doc}: ${err.message}`);
    }
  }

  console.log(
    `Deeds (NOD records): ${deedsCreated} | linked to parcels: ${linkedToParcel} | unique borrowers: ${ownerNames.size}`
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});
