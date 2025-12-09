/**
 * VoterPulse - Minnesota Voter File Import Script
 * 
 * This script imports the unified District##_Unified.csv files into the PostgreSQL database.
 * It handles large files efficiently using streaming and batch inserts.
 * 
 * Usage:
 *   npx tsx scripts/import-voters.ts [district]
 * 
 * Examples:
 *   npx tsx scripts/import-voters.ts          # Import all districts
 *   npx tsx scripts/import-voters.ts 1        # Import District 1 only
 *   npx tsx scripts/import-voters.ts 3,5,7    # Import Districts 3, 5, and 7
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema';

// Configuration
const BATCH_SIZE = 1000;
const DATA_DIR = path.join(__dirname, '..');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Initialize database connection
const pool = new Pool({ connectionString: DB_URL });
const db = drizzle(pool, { schema });

// Column mapping for Minnesota Voter File
// Based on the unified CSV format created from Voter + Election files
const COLUMN_MAP: Record<string, string> = {
  'VoterId': 'stateVoterId',
  'CountyCode': 'countyId',
  'FirstName': 'firstName',
  'MiddleName': 'middleName',
  'LastName': 'lastName',
  'NameSuffix': 'suffix',
  'HouseNumber': 'houseNumber',
  'StreetName': 'streetName',
  'UnitType': 'unitType',
  'UnitNumber': 'unitNumber',
  'Address': 'address',
  'City': 'city',
  'State': 'state',
  'ZipCode': 'zipCode',
  'Zip4': 'zip4',
  'MailAddress': 'mailingAddress',
  'MailCity': 'mailingCity',
  'MailState': 'mailingState',
  'MailZip': 'mailingZip',
  'DOB': 'dateOfBirth',
  'DOBYear': 'yearOfBirth',
  'RegistrationDate': 'registrationDate',
  'VoterStatus': 'registrationStatus',
  'Party': 'partyAffiliation',
  'CongressDistrict': 'congressionalDistrict',
  'MNLegDistrict': 'stateSenateDistrict',
  'MNLegSubDistrict': 'stateHouseDistrict',
  'CountyCommissioner': 'countyCommissioner',
  'JudicialDistrict': 'judicialDistrict',
  'SchoolDistrict': 'schoolDistrict',
  'SchoolSubDistrict': 'schoolSubDistrict',
  'PrecinctCode': 'precinctId',
  'PrecinctName': 'precinctName',
  'Ward': 'ward',
  'MunicipalityCode': 'municipalityCode',
  'MunicipalityName': 'municipality',
  'Latitude': 'latitude',
  'Longitude': 'longitude',
};

// Election history columns
const ELECTION_COLUMNS = [
  'ElectionDate', 'ElectionType', 'VotingMethod', 'PartyVoted'
];

interface VoterRecord {
  stateVoterId: string;
  organizationId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameSuffix?: string;
  houseNumber?: string;
  streetName?: string;
  unitType?: string;
  unitNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  countyCode?: string;
  countyName?: string;
  precinctCode?: string;
  precinctName?: string;
  congressionalDistrict?: string;
  stateSenateDistrict?: string;
  legislativeDistrict?: string;
  schoolDistrict?: string;
  judicialDistrict?: string;
  party?: string;
  dobYear?: number;
  registrationDate?: string; // YYYY-MM-DD format
  phone?: string;
  email?: string;
}

interface ElectionRecord {
  voterId: number;
  organizationId: number;
  electionDate: string; // YYYY-MM-DD format
  electionType?: string;
  votingMethod?: string;
}

interface ImportStats {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  electionRecords: number;
}

async function getOrCreateOrganization(): Promise<number> {
  // Check if default organization exists
  const existing = await db.select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'minnesota-default'))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create default organization
  const result = await db.insert(schema.organizations)
    .values({
      name: 'Minnesota Voter File',
      slug: 'minnesota-default',
      settings: {},
    })
    .returning({ id: schema.organizations.id });

  console.log('✓ Created default organization');
  return result[0].id;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') return undefined;
  
  // Already in YYYY-MM-DD format
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return value;
  }

  // MM/DD/YYYY or M/D/YYYY format
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    const year = usMatch[3];
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

async function importDistrict(
  districtNum: number,
  orgId: number
): Promise<ImportStats> {
  const fileName = `District${String(districtNum).padStart(2, '0')}_Unified.csv`;
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileName}`);
    return { totalRows: 0, imported: 0, updated: 0, skipped: 0, errors: 0, electionRecords: 0 };
  }

  console.log(`\n📂 Processing ${fileName}...`);

  const stats: ImportStats = {
    totalRows: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    electionRecords: 0,
  };

  // Create read stream
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let isFirstLine = true;
  let voterBatch: VoterRecord[] = [];
  let electionBatch: { stateVoterId: string; elections: Omit<ElectionRecord, 'voterId'>[] }[] = [];

  const processBatch = async () => {
    if (voterBatch.length === 0) return;

    try {
      // Insert or update voters
      for (const voter of voterBatch) {
        const existing = await db.select({ id: schema.voters.id })
          .from(schema.voters)
          .where(eq(schema.voters.stateVoterId, voter.stateVoterId))
          .limit(1);

        if (existing.length > 0) {
          // Update existing voter
          await db.update(schema.voters)
            .set({ ...voter, updatedAt: new Date() })
            .where(eq(schema.voters.id, existing[0].id));
          stats.updated++;
        } else {
          // Insert new voter
          await db.insert(schema.voters)
            .values(voter);
          stats.imported++;
        }
      }

      // Process election history
      for (const item of electionBatch) {
        const voter = await db.select({ id: schema.voters.id })
          .from(schema.voters)
          .where(eq(schema.voters.stateVoterId, item.stateVoterId))
          .limit(1);

        if (voter.length > 0 && item.elections.length > 0) {
          for (const election of item.elections) {
            try {
              await db.insert(schema.electionHistory)
                .values({
                  voterId: voter[0].id,
                  ...election,
                })
                .onConflictDoNothing();
              stats.electionRecords++;
            } catch {
              // Ignore duplicate election records
            }
          }
        }
      }
    } catch (error) {
      console.error('Batch error:', error);
      stats.errors += voterBatch.length;
    }

    voterBatch = [];
    electionBatch = [];
  };

  for await (const line of rl) {
    if (isFirstLine) {
      // Parse headers - handle both comma and tab delimited
      headers = line.includes('\t') ? line.split('\t') : line.split(',');
      headers = headers.map(h => h.replace(/^"|"$/g, '').trim());
      isFirstLine = false;
      continue;
    }

    stats.totalRows++;

    try {
      // Parse row
      const values = line.includes('\t') ? line.split('\t') : parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.replace(/^"|"$/g, '').trim() || '';
      });

      // Build voter record to match schema
      const voter: VoterRecord = {
        stateVoterId: row['VoterId'] || row['StateVoterId'] || '',
        organizationId: orgId,
        firstName: row['FirstName'],
        middleName: row['MiddleName'],
        lastName: row['LastName'],
        nameSuffix: row['NameSuffix'] || row['Suffix'],
        houseNumber: row['HouseNumber'],
        streetName: row['StreetName'],
        unitType: row['UnitType'],
        unitNumber: row['UnitNumber'],
        city: row['City'],
        state: row['State'] || 'MN',
        zipCode: row['ZipCode'] || row['Zip'],
        countyCode: row['CountyCode'],
        countyName: row['County'] || row['CountyName'],
        precinctCode: row['PrecinctCode'],
        precinctName: row['PrecinctName'],
        congressionalDistrict: String(districtNum),
        stateSenateDistrict: row['MNLegDistrict'],
        legislativeDistrict: row['MNLegSubDistrict'],
        schoolDistrict: row['SchoolDistrict'],
        judicialDistrict: row['JudicialDistrict'],
        party: row['Party'],
        dobYear: parseNumber(row['DOBYear']) as number | undefined,
        registrationDate: parseDate(row['RegistrationDate']),
      };

      if (!voter.stateVoterId) {
        stats.skipped++;
        continue;
      }

      voterBatch.push(voter);

      // Parse election history if present
      const elections: Omit<ElectionRecord, 'voterId'>[] = [];
      
      // Look for election columns (format: ElectionDate_1, ElectionType_1, etc.)
      for (let i = 1; i <= 20; i++) {
        const dateKey = `ElectionDate_${i}`;
        const typeKey = `ElectionType_${i}`;
        const methodKey = `VotingMethod_${i}`;
        
        if (row[dateKey]) {
          const electionDate = parseDate(row[dateKey]);
          if (electionDate) {
            elections.push({
              organizationId: orgId,
              electionDate,
              electionType: row[typeKey] || 'General',
              votingMethod: row[methodKey],
            });
          }
        }
      }

      // Also check for single election columns
      if (row['ElectionDate']) {
        const electionDate = parseDate(row['ElectionDate']);
        if (electionDate) {
          elections.push({
            organizationId: orgId,
            electionDate,
            electionType: row['ElectionType'] || 'General',
            votingMethod: row['VotingMethod'],
          });
        }
      }

      electionBatch.push({ stateVoterId: voter.stateVoterId, elections });

      // Process batch
      if (voterBatch.length >= BATCH_SIZE) {
        await processBatch();
        process.stdout.write(`\r  Processed ${stats.totalRows.toLocaleString()} rows...`);
      }
    } catch (error) {
      stats.errors++;
    }
  }

  // Process remaining records
  await processBatch();

  console.log(`\n  ✓ ${fileName}: ${stats.imported.toLocaleString()} imported, ${stats.updated.toLocaleString()} updated, ${stats.skipped.toLocaleString()} skipped, ${stats.errors.toLocaleString()} errors`);
  
  if (stats.electionRecords > 0) {
    console.log(`    ✓ ${stats.electionRecords.toLocaleString()} election history records`);
  }

  return stats;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        VoterPulse - Minnesota Voter File Import           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Parse command line arguments
  const args = process.argv.slice(2);
  let districts: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

  if (args.length > 0) {
    districts = args[0].split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
  }

  console.log(`\n📋 Districts to import: ${districts.join(', ')}`);

  try {
    // Get or create organization
    const orgId = await getOrCreateOrganization();
    console.log(`✓ Organization ID: ${orgId}`);

    // Import each district
    const totals: ImportStats = {
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      electionRecords: 0,
    };

    for (const district of districts) {
      const stats = await importDistrict(district, orgId);
      totals.totalRows += stats.totalRows;
      totals.imported += stats.imported;
      totals.updated += stats.updated;
      totals.skipped += stats.skipped;
      totals.errors += stats.errors;
      totals.electionRecords += stats.electionRecords;
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('                     IMPORT COMPLETE');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`  Total Rows Processed: ${totals.totalRows.toLocaleString()}`);
    console.log(`  Voters Imported:      ${totals.imported.toLocaleString()}`);
    console.log(`  Voters Updated:       ${totals.updated.toLocaleString()}`);
    console.log(`  Rows Skipped:         ${totals.skipped.toLocaleString()}`);
    console.log(`  Errors:               ${totals.errors.toLocaleString()}`);
    console.log(`  Election Records:     ${totals.electionRecords.toLocaleString()}`);
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
