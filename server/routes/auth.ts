import { Router } from 'express';
import { Issuer, generators } from 'openid-client';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

let oidcClient: any = null;

async function getOIDCClient() {
  if (oidcClient) return oidcClient;

  if (!process.env.OIDC_ISSUER) {
    throw new Error('OIDC_ISSUER not configured');
  }

  const issuer = await Issuer.discover(process.env.OIDC_ISSUER);
  oidcClient = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID!,
    client_secret: process.env.OIDC_CLIENT_SECRET!,
    redirect_uris: [process.env.OIDC_CALLBACK_URL!],
    response_types: ['code'],
  });

  return oidcClient;
}

// Initiate login
router.get('/login', async (req, res) => {
  try {
    const client = await getOIDCClient();
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
    console.error('Login error:', error);
    res.redirect('/?error=login_failed');
  }
});

// OIDC callback
router.get('/callback', async (req, res) => {
  try {
    const client = await getOIDCClient();
    const params = client.callbackParams(req);
    const codeVerifier = (req.session as any).codeVerifier;

    const tokenSet = await client.callback(
      process.env.OIDC_CALLBACK_URL!,
      params,
      { code_verifier: codeVerifier }
    );

    const userInfo = await client.userinfo(tokenSet.access_token!);

    // Store user in session
    (req.session as any).user = {
      id: userInfo.sub,
      email: userInfo.email,
      firstName: userInfo.given_name || userInfo.name?.split(' ')[0],
      lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' '),
      profileImageUrl: userInfo.picture,
    };

    delete (req.session as any).codeVerifier;

    res.redirect('/');
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect('/?error=auth_failed');
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

    // Get user from database with organization memberships
    const user = await db.query.users.findFirst({
      where: eq(schema.users.externalId, sessionUser.id),
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
        ...user,
        organizations: memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// Development-only: Create mock session (remove in production)
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-login', async (req, res) => {
    const { email, firstName, lastName } = req.body;
    
    // Get or create user
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      const [newUser] = await db.insert(schema.users).values({
        externalId: `dev-${Date.now()}`,
        email,
        firstName,
        lastName,
      }).returning();
      user = newUser;
    }

    (req.session as any).user = {
      id: user.externalId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    res.json({ success: true, data: user });
  });
}

export default router;
