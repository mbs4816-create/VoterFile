import { Router } from 'express';
import { Issuer, generators } from 'openid-client';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// ==================== EMAIL/PASSWORD AUTH ====================

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, organizationName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [user] = await db.insert(schema.users).values({
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      emailVerified: true, // Skip email verification for now (free tier)
    }).returning();

    // Create organization for the user (or use default)
    const orgName = organizationName || `${firstName || email.split('@')[0]}'s Organization`;
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const [organization] = await db.insert(schema.organizations).values({
      name: orgName,
      slug: `${orgSlug}-${Date.now()}`,
      settings: {},
    }).returning();

    // Add user as admin of the organization
    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
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

    // Set session
    (req.session as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Set session
    (req.session as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const sessionUser = (req.session as any)?.user;

    if (!sessionUser) {
      return res.json({ success: true, data: null });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, sessionUser.id),
    });

    if (!user) {
      return res.json({ success: true, data: null });
    }

    // Get user's organizations
    const memberships = await db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.userId, user.id),
      with: {
        organization: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        organizations: memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
          permissions: m.permissions,
        })),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// ==================== OIDC AUTH (Optional) ====================

let oidcClient: any = null;

async function getOIDCClient() {
  if (oidcClient) return oidcClient;

  if (!process.env.OIDC_ISSUER) {
    return null;
  }

  try {
    const issuer = await Issuer.discover(process.env.OIDC_ISSUER);
    oidcClient = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID!,
      client_secret: process.env.OIDC_CLIENT_SECRET!,
      redirect_uris: [process.env.OIDC_CALLBACK_URL!],
      response_types: ['code'],
    });
    return oidcClient;
  } catch {
    return null;
  }
}

// Initiate OIDC login (only if configured)
router.get('/oidc/login', async (req, res) => {
  try {
    const client = await getOIDCClient();
    if (!client) {
      return res.status(400).json({ success: false, error: 'OIDC not configured' });
    }

    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    (req.session as any).codeVerifier = codeVerifier;

    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('OIDC login error:', error);
    res.redirect('/?error=login_failed');
  }
});

// OIDC callback
router.get('/callback', async (req, res) => {
  try {
    const client = await getOIDCClient();
    if (!client) {
      return res.redirect('/?error=oidc_not_configured');
    }

    const params = client.callbackParams(req);
    const codeVerifier = (req.session as any).codeVerifier;

    const tokenSet = await client.callback(
      process.env.OIDC_CALLBACK_URL!,
      params,
      { code_verifier: codeVerifier }
    );

    const userInfo = await client.userinfo(tokenSet.access_token!);

    // Get or create user
    let user = await db.query.users.findFirst({
      where: eq(schema.users.externalId, userInfo.sub),
    });

    if (!user) {
      const [newUser] = await db.insert(schema.users).values({
        externalId: userInfo.sub,
        email: userInfo.email!,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0],
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' '),
        profileImageUrl: userInfo.picture,
        emailVerified: true,
      }).returning();
      user = newUser;
    }

    // Set session
    (req.session as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    delete (req.session as any).codeVerifier;

    res.redirect('/');
  } catch (error) {
    console.error('OIDC callback error:', error);
    res.redirect('/?error=auth_failed');
  }
});

export default router;
