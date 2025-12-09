import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, count, gte, desc, sql } from 'drizzle-orm';
import { requireAuth, requireOrganization } from '../middleware/auth';

const router = Router();

// Get dashboard metrics
router.get('/metrics', requireAuth, requireOrganization, async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Total voters
    const [totalVotersResult] = await db
      .select({ count: count() })
      .from(schema.voters)
      .where(eq(schema.voters.organizationId, req.organizationId!));

    // Contacted this week
    const [contactedResult] = await db
      .select({ count: count() })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, oneWeekAgo),
        eq(schema.interactions.result, 'contacted')
      ));

    // Support level distribution
    const supportDistribution = await db
      .select({
        level: schema.voters.supportLevel,
        count: count(),
      })
      .from(schema.voters)
      .where(and(
        eq(schema.voters.organizationId, req.organizationId!),
        sql`${schema.voters.supportLevel} IS NOT NULL`
      ))
      .groupBy(schema.voters.supportLevel);

    // Voters with phone
    const [withPhoneResult] = await db
      .select({ count: count() })
      .from(schema.voters)
      .where(and(
        eq(schema.voters.organizationId, req.organizationId!),
        sql`${schema.voters.phone} IS NOT NULL AND ${schema.voters.phone} != ''`
      ));

    // Total lists
    const [totalListsResult] = await db
      .select({ count: count() })
      .from(schema.voterLists)
      .where(eq(schema.voterLists.organizationId, req.organizationId!));

    // Total interactions this week
    const [weeklyInteractionsResult] = await db
      .select({ count: count() })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, oneWeekAgo)
      ));

    res.json({
      success: true,
      data: {
        totalVoters: totalVotersResult.count,
        contactedThisWeek: contactedResult.count,
        votersWithPhone: withPhoneResult.count,
        totalLists: totalListsResult.count,
        weeklyInteractions: weeklyInteractionsResult.count,
        supportDistribution: supportDistribution.map(s => ({
          level: s.level,
          count: s.count,
        })),
      },
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

// Get recent activity
router.get('/activity', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const interactions = await db.query.interactions.findMany({
      where: eq(schema.interactions.organizationId, req.organizationId!),
      orderBy: desc(schema.interactions.createdAt),
      limit: limitNum,
      with: {
        user: true,
        voter: true,
      },
    });

    const activity = interactions.map(i => ({
      id: i.id,
      type: i.type,
      result: i.result,
      description: `${i.user?.firstName || 'Unknown'} ${i.type === 'canvass' ? 'canvassed' : 'called'} ${i.voter?.firstName || ''} ${i.voter?.lastName || 'Unknown'}`,
      userName: i.user ? `${i.user.firstName} ${i.user.lastName}` : 'Unknown',
      voterName: i.voter ? `${i.voter.firstName} ${i.voter.lastName}` : 'Unknown',
      createdAt: i.createdAt,
    }));

    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to get activity' });
  }
});

// Get top lists
router.get('/top-lists', requireAuth, requireOrganization, async (req, res) => {
  try {
    const lists = await db
      .select({
        id: schema.voterLists.id,
        name: schema.voterLists.name,
        type: schema.voterLists.type,
        memberCount: count(schema.voterListMembers.id),
      })
      .from(schema.voterLists)
      .leftJoin(
        schema.voterListMembers,
        eq(schema.voterListMembers.listId, schema.voterLists.id)
      )
      .where(eq(schema.voterLists.organizationId, req.organizationId!))
      .groupBy(schema.voterLists.id)
      .orderBy(desc(count(schema.voterListMembers.id)))
      .limit(5);

    res.json({ success: true, data: lists });
  } catch (error) {
    console.error('Get top lists error:', error);
    res.status(500).json({ success: false, error: 'Failed to get top lists' });
  }
});

// Get interaction trends (last 7 days)
router.get('/trends', requireAuth, requireOrganization, async (req, res) => {
  try {
    const trends = await db
      .select({
        date: sql<string>`DATE(${schema.interactions.createdAt})`,
        count: count(),
      })
      .from(schema.interactions)
      .where(and(
        eq(schema.interactions.organizationId, req.organizationId!),
        gte(schema.interactions.createdAt, sql`NOW() - INTERVAL '7 days'`)
      ))
      .groupBy(sql`DATE(${schema.interactions.createdAt})`)
      .orderBy(sql`DATE(${schema.interactions.createdAt})`);

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to get trends' });
  }
});

export default router;
