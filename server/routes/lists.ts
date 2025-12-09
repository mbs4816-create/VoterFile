import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, count, inArray, sql } from 'drizzle-orm';
import { requireAuth, requireOrganization } from '../middleware/auth';

const router = Router();

// Get all lists
router.get('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const lists = await db
      .select({
        list: schema.voterLists,
        memberCount: count(schema.voterListMembers.id),
      })
      .from(schema.voterLists)
      .leftJoin(
        schema.voterListMembers,
        eq(schema.voterListMembers.listId, schema.voterLists.id)
      )
      .where(eq(schema.voterLists.organizationId, req.organizationId!))
      .groupBy(schema.voterLists.id)
      .orderBy(schema.voterLists.name);

    res.json({
      success: true,
      data: lists.map(l => ({
        ...l.list,
        memberCount: l.memberCount,
      })),
    });
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ success: false, error: 'Failed to get lists' });
  }
});

// Create list
router.post('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { name, description, type = 'custom', isPublic = true, filterCriteria, isDynamic = false } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const [list] = await db.insert(schema.voterLists).values({
      organizationId: req.organizationId!,
      createdBy: req.user!.id,
      name,
      description,
      type,
      isPublic,
      filterCriteria,
      isDynamic,
    }).returning();

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ success: false, error: 'Failed to create list' });
  }
});

// Get single list
router.get('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);

    const list = await db.query.voterLists.findFirst({
      where: and(
        eq(schema.voterLists.id, listId),
        eq(schema.voterLists.organizationId, req.organizationId!)
      ),
      with: {
        creator: true,
      },
    });

    if (!list) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    // Get member count
    const [countResult] = await db
      .select({ count: count() })
      .from(schema.voterListMembers)
      .where(eq(schema.voterListMembers.listId, listId));

    res.json({
      success: true,
      data: {
        ...list,
        memberCount: countResult.count,
        creatorName: list.creator ? `${list.creator.firstName} ${list.creator.lastName}` : 'Unknown',
      },
    });
  } catch (error) {
    console.error('Get list error:', error);
    res.status(500).json({ success: false, error: 'Failed to get list' });
  }
});

// Update list
router.patch('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);
    const { name, description, type, isPublic, filterCriteria, isDynamic } = req.body;

    const [updated] = await db
      .update(schema.voterLists)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(isPublic !== undefined && { isPublic }),
        ...(filterCriteria !== undefined && { filterCriteria }),
        ...(isDynamic !== undefined && { isDynamic }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.voterLists.id, listId),
        eq(schema.voterLists.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({ success: false, error: 'Failed to update list' });
  }
});

// Delete list
router.delete('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);

    await db.delete(schema.voterLists).where(and(
      eq(schema.voterLists.id, listId),
      eq(schema.voterLists.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'List deleted' });
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete list' });
  }
});

// Add voters to list
router.post('/:id/voters', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);
    const { voterIds } = req.body;

    if (!Array.isArray(voterIds) || voterIds.length === 0) {
      return res.status(400).json({ success: false, error: 'voterIds array is required' });
    }

    // Verify list exists and belongs to org
    const list = await db.query.voterLists.findFirst({
      where: and(
        eq(schema.voterLists.id, listId),
        eq(schema.voterLists.organizationId, req.organizationId!)
      ),
    });

    if (!list) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    // Insert members (ignore duplicates)
    await db.insert(schema.voterListMembers)
      .values(voterIds.map((voterId: number) => ({
        listId,
        voterId,
        addedBy: req.user!.id,
      })))
      .onConflictDoNothing();

    res.json({ success: true, message: `Added ${voterIds.length} voters to list` });
  } catch (error) {
    console.error('Add voters to list error:', error);
    res.status(500).json({ success: false, error: 'Failed to add voters to list' });
  }
});

// Remove voters from list
router.delete('/:id/voters', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);
    const { voterIds } = req.body;

    if (!Array.isArray(voterIds) || voterIds.length === 0) {
      return res.status(400).json({ success: false, error: 'voterIds array is required' });
    }

    await db.delete(schema.voterListMembers).where(and(
      eq(schema.voterListMembers.listId, listId),
      inArray(schema.voterListMembers.voterId, voterIds)
    ));

    res.json({ success: true, message: `Removed ${voterIds.length} voters from list` });
  } catch (error) {
    console.error('Remove voters from list error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove voters from list' });
  }
});

