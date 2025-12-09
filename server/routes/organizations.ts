import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get user's organizations
router.get('/', requireAuth, async (req, res) => {
  try {
    const memberships = await db.query.organizationMembers.findMany({
      where: and(
        eq(schema.organizationMembers.userId, req.user!.id),
        eq(schema.organizationMembers.status, 'active')
      ),
      with: {
        organization: true,
      },
    });

    res.json({
      success: true,
      data: memberships.map(m => ({
        ...m.organization,
        role: m.role,
        permissions: m.permissions,
      })),
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ success: false, error: 'Failed to get organizations' });
  }
});

// Create organization
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Create organization
    const [organization] = await db.insert(schema.organizations).values({
      name,
      description,
    }).returning();

    // Add creator as admin
    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      userId: req.user!.id,
      role: 'admin',
      status: 'active',
      permissions: {
        canManageVoters: true,
        canManageLists: true,
        canManageScripts: true,
        canManageTeam: true,
        canSendEmails: true,
        canImportData: true,
        canExportData: true,
      },
    });

    res.json({ success: true, data: organization });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ success: false, error: 'Failed to create organization' });
  }
});

// Get organization by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id, 10);

    // Check membership
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user!.id),
        eq(schema.organizationMembers.status, 'active')
      ),
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Not a member of this organization' });
    }

    const organization = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, organizationId),
    });

    if (!organization) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    res.json({
      success: true,
      data: {
        ...organization,
        role: membership.role,
        permissions: membership.permissions,
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ success: false, error: 'Failed to get organization' });
  }
});

// Update organization
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id, 10);
    const { name, description, settings } = req.body;

    // Check admin access
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user!.id),
        eq(schema.organizationMembers.role, 'admin')
      ),
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const [updated] = await db.update(schema.organizations)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(settings && { settings }),
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, organizationId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ success: false, error: 'Failed to update organization' });
  }
});

// Get organization members
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id, 10);

    // Check membership
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user!.id),
        eq(schema.organizationMembers.status, 'active')
      ),
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Not a member of this organization' });
    }

    const members = await db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.organizationId, organizationId),
      with: {
        user: true,
      },
    });

    res.json({
      success: true,
      data: members.map(m => ({
        id: m.id,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          profileImageUrl: m.user.profileImageUrl,
        },
      })),
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ success: false, error: 'Failed to get members' });
  }
});

// Update member role/permissions
router.patch('/:id/members/:memberId', requireAuth, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id, 10);
    const memberId = parseInt(req.params.memberId, 10);
    const { role, permissions, status } = req.body;

    // Check admin access
    const adminMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user!.id),
        eq(schema.organizationMembers.role, 'admin')
      ),
    });

    if (!adminMembership) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const [updated] = await db.update(schema.organizationMembers)
      .set({
        ...(role && { role }),
        ...(permissions && { permissions }),
        ...(status && { status }),
      })
      .where(and(
        eq(schema.organizationMembers.id, memberId),
        eq(schema.organizationMembers.organizationId, organizationId)
      ))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, error: 'Failed to update member' });
  }
});

// Invite member
router.post('/:id/invitations', requireAuth, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id, 10);
    const { email, role = 'volunteer' } = req.body;

    // Check admin/manager access
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user!.id)
      ),
    });

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return res.status(403).json({ success: false, error: 'Manager or admin access required' });
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const [invitation] = await db.insert(schema.teamInvitations).values({
      organizationId,
      email,
      role,
      token,
      invitedBy: req.user!.id,
      expiresAt,
    }).returning();

    // TODO: Send invitation email

    res.json({ success: true, data: invitation });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create invitation' });
  }
});

// Accept invitation
router.post('/invitations/:token/accept', requireAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await db.query.teamInvitations.findFirst({
      where: eq(schema.teamInvitations.token, token),
    });

    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({ success: false, error: 'Invitation already accepted' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ success: false, error: 'Invitation expired' });
    }

    // Check if user email matches invitation
    if (req.user!.email !== invitation.email) {
      return res.status(403).json({ success: false, error: 'Invitation is for a different email' });
    }

    // Check if already a member
    const existingMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, invitation.organizationId),
        eq(schema.organizationMembers.userId, req.user!.id)
      ),
    });

    if (existingMembership) {
      return res.status(400).json({ success: false, error: 'Already a member' });
    }

    // Create membership
    await db.insert(schema.organizationMembers).values({
      organizationId: invitation.organizationId,
      userId: req.user!.id,
      role: invitation.role,
      status: 'active',
    });

    // Mark invitation as accepted
    await db.update(schema.teamInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.teamInvitations.id, invitation.id));

    res.json({ success: true, message: 'Invitation accepted' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

export default router;
