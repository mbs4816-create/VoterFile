import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOrganization, requirePermission } from '../middleware/auth';
import Busboy from 'busboy';
import { MN_VOTER_FILE_COLUMNS, MN_ELECTION_FILE_COLUMNS } from '@shared/types';

const router = Router();

// Store for active import jobs progress (in-memory, for demo - use Redis in production)
const importProgress = new Map<number, { processed: number; total: number; status: string }>();

// Get import jobs
router.get('/jobs', requireAuth, requireOrganization, async (req, res) => {
  try {
    const jobs = await db.query.importJobs.findMany({
      where: eq(schema.importJobs.organizationId, req.organizationId!),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      limit: 50,
    });

    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Get import jobs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get import jobs' });
  }
});

// Get single job status
router.get('/jobs/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);

    const job = await db.query.importJobs.findFirst({
      where: and(
        eq(schema.importJobs.id, jobId),
        eq(schema.importJobs.organizationId, req.organizationId!)
      ),
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Import job not found' });
    }

    // Get real-time progress if job is processing
    const progress = importProgress.get(jobId);
    if (progress && job.status === 'processing') {
      return res.json({
        success: true,
        data: {
          ...job,
          processedRows: progress.processed,
          status: progress.status,
        },
      });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Get import job error:', error);
    res.status(500).json({ success: false, error: 'Failed to get import job' });
  }
});

// Preview upload (get column headers)
router.post('/preview', requireAuth, requireOrganization, requirePermission('canImportData'), (req, res) => {
  const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 10 * 1024 } }); // Only read first 10KB for preview
  let headers: string[] = [];
  let sampleRows: string[][] = [];
  let rowCount = 0;

  busboy.on('file', (_fieldname, file, _info) => {
    let buffer = '';

    file.on('data', (data) => {
      buffer += data.toString();
      
      // Parse first few rows
      const lines = buffer.split('\n');
      
      if (headers.length === 0 && lines.length > 0) {
        headers = parseCSVLine(lines[0]);
      }
      
      for (let i = 1; i < lines.length && sampleRows.length < 5; i++) {
        if (lines[i].trim()) {
          sampleRows.push(parseCSVLine(lines[i]));
        }
      }
      
      if (sampleRows.length >= 5) {
        file.resume(); // Stop reading
      }
    });

    file.on('end', () => {
      // Final parse if needed
      if (headers.length === 0) {
        const lines = buffer.split('\n');
        if (lines.length > 0) {
          headers = parseCSVLine(lines[0]);
        }
      }
    });
  });

  busboy.on('finish', () => {
    res.json({
      success: true,
      data: {
        headers,
        sampleRows,
        suggestedMapping: suggestColumnMapping(headers),
      },
    });
  });

  busboy.on('error', (err) => {
    console.error('Preview upload error:', err);
    res.status(500).json({ success: false, error: 'Failed to preview file' });
  });

  req.pipe(busboy);
});

// Full import
router.post('/upload', requireAuth, requireOrganization, requirePermission('canImportData'), async (req, res) => {
  const busboy = Busboy({ 
    headers: req.headers, 
    limits: { files: 1, fileSize: 10 * 1024 * 1024 * 1024 } // 10GB limit
  });
  
  let importType = 'voters';
  let columnMapping: Record<string, string> = {};
  let fileName = 'unknown';
  let jobId: number | null = null;

  busboy.on('field', (fieldname, value) => {
    if (fieldname === 'type') {
      importType = value;
    } else if (fieldname === 'columnMapping') {
      try {
        columnMapping = JSON.parse(value);
      } catch (e) {
        console.error('Failed to parse column mapping:', e);
      }
    }
  });

  busboy.on('file', async (fieldname, file, info) => {
    fileName = info.filename;

    // Create import job
    const [job] = await db.insert(schema.importJobs).values({
      organizationId: req.organizationId!,
      createdBy: req.user!.id,
      type: importType,
      status: 'processing',
      fileName,
      columnMapping,
      startedAt: new Date(),
    }).returning();

    jobId = job.id;
    importProgress.set(jobId, { processed: 0, total: 0, status: 'processing' });

    // Process file in streaming fashion
    let buffer = '';
    let headers: string[] = [];
    let batch: any[] = [];
    let processedRows = 0;
    let successRows = 0;
    let errorRows = 0;
    const errors: { row: number; field?: string; message: string }[] = [];
    const BATCH_SIZE = 1000;

    file.on('data', async (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        if (headers.length === 0) {
          headers = parseCSVLine(line);
          continue;
        }

        const values = parseCSVLine(line);
        const row = headers.reduce((acc, header, i) => {
          acc[header] = values[i] || '';
          return acc;
        }, {} as Record<string, string>);

        try {
          const mappedRow = mapRowToSchema(row, columnMapping, importType);
          if (mappedRow) {
            batch.push(mappedRow);
          }
        } catch (err: any) {
          errorRows++;
          if (errors.length < 100) {
            errors.push({ row: processedRows + 1, message: err.message });
          }
        }

        processedRows++;

        // Insert batch
        if (batch.length >= BATCH_SIZE) {
          file.pause();
          try {
            if (importType === 'voters') {
              await insertVoterBatch(batch, req.organizationId!);
            } else {
              await insertElectionBatch(batch, req.organizationId!);
            }
            successRows += batch.length;
          } catch (err: any) {
            errorRows += batch.length;
            if (errors.length < 100) {
              errors.push({ row: processedRows, message: `Batch insert failed: ${err.message}` });
            }
          }
          batch = [];
          
          // Update progress
          importProgress.set(jobId!, { processed: processedRows, total: processedRows, status: 'processing' });
          file.resume();
        }
      }
    });

    file.on('end', async () => {
      // Process remaining buffer
      if (buffer.trim() && headers.length > 0) {
        const values = parseCSVLine(buffer);
        const row = headers.reduce((acc, header, i) => {
          acc[header] = values[i] || '';
          return acc;
        }, {} as Record<string, string>);

        try {
          const mappedRow = mapRowToSchema(row, columnMapping, importType);
          if (mappedRow) {
            batch.push(mappedRow);
          }
        } catch (err: any) {
          errorRows++;
        }
        processedRows++;
      }

      // Insert final batch
      if (batch.length > 0) {
        try {
          if (importType === 'voters') {
            await insertVoterBatch(batch, req.organizationId!);
          } else {
            await insertElectionBatch(batch, req.organizationId!);
          }
          successRows += batch.length;
        } catch (err: any) {
          errorRows += batch.length;
        }
      }

      // Update job status
      await db.update(schema.importJobs)
        .set({
          status: 'completed',
          totalRows: processedRows,
          processedRows,
          successRows,
          errorRows,
          errors,
          completedAt: new Date(),
        })
        .where(eq(schema.importJobs.id, jobId!));

      importProgress.delete(jobId!);
    });

    file.on('error', async (err) => {
      console.error('File stream error:', err);
      await db.update(schema.importJobs)
        .set({
          status: 'failed',
          errors: [{ row: 0, message: err.message }],
          completedAt: new Date(),
        })
        .where(eq(schema.importJobs.id, jobId!));
      importProgress.delete(jobId!);
    });
  });

  busboy.on('finish', () => {
    res.json({
      success: true,
      data: { jobId },
      message: 'Import started',
    });
  });

  busboy.on('error', (err) => {
    console.error('Busboy error:', err);
    res.status(500).json({ success: false, error: 'Upload failed' });
  });

  req.pipe(busboy);
});

