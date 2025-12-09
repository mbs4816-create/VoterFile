import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, requireOrganization, requirePermission } from '../middleware/auth';

const router = Router();

// ==================== EMAIL TEMPLATES ====================

// Get all templates
router.get('/templates', requireAuth, requireOrganization, async (req, res) => {
  try {
    const templates = await db.query.emailTemplates.findMany({
      where: eq(schema.emailTemplates.organizationId, req.organizationId!),
      with: {
        creator: true,
      },
    });

    res.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        creatorName: t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, error: 'Failed to get templates' });
  }
});

// Create template
router.post('/templates', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const { name, subject, htmlContent, textContent } = req.body;

    if (!name || !subject || !htmlContent) {
      return res.status(400).json({ success: false, error: 'name, subject, and htmlContent are required' });
    }

    const [template] = await db.insert(schema.emailTemplates).values({
      organizationId: req.organizationId!,
      createdBy: req.user!.id,
      name,
      subject,
      htmlContent,
      textContent,
    }).returning();

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// Get single template
router.get('/templates/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);

    const template = await db.query.emailTemplates.findFirst({
      where: and(
        eq(schema.emailTemplates.id, templateId),
        eq(schema.emailTemplates.organizationId, req.organizationId!)
      ),
    });

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ success: false, error: 'Failed to get template' });
  }
});

// Update template
router.patch('/templates/:id', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const { name, subject, htmlContent, textContent } = req.body;

    const [updated] = await db
      .update(schema.emailTemplates)
      .set({
        ...(name && { name }),
        ...(subject && { subject }),
        ...(htmlContent && { htmlContent }),
        ...(textContent !== undefined && { textContent }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.emailTemplates.id, templateId),
        eq(schema.emailTemplates.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/templates/:id', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);

    await db.delete(schema.emailTemplates).where(and(
      eq(schema.emailTemplates.id, templateId),
      eq(schema.emailTemplates.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// ==================== EMAIL CAMPAIGNS ====================

// Get all campaigns
router.get('/campaigns', requireAuth, requireOrganization, async (req, res) => {
  try {
    const campaigns = await db.query.emailCampaigns.findMany({
      where: eq(schema.emailCampaigns.organizationId, req.organizationId!),
      with: {
        creator: true,
      },
      orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
    });

    res.json({
      success: true,
      data: campaigns.map(c => ({
        ...c,
        creatorName: c.creator ? `${c.creator.firstName} ${c.creator.lastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ success: false, error: 'Failed to get campaigns' });
  }
});

// Create campaign
router.post('/campaigns', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const { name, subject, templateId, listId, fromName, fromEmail, scheduledAt } = req.body;

    if (!name || !subject || !listId) {
      return res.status(400).json({ success: false, error: 'name, subject, and listId are required' });
    }

    // Get recipient count
    const [countResult] = await db
      .select({ count: count() })
      .from(schema.voterListMembers)
      .innerJoin(schema.voters, eq(schema.voterListMembers.voterId, schema.voters.id))
      .where(and(
        eq(schema.voterListMembers.listId, listId),
        eq(schema.voters.organizationId, req.organizationId!)
      ));

    const [campaign] = await db.insert(schema.emailCampaigns).values({
      organizationId: req.organizationId!,
      createdBy: req.user!.id,
      name,
      subject,
      templateId,
      listId,
      fromName,
      fromEmail,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
      totalRecipients: countResult.count,
    }).returning();

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
});

// Get single campaign
router.get('/campaigns/:id', requireAuth, requireOrganization, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);

    const campaign = await db.query.emailCampaigns.findFirst({
      where: and(
        eq(schema.emailCampaigns.id, campaignId),
        eq(schema.emailCampaigns.organizationId, req.organizationId!)
      ),
      with: {
        template: true,
        list: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to get campaign' });
  }
});

// Update campaign
router.patch('/campaigns/:id', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Only allow updates if campaign is draft or scheduled
    const campaign = await db.query.emailCampaigns.findFirst({
      where: and(
        eq(schema.emailCampaigns.id, campaignId),
        eq(schema.emailCampaigns.organizationId, req.organizationId!)
      ),
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, error: 'Cannot update campaign in current status' });
    }

    const [updated] = await db
      .update(schema.emailCampaigns)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.emailCampaigns.id, campaignId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
});

// Send campaign (trigger sending)
router.post('/campaigns/:id/send', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);

    const campaign = await db.query.emailCampaigns.findFirst({
      where: and(
        eq(schema.emailCampaigns.id, campaignId),
        eq(schema.emailCampaigns.organizationId, req.organizationId!)
      ),
      with: {
        template: true,
        list: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, error: 'Campaign cannot be sent in current status' });
    }

    // Update status to sending
    await db.update(schema.emailCampaigns)
      .set({ status: 'sending', sentAt: new Date() })
      .where(eq(schema.emailCampaigns.id, campaignId));

    // TODO: Implement actual email sending via SendGrid
    // This would be done in a background job
    
    // For now, just mark as sent
    await db.update(schema.emailCampaigns)
      .set({ status: 'sent', totalSent: campaign.totalRecipients })
      .where(eq(schema.emailCampaigns.id, campaignId));

    res.json({ success: true, message: 'Campaign sending started' });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to send campaign' });
  }
});

// Cancel campaign
router.post('/campaigns/:id/cancel', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);

    const [updated] = await db
      .update(schema.emailCampaigns)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(schema.emailCampaigns.id, campaignId),
        eq(schema.emailCampaigns.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Cancel campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel campaign' });
  }
});

// Delete campaign
router.delete('/campaigns/:id', requireAuth, requireOrganization, requirePermission('canSendEmails'), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);

    await db.delete(schema.emailCampaigns).where(and(
      eq(schema.emailCampaigns.id, campaignId),
      eq(schema.emailCampaigns.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete campaign' });
  }
});

export default router;
