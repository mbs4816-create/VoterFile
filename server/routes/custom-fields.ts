import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOrganization, requireRole } from '../middleware/auth';

const router = Router();

// Get all custom field definitions
router.get('/definitions', requireAuth, requireOrganization, async (req, res) => {
  try {
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
      orderBy: (defs, { asc }) => [asc(defs.sortOrder), asc(defs.createdAt)],
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
    const { fieldName, fieldLabel, fieldType, options, isRequired, sortOrder } = req.body;

    if (!fieldName || !fieldLabel || !fieldType) {
      return res.status(400).json({ success: false, error: 'fieldName, fieldLabel, and fieldType are required' });
    }

    // Validate fieldType
    const validTypes = ['text', 'number', 'date', 'boolean', 'select'];
    if (!validTypes.includes(fieldType)) {
      return res.status(400).json({ success: false, error: `fieldType must be one of: ${validTypes.join(', ')}` });
    }

    // Check for duplicate fieldName
    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
        eq(schema.customFieldDefinitions.fieldName, fieldName)
      ),
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'A field with this name already exists' });
    }

    const [definition] = await db.insert(schema.customFieldDefinitions).values({
      organizationId: req.organizationId!,
      fieldName,
      fieldLabel,
      fieldType,
      options: options || null,
      isRequired: isRequired || false,
      sortOrder: sortOrder || 0,
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
    const { fieldLabel, options, isRequired, sortOrder } = req.body;

    const [updated] = await db
      .update(schema.customFieldDefinitions)
      .set({
        ...(fieldLabel && { fieldLabel }),
        ...(options !== undefined && { options }),
        ...(isRequired !== undefined && { isRequired }),
        ...(sortOrder !== undefined && { sortOrder }),
      })
      .where(
        and(
          eq(schema.customFieldDefinitions.id, definitionId),
          eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
        )
      )
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

    const [deleted] = await db
      .delete(schema.customFieldDefinitions)
      .where(
        and(
          eq(schema.customFieldDefinitions.id, definitionId),
          eq(schema.customFieldDefinitions.organizationId, req.organizationId!)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete custom field definition error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete custom field definition' });
  }
});

// Get custom field values for a voter
router.get('/voters/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);

    // Get all definitions for this organization
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
      orderBy: (defs, { asc }) => [asc(defs.sortOrder)],
    });

    // Get all values for this voter
    const values = await db.query.customFieldValues.findMany({
      where: eq(schema.customFieldValues.voterId, voterId),
    });

    // Build a map of fieldDefinitionId -> value
    const valueMap = new Map(values.map(v => [v.fieldDefinitionId, v.value]));

    // Return definitions with their values
    const result = definitions.map(def => ({
      fieldName: def.fieldName,
      fieldLabel: def.fieldLabel,
      fieldType: def.fieldType,
      options: def.options,
      isRequired: def.isRequired,
      value: valueMap.get(def.id) || null,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get custom field values error:', error);
    res.status(500).json({ success: false, error: 'Failed to get custom field values' });
  }
});

// Set custom field value for a voter
router.post('/voters/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);
    const { fieldName, value } = req.body;

    if (!fieldName) {
      return res.status(400).json({ success: false, error: 'fieldName is required' });
    }

    // Find the field definition
    const definition = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
        eq(schema.customFieldDefinitions.fieldName, fieldName)
      ),
    });

    if (!definition) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    // Check if value already exists
    const existing = await db.query.customFieldValues.findFirst({
      where: and(
        eq(schema.customFieldValues.fieldDefinitionId, definition.id),
        eq(schema.customFieldValues.voterId, voterId)
      ),
    });

    if (existing) {
      // Update existing value
      const [updated] = await db
        .update(schema.customFieldValues)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.customFieldValues.id, existing.id))
        .returning();

      res.json({ success: true, data: updated });
    } else {
      // Create new value
      const [created] = await db.insert(schema.customFieldValues).values({
        fieldDefinitionId: definition.id,
        voterId,
        value,
      }).returning();

      res.json({ success: true, data: created });
    }
  } catch (error) {
    console.error('Set custom field value error:', error);
    res.status(500).json({ success: false, error: 'Failed to set custom field value' });
  }
});

// Set multiple custom field values for a voter
router.put('/voters/:voterId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const voterId = parseInt(req.params.voterId, 10);
    const { fields } = req.body; // Array of { fieldName, value }

    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, error: 'fields must be an array' });
    }

    // Get all field definitions for this organization
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: eq(schema.customFieldDefinitions.organizationId, req.organizationId!),
    });

    const defMap = new Map(definitions.map(d => [d.fieldName, d]));

    for (const field of fields) {
      const def = defMap.get(field.fieldName);
      if (!def) continue;

      // Check if value already exists
      const existing = await db.query.customFieldValues.findFirst({
        where: and(
          eq(schema.customFieldValues.fieldDefinitionId, def.id),
          eq(schema.customFieldValues.voterId, voterId)
        ),
      });

      if (existing) {
        await db
          .update(schema.customFieldValues)
          .set({ value: field.value, updatedAt: new Date() })
          .where(eq(schema.customFieldValues.id, existing.id));
      } else {
        await db.insert(schema.customFieldValues).values({
          fieldDefinitionId: def.id,
          voterId,
          value: field.value,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Set custom field values error:', error);
    res.status(500).json({ success: false, error: 'Failed to set custom field values' });
  }
});

export default router;