// Get MN voter file column mapping suggestions
router.get('/mn-mapping', requireAuth, async (req, res) => {
  res.json({
    success: true,
    data: {
      voterColumns: MN_VOTER_FILE_COLUMNS,
      electionColumns: MN_ELECTION_FILE_COLUMNS,
    },
  });
});

// Helper functions

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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function suggestColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const header of headers) {
    const normalizedHeader = header.trim();
    
    // Check MN voter file columns
    if (normalizedHeader in MN_VOTER_FILE_COLUMNS) {
      mapping[normalizedHeader] = MN_VOTER_FILE_COLUMNS[normalizedHeader as keyof typeof MN_VOTER_FILE_COLUMNS];
    }
    // Check election file columns
    else if (normalizedHeader in MN_ELECTION_FILE_COLUMNS) {
      mapping[normalizedHeader] = MN_ELECTION_FILE_COLUMNS[normalizedHeader as keyof typeof MN_ELECTION_FILE_COLUMNS];
    }
  }
  
  return mapping;
}

function mapRowToSchema(row: Record<string, string>, columnMapping: Record<string, string>, type: string): any {
  const mapped: any = {};
  
  for (const [sourceCol, targetCol] of Object.entries(columnMapping)) {
    if (row[sourceCol] !== undefined && row[sourceCol] !== '') {
      let value: any = row[sourceCol];
      
      // Type conversions
      if (targetCol === 'dobYear') {
        value = parseInt(value, 10) || null;
      } else if (targetCol === 'permanentAbsentee') {
        value = value === 'Y' || value === 'true' || value === '1';
      } else if (targetCol === 'registrationDate' || targetCol === 'electionDate') {
        // Parse date
        if (value.includes('/')) {
          const parts = value.split('/');
          if (parts.length === 3) {
            value = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }
        } else if (value.includes(' ')) {
          value = value.split(' ')[0]; // Take date part only
        }
      }
      
      mapped[targetCol] = value;
    }
  }
  
  return Object.keys(mapped).length > 0 ? mapped : null;
}

async function insertVoterBatch(batch: any[], organizationId: number) {
  const votersToInsert = batch.map(v => ({
    ...v,
    organizationId,
  }));

  // Use ON CONFLICT for upsert based on stateVoterId
  await db.insert(schema.voters)
    .values(votersToInsert)
    .onConflictDoUpdate({
      target: [schema.voters.organizationId, schema.voters.stateVoterId],
      set: {
        firstName: schema.voters.firstName,
        lastName: schema.voters.lastName,
        // ... other fields would be updated
        updatedAt: new Date(),
      },
    });
}

async function insertElectionBatch(batch: any[], organizationId: number) {
  // For election history, we need to look up voter IDs first
  for (const record of batch) {
    if (record.stateVoterId) {
      const voter = await db.query.voters.findFirst({
        where: and(
          eq(schema.voters.organizationId, organizationId),
          eq(schema.voters.stateVoterId, record.stateVoterId)
        ),
        columns: { id: true },
      });

      if (voter) {
        await db.insert(schema.electionHistory).values({
          voterId: voter.id,
          organizationId,
          electionDate: record.electionDate,
          electionDescription: record.electionDescription,
          electionType: record.electionType,
          votingMethod: record.votingMethod,
        }).onConflictDoNothing();
      }
    }
  }
}

export default router;
