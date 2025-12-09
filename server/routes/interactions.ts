import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, desc, count, sql, gte } from 'drizzle-orm';
import { requireAuth, requireOrganization } from '../middleware/auth';

const router = Router();

// Log an interaction
router.post('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { voterId, type, result, supportLevel, notes, duration, scriptId, listId } = req.body;

    if (!voterId || !type) {
      return res.status(400).json({ success: false, error: 'voterId and type are required' });
    }

    // Verify voter belongs to org
    const voter = await db.query.voters.findFirst({
      where: and(
        eq(schema.voters.id, voterId),
        eq(schema.voters.organizationId, req.organizationId!)
      ),
    });

    if (!voter) {
      return res.status(404).json({ success: false, error: 'Voter not found' });
    }

    // Create interaction
    const [interaction] = await db.insert(schema.interactions).values({
      voterId,
      userId: req.user!.id,
      organizationId: req.organizationId!,
      type,
      result,
      supportLevel,
      notes,
      duration,
      scriptId,
      listId,
    }).returning();

    // Update voter support level if captured
    if (supportLevel !== undefined && supportLevel !== null) {
      await db.update(schema.voters)
        .set({ supportLevel, updatedAt: new Date() })
        .where(eq(schema.voters.id, voterId));
    }

    res.json({ success: true, data: interaction });
  } catch (error) {
    console.error('Create interaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to create interaction' });
  }
});

// Get interactions for a voter
router.get('/voter/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const interactions = await db.query.interactions.findMany({
      where: and(
        eq(schema.interactions.voterId, voterId),
        eq(schema.interactions.organizationId, req.organizationId!)
      ),
      orderBy: desc(schema.interactions.createdAt),
      limit: limitNum,
      offset,
      with: {
        user: true,
        script: true,
      },
    });

    const [countResult] = await db
      .select({ count: count() })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.voterId, voterId),
        eq(schema.interactions.organizationId, req.organizationId!)
      ));

    res.json({
      success: true,
      data: interactions.map(i => ({
        ...i,
        userName: i.user ? `${i.user.firstName} ${i.user.lastName}` : 'Unknown',
        scriptName: i.script?.name,
      })),
      total: countResult.count,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get voter interactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get interactions' });
  }
});

// Get recent interactions for organization
router.get('/recent', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { limit = '50', type } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    const conditions = [eq(schema.interactions.organizationId, req.organizationId!)];
    if (type) {
      conditions.push(eq(schema.interactions.type, type as string));
    }

    const interactions = await db.query.interactions.findMany({
      where: and(...conditions),
      orderBy: desc(schema.interactions.createdAt),
      limit: limitNum,
      with: {
        user: true,
        voter: true,
      },
    });

    res.json({
      success: true,
      data: interactions.map(i => ({
        id: i.id,
        type: i.type,
        result: i.result,
        supportLevel: i.supportLevel,
        notes: i.notes,
        createdAt: i.createdAt,
        userName: i.user ? `${i.user.firstName} ${i.user.lastName}` : 'Unknown',
        voterName: i.voter ? `${i.voter.firstName} ${i.voter.lastName}` : 'Unknown',
        voterId: i.voterId,
      })),
    });
  } catch (error) {
    console.error('Get recent interactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get interactions' });
  }
});

// Get user's interactions (their activity)
router.get('/my-activity', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const interactions = await db.query.interactions.findMany({
      where: and(
        eq(schema.interactions.userId, req.user!.id),
        eq(schema.interactions.organizationId, req.organizationId!)
      ),
      orderBy: desc(schema.interactions.createdAt),
      limit: limitNum,
      offset,
      with: {
        voter: true,
      },
    });

    res.json({
      success: true,
      data: interactions.map(i => ({
        ...i,
        voterName: i.voter ? `${i.voter.firstName} ${i.voter.lastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get my activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to get activity' });
  }
});

// Get interaction stats
router.get('/stats', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { days = '7' } = req.query;
    const daysNum = parseInt(days as string, 10);
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // Total interactions
    const [totalResult] = await db
      .select({ count: count() })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, since)
      ));

    // By type
    const byType = await db
      .select({
        type: schema.interactions.type,
        count: count(),
      })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, since)
      ))
      .groupBy(schema.interactions.type);

    // By result
    const byResult = await db
      .select({
        result: schema.interactions.result,
        count: count(),
      })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, since)
      ))
      .groupBy(schema.interactions.result);

    // Top volunteers
    const topVolunteers = await db
      .select({
        userId: schema.interactions.userId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        count: count(),
      })
      .from(schema.interactions)
      .innerJoin(schema.users, eq(schema.interactions.userId, schema.users.id))
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, since)
      ))
      .groupBy(schema.interactions.userId, schema.users.firstName, schema.users.lastName)
      .orderBy(desc(count()))
      .limit(10);

    res.json({
      success: true,
      data: {
        total: totalResult.count,
        byType,
        byResult,
        topVolunteers: topVolunteers.map(v => ({
          userId: v.userId,
          name: `${v.firstName} ${v.lastName}`,
          count: v.count,
        })),
      },
    });
  } catch (error) {
    console.error('Get interaction stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
