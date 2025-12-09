import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, or, ilike, sql, desc, asc, count } from 'drizzle-orm';
import { requireAuth, requireOrganization } from '../middleware/auth';
import type { VoterFilters } from '@shared/types';

const router = Router();

// Get voters with pagination and filters
router.get('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      congressionalDistrict,
      legislativeDistrict,
      stateSenateDistrict,
      county,
      city,
      zipCode,
      precinctCode,
      supportLevel,
      hasPhone,
      hasEmail,
      listId,
      sortBy = 'lastName',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions = [eq(schema.voters.organizationId, req.organizationId!)];

    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.voters.firstName, searchTerm),
          ilike(schema.voters.lastName, searchTerm),
          ilike(schema.voters.phone, searchTerm),
          ilike(schema.voters.streetName, searchTerm),
          ilike(schema.voters.city, searchTerm)
        )!
      );
    }

    if (congressionalDistrict) {
      conditions.push(eq(schema.voters.congressionalDistrict, congressionalDistrict as string));
    }

    if (legislativeDistrict) {
      conditions.push(eq(schema.voters.legislativeDistrict, legislativeDistrict as string));
    }

    if (stateSenateDistrict) {
      conditions.push(eq(schema.voters.stateSenateDistrict, stateSenateDistrict as string));
    }

    if (county) {
      conditions.push(eq(schema.voters.countyCode, county as string));
    }

    if (city) {
      conditions.push(ilike(schema.voters.city, city as string));
    }

    if (zipCode) {
      conditions.push(eq(schema.voters.zipCode, zipCode as string));
    }

    if (precinctCode) {
      conditions.push(eq(schema.voters.precinctCode, precinctCode as string));
    }

    if (supportLevel) {
      conditions.push(eq(schema.voters.supportLevel, parseInt(supportLevel as string, 10)));
    }

    if (hasPhone === 'true') {
      conditions.push(sql`${schema.voters.phone} IS NOT NULL AND ${schema.voters.phone} != ''`);
    }

    if (hasEmail === 'true') {
      conditions.push(sql`${schema.voters.email} IS NOT NULL AND ${schema.voters.email} != ''`);
    }

    // Handle list membership filter
    let query;
    if (listId) {
      query = db
        .select({
          voter: schema.voters,
        })
        .from(schema.voters)
        .innerJoin(
          schema.voterListMembers,
          and(
            eq(schema.voterListMembers.voterId, schema.voters.id),
            eq(schema.voterListMembers.listId, parseInt(listId as string, 10))
          )
        )
        .where(and(...conditions));
    } else {
      query = db.select().from(schema.voters).where(and(...conditions));
    }

    // Sorting
    const sortColumn = schema.voters[sortBy as keyof typeof schema.voters] || schema.voters.lastName;
    const orderFn = sortOrder === 'desc' ? desc : asc;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(schema.voters)
      .where(and(...conditions));

    // Get paginated data
    const voters = listId
      ? await db
          .select({ voter: schema.voters })
          .from(schema.voters)
          .innerJoin(
            schema.voterListMembers,
            and(
              eq(schema.voterListMembers.voterId, schema.voters.id),
              eq(schema.voterListMembers.listId, parseInt(listId as string, 10))
            )
          )
          .where(and(...conditions))
          .orderBy(orderFn(sortColumn as any))
          .limit(limitNum)
          .offset(offset)
          .then(rows => rows.map(r => r.voter))
      : await db
          .select()
          .from(schema.voters)
          .where(and(...conditions))
          .orderBy(orderFn(sortColumn as any))
          .limit(limitNum)
          .offset(offset);

    res.json({
      success: true,
      data: voters,
      total: countResult.count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult.count / limitNum),
    });
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({ success: false, error: 'Failed to get voters' });
  }
});

