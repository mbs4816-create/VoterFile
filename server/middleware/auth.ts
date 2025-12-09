import { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: typeof schema.users.$inferSelect;
      organizationId?: number;
      organizationMember?: typeof schema.organizationMembers.$inferSelect;
    }
  }
}

// Session user type (from OIDC)
interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for session user (from OIDC auth)
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    
    if (!sessionUser) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Get or create user in our database
    let user = await db.query.users.findFirst({
      where: eq(schema.users.externalId, sessionUser.id),
    });

    if (!user) {
      // Create user on first login
      const [newUser] = await db.insert(schema.users).values({
        externalId: sessionUser.id,
        email: sessionUser.email,
        firstName: sessionUser.firstName || null,
        lastName: sessionUser.lastName || null,
        profileImageUrl: sessionUser.profileImageUrl || null,
      }).returning();
      user = newUser;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

/**
 * Middleware to require organization context
 */
export async function requireOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const orgIdHeader = req.headers['x-organization-id'];
    const organizationId = orgIdHeader ? parseInt(orgIdHeader as string, 10) : null;

    if (!organizationId || isNaN(organizationId)) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check if user is a member of the organization
    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, req.user.id),
        eq(schema.organizationMembers.status, 'active')
      ),
    });

    if (!member) {
      return res.status(403).json({ success: false, error: 'Not a member of this organization' });
    }

    req.organizationId = organizationId;
    req.organizationMember = member;
    next();
  } catch (error) {
    console.error('Organization middleware error:', error);
    return res.status(500).json({ success: false, error: 'Organization verification error' });
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organizationMember) {
      return res.status(403).json({ success: false, error: 'Organization context required' });
    }

    if (!roles.includes(req.organizationMember.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Insufficient permissions. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: keyof NonNullable<typeof schema.organizationMembers.$inferSelect['permissions']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organizationMember) {
      return res.status(403).json({ success: false, error: 'Organization context required' });
    }

    // Admins have all permissions
    if (req.organizationMember.role === 'admin') {
      return next();
    }

    const permissions = req.organizationMember.permissions || {};
    if (!permissions[permission]) {
      return res.status(403).json({ 
        success: false, 
        error: `Missing permission: ${permission}` 
      });
    }

    next();
  };
}

/**
 * Optional auth - populates user if logged in, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    
    if (sessionUser) {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.externalId, sessionUser.id),
      });
      req.user = user || undefined;
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
}
