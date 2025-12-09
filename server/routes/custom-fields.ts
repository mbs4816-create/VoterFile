import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireOrganization, requireRole } from '../middleware/auth';

const router = Router();

// Get all custom field definitions
router.get('/definitions', requireAuth, requireOrganization, async (req, res) => {
  try {
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
      orderBy: (defs, { asc }) => [asc(defs.displayOrder), asc(defs.createdAt)],
    });

    res.json({ success: true, data: definitions });
  } catch (error) {
    console.error('Get custom field definitions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get custom field definitions' });
  }
});

// Create custom field definition
router.post('/definitions', requireAuth, requireOrganization, requireRole('admin'), async (req, res) => {
  try {
    const { name, fieldKey, fieldType, options, isRequired, isSearchable, displayOrder } = req.body;

    if (!name || !fieldKey || !fieldType) {
      return res.status(400).json({ success: false, error: 'name, fieldKey, and fieldType are required' });
    }

    // Validate fieldType
    const validTypes = ['text', 'number', 'date', 'boolean', 'select', 'multiselect'];
    if (!validTypes.includes(fieldType)) {
      return res.status(400).json({ success: false, error: `fieldType must be one of: ${validTypes.join(', ')}` });
    }

    // Check for duplicate fieldKey
    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
        eq(schema.customFieldDefinitions.fieldKey, fieldKey)
      ),
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'A field with this key already exists' });
    }

    const [definition] = await db.insert(schema.customFieldDefinitions).values({
      organizationId: req.organizationId!,
      name,
      fieldKey,
      fieldType,
      options: options || null,
      isRequired: isRequired || false,
      isSearchable: isSearchable || false,
      displayOrder: displayOrder || 0,
    }).returning();

    res.json({ success: true, data: definition });
  } catch (error) {
    console.error('Create custom field definition error:', error);
    res.status(500).json({ success: false, error: 'Failed to create custom field definition' });
  }
});

// Update custom field definition
router.patch('/definitions/:id', requireAuth, requireOrganization, requireRole('admin'), async (req, res) => {
  try {
    const definitionId = parseInt(req.params.id, 10);
    const { name, options, isRequired, isSearchable, displayOrder } = req.body;

    // Cannot update fieldKey or fieldType once created
    const [updated] = await db
      .update(schema.customFieldDefinitions)
      .set({
        ...(name && { name }),
        ...(options !== undefined && { options }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isSearchable !== undefined && { isSearchable }),
        ...(displayOrder !== undefined && { displayOrder }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.customFieldDefinitions.id, definitionId),
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update custom field definition error:', error);
    res.status(500).json({ success: false, error: 'Failed to update custom field definition' });
  }
});

// Delete custom field definition
router.delete('/definitions/:id', requireAuth, requireOrganization, requireRole('admin'), async (req, res) => {
  try {
    const definitionId = parseInt(req.params.id, 10);

    // Also delete all values for this field
    await db.delete(schema.customFieldValues)
      .where(eq(schema.customFieldValues.fieldId, definitionId));

    await db.delete(schema.customFieldDefinitions).where(and(
      eq(schema.customFieldDefinitions.id, definitionId),
      eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
    ));

    res.json({ success: true, message: 'Custom field definition deleted' });
  } catch (error) {
    console.error('Delete custom field definition error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete custom field definition' });
  }
});

// Get custom field values for a voter
router.get('/values/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);

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

    const values = await db.query.customFieldValues.findMany({
      where: eq(schema.customFieldValues.voterId, voterId),
      with: {
        field: true,
      },
    });

    // Get all definitions to show empty fields too
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
    });

    // Map values to definitions
    const valueMap = new Map(values.map(v => [v.fieldId, v.value]));
    const data = definitions.map(def => ({
      fieldId: def.id,
      fieldKey: def.fieldKey,
      name: def.name,
      fieldType: def.fieldType,
      options: def.options,
      isRequired: def.isRequired,
      value: valueMap.get(def.id) || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get custom field values error:', error);
    res.status(500).json({ success: false, error: 'Failed to get custom field values' });
  }
});

// Set custom field value for a voter
router.post('/values/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);
    const { fieldId, value } = req.body;

    if (!fieldId) {
      return res.status(400).json({ success: false, error: 'fieldId is required' });
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

    // Verify field belongs to org
    const field = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(schema.customFieldDefinitions.id, fieldId),
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
      ),
    });

    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    // Upsert value
    const existing = await db.query.customFieldValues.findFirst({
      where: and(
        eq(schema.customFieldValues.voterId, voterId),
        eq(schema.customFieldValues.fieldId, fieldId)
      ),
    });

    let result;
    if (existing) {
      [result] = await db
        .update(schema.customFieldValues)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.customFieldValues.id, existing.id))
        .returning();
    } else {
      [result] = await db.insert(schema.customFieldValues).values({
        voterId,
        fieldId,
        value,
      }).returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Set custom field value error:', error);
    res.status(500).json({ success: false, error: 'Failed to set custom field value' });
  }
});

// Bulk set custom field values for multiple voters
router.post('/values/bulk', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { voterIds, fieldId, value } = req.body;

    if (!voterIds || !Array.isArray(voterIds) || voterIds.length === 0) {
      return res.status(400).json({ success: false, error: 'voterIds array is required' });
    }

    if (!fieldId) {
      return res.status(400).json({ success: false, error: 'fieldId is required' });
    }

    // Verify field belongs to org
    const field = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(schema.customFieldDefinitions.id, fieldId),
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
      ),
    });

    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;

    for (let i = 0; i < voterIds.length; i += BATCH_SIZE) {
      const batch = voterIds.slice(i, i + BATCH_SIZE);
      
      // Upsert using ON CONFLICT
      await db.insert(schema.customFieldValues)
        .values(batch.map((voterId: number) => ({
          voterId,
          fieldId,
          value,
        })))
        .onConflictDoUpdate({
          target: [schema.customFieldValues.voterId, schema.customFieldValues.fieldId],
          set: { value, updatedAt: new Date() },
        });

      processed += batch.length;
    }

    res.json({ success: true, message: `Updated ${processed} voters` });
  } catch (error) {
    console.error('Bulk set custom field values error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk set custom field values' });
  }
});

export default router;