// Get single voter with full details
router.get('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.id, 10);

    const voter = await db.query.voters.findFirst({
      where: and(
        eq(schema.voters.id, voterId),
        eq(schema.voters.organizationId, req.organizationId!)
      ),
    });

    if (!voter) {
      return res.status(404).json({ success: false, error: 'Voter not found' });
    }

    // Get election history
    const elections = await db.query.electionHistory.findMany({
      where: eq(schema.electionHistory.voterId, voterId),
      orderBy: desc(schema.electionHistory.electionDate),
    });

    // Get interactions
    const interactions = await db.query.interactions.findMany({
      where: eq(schema.interactions.voterId, voterId),
      orderBy: desc(schema.interactions.createdAt),
      limit: 20,
      with: {
        user: true,
      },
    });

    // Get custom field values
    const customFieldValues = await db
      .select({
        fieldName: schema.customFieldDefinitions.fieldName,
        fieldLabel: schema.customFieldDefinitions.fieldLabel,
        fieldType: schema.customFieldDefinitions.fieldType,
        value: schema.customFieldValues.value,
      })
      .from(schema.customFieldValues)
      .innerJoin(
        schema.customFieldDefinitions,
        eq(schema.customFieldValues.fieldDefinitionId, schema.customFieldDefinitions.id)
      )
      .where(eq(schema.customFieldValues.voterId, voterId));

    // Get list memberships
    const listMemberships = await db
      .select({
        listId: schema.voterLists.id,
        listName: schema.voterLists.name,
        listType: schema.voterLists.type,
      })
      .from(schema.voterListMembers)
      .innerJoin(schema.voterLists, eq(schema.voterListMembers.listId, schema.voterLists.id))
      .where(eq(schema.voterListMembers.voterId, voterId));

    res.json({
      success: true,
      data: {
        ...voter,
        electionHistory: elections,
        interactions: interactions.map(i => ({
          ...i,
          userName: i.user ? `${i.user.firstName} ${i.user.lastName}` : 'Unknown',
        })),
        customFields: customFieldValues,
        lists: listMemberships,
      },
    });
  } catch (error) {
    console.error('Get voter error:', error);
    res.status(500).json({ success: false, error: 'Failed to get voter' });
  }
});

// Update voter
router.patch('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Don't allow updating organizationId or id
    delete updates.organizationId;
    delete updates.id;

    const [updated] = await db
      .update(schema.voters)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.voters.id, voterId),
        eq(schema.voters.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Voter not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update voter error:', error);
    res.status(500).json({ success: false, error: 'Failed to update voter' });
  }
});

// Create voter manually
router.post('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterData = req.body;

    const [voter] = await db.insert(schema.voters).values({
      ...voterData,
      organizationId: req.organizationId!,
    }).returning();

    res.json({ success: true, data: voter });
  } catch (error) {
    console.error('Create voter error:', error);
    res.status(500).json({ success: false, error: 'Failed to create voter' });
  }
});

// Delete voter
router.delete('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.id, 10);

    await db.delete(schema.voters).where(and(
      eq(schema.voters.id, voterId),
      eq(schema.voters.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'Voter deleted' });
  } catch (error) {
    console.error('Delete voter error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete voter' });
  }
});

// Get distinct values for filters
router.get('/filters/options', requireAuth, requireOrganization, async (req, res) => {
  try {
    const [
      congressionalDistricts,
      legislativeDistricts,
      senateDistricts,
      counties,
      cities,
    ] = await Promise.all([
      db.selectDistinct({ value: schema.voters.congressionalDistrict })
        .from(schema.voters)
        .where(and(
          eq(schema.voters.organizationId, req.organizationId!),
          sql`${schema.voters.congressionalDistrict} IS NOT NULL`
        ))
        .orderBy(schema.voters.congressionalDistrict),
      db.selectDistinct({ value: schema.voters.legislativeDistrict })
        .from(schema.voters)
        .where(and(
          eq(schema.voters.organizationId, req.organizationId!),
          sql`${schema.voters.legislativeDistrict} IS NOT NULL`
        ))
        .orderBy(schema.voters.legislativeDistrict),
      db.selectDistinct({ value: schema.voters.stateSenateDistrict })
        .from(schema.voters)
        .where(and(
          eq(schema.voters.organizationId, req.organizationId!),
          sql`${schema.voters.stateSenateDistrict} IS NOT NULL`
        ))
        .orderBy(schema.voters.stateSenateDistrict),
      db.selectDistinct({ value: schema.voters.countyCode })
        .from(schema.voters)
        .where(and(
          eq(schema.voters.organizationId, req.organizationId!),
          sql`${schema.voters.countyCode} IS NOT NULL`
        ))
        .orderBy(schema.voters.countyCode),
      db.selectDistinct({ value: schema.voters.city })
        .from(schema.voters)
        .where(and(
          eq(schema.voters.organizationId, req.organizationId!),
          sql`${schema.voters.city} IS NOT NULL`
        ))
        .orderBy(schema.voters.city)
        .limit(100),
    ]);

    res.json({
      success: true,
      data: {
        congressionalDistricts: congressionalDistricts.map(r => r.value).filter(Boolean),
        legislativeDistricts: legislativeDistricts.map(r => r.value).filter(Boolean),
        senateDistricts: senateDistricts.map(r => r.value).filter(Boolean),
        counties: counties.map(r => r.value).filter(Boolean),
        cities: cities.map(r => r.value).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ success: false, error: 'Failed to get filter options' });
  }
});

export default router;
