import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOrganization } from '../middleware/auth';

const router = Router();

// Get all scripts
router.get('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { type, activeOnly = 'true' } = req.query;

    const conditions = [eq(schema.scripts.organizationId, req.organizationId!)];
    
    if (type) {
      conditions.push(eq(schema.scripts.type, type as string));
    }
    
    if (activeOnly === 'true') {
      conditions.push(eq(schema.scripts.isActive, true));
    }

    const scripts = await db.query.scripts.findMany({
      where: and(...conditions),
      with: {
        creator: true,
      },
    });

    res.json({
      success: true,
      data: scripts.map(s => ({
        ...s,
        creatorName: s.creator ? `${s.creator.firstName} ${s.creator.lastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get scripts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get scripts' });
  }
});

// Create script
router.post('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { name, content, type } = req.body;

    if (!name || !content || !type) {
      return res.status(400).json({ success: false, error: 'name, content, and type are required' });
    }

    const [script] = await db.insert(schema.scripts).values({
      organizationId: req.organizationId!,
      createdBy: req.user!.id,
      name,
      content,
      type,
    }).returning();

    res.json({ success: true, data: script });
  } catch (error) {
    console.error('Create script error:', error);
    res.status(500).json({ success: false, error: 'Failed to create script' });
  }
});

// Get single script
router.get('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);

    const script = await db.query.scripts.findFirst({
      where: and(
        eq(schema.scripts.id, scriptId),
        eq(schema.scripts.organizationId, req.organizationId!)
      ),
      with: {
        creator: true,
      },
    });

    if (!script) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }

    res.json({
      success: true,
      data: {
        ...script,
        creatorName: script.creator ? `${script.creator.firstName} ${script.creator.lastName}` : 'Unknown',
      },
    });
  } catch (error) {
    console.error('Get script error:', error);
    res.status(500).json({ success: false, error: 'Failed to get script' });
  }
});

// Update script
router.patch('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);
    const { name, content, type, isActive } = req.body;

    const [updated] = await db
      .update(schema.scripts)
      .set({
        ...(name && { name }),
        ...(content && { content }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.scripts.id, scriptId),
        eq(schema.scripts.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update script error:', error);
    res.status(500).json({ success: false, error: 'Failed to update script' });
  }
});

// Delete script
router.delete('/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);

    await db.delete(schema.scripts).where(and(
      eq(schema.scripts.id, scriptId),
      eq(schema.scripts.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'Script deleted' });
  } catch (error) {
    console.error('Delete script error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete script' });
  }
});

export default router;