// Get list members (voters in list)
router.get('/:id/voters', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Verify list belongs to org
    const list = await db.query.voterLists.findFirst({
      where: and(
        eq(schema.voterLists.id, listId),
        eq(schema.voterLists.organizationId, req.organizationId!)
      ),
    });

    if (!list) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    // Get members count
    const [countResult] = await db
      .select({ count: count() })
      .from(schema.voterListMembers)
      .where(eq(schema.voterListMembers.listId, listId));

    // Get members with voter details
    const members = await db
      .select({
        voter: schema.voters,
        addedAt: schema.voterListMembers.addedAt,
      })
      .from(schema.voterListMembers)
      .innerJoin(schema.voters, eq(schema.voterListMembers.voterId, schema.voters.id))
      .where(eq(schema.voterListMembers.listId, listId))
      .orderBy(schema.voters.lastName, schema.voters.firstName)
      .limit(limitNum)
      .offset(offset);

    res.json({
      success: true,
      data: members.map(m => ({
        ...m.voter,
        addedAt: m.addedAt,
      })),
      total: countResult.count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult.count / limitNum),
    });
  } catch (error) {
    console.error('Get list members error:', error);
    res.status(500).json({ success: false, error: 'Failed to get list members' });
  }
});

// Populate list from filter criteria
router.post('/:id/populate', requireAuth, requireOrganization, async (req, res) => {
  try {
    const listId = parseInt(req.params.id, 10);
    const { filterCriteria } = req.body;

    // Get list
    const list = await db.query.voterLists.findFirst({
      where: and(
        eq(schema.voterLists.id, listId),
        eq(schema.voterLists.organizationId, req.organizationId!)
      ),
    });

    if (!list) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    const criteria = filterCriteria || list.filterCriteria;
    if (!criteria) {
      return res.status(400).json({ success: false, error: 'No filter criteria provided' });
    }

    // Build conditions
    const conditions = [eq(schema.voters.organizationId, req.organizationId!)];

    if (criteria.congressionalDistrict?.length) {
      conditions.push(inArray(schema.voters.congressionalDistrict, criteria.congressionalDistrict));
    }
    if (criteria.legislativeDistrict?.length) {
      conditions.push(inArray(schema.voters.legislativeDistrict, criteria.legislativeDistrict));
    }
    if (criteria.stateSenateDistrict?.length) {
      conditions.push(inArray(schema.voters.stateSenateDistrict, criteria.stateSenateDistrict));
    }
    if (criteria.county?.length) {
      conditions.push(inArray(schema.voters.countyCode, criteria.county));
    }
    if (criteria.city?.length) {
      conditions.push(inArray(schema.voters.city, criteria.city));
    }
    if (criteria.zipCode?.length) {
      conditions.push(inArray(schema.voters.zipCode, criteria.zipCode));
    }
    if (criteria.supportLevel?.length) {
      conditions.push(inArray(schema.voters.supportLevel, criteria.supportLevel));
    }
    if (criteria.hasPhone) {
      conditions.push(sql`${schema.voters.phone} IS NOT NULL AND ${schema.voters.phone} != ''`);
    }
    if (criteria.hasEmail) {
      conditions.push(sql`${schema.voters.email} IS NOT NULL AND ${schema.voters.email} != ''`);
    }

    // Get matching voters
    const matchingVoters = await db
      .select({ id: schema.voters.id })
      .from(schema.voters)
      .where(and(...conditions));

    // Clear existing members if any
    await db.delete(schema.voterListMembers).where(eq(schema.voterListMembers.listId, listId));

    // Add all matching voters in batches
    const batchSize = 1000;
    let added = 0;
    for (let i = 0; i < matchingVoters.length; i += batchSize) {
      const batch = matchingVoters.slice(i, i + batchSize);
      await db.insert(schema.voterListMembers).values(
        batch.map(v => ({
          listId,
          voterId: v.id,
          addedBy: req.user!.id,
        }))
      );
      added += batch.length;
    }

    // Update list filter criteria
    await db.update(schema.voterLists)
      .set({ filterCriteria: criteria, updatedAt: new Date() })
      .where(eq(schema.voterLists.id, listId));

    res.json({
      success: true,
      message: `Added ${added} voters to list`,
      count: added,
    });
  } catch (error) {
    console.error('Populate list error:', error);
    res.status(500).json({ success: false, error: 'Failed to populate list' });
  }
});

export default router;
