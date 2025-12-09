import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import path from 'path';
import { pool } from './db';

// Import routes
import authRoutes from './routes/auth';
import organizationsRoutes from './routes/organizations';
import votersRoutes from './routes/voters';
import listsRoutes from './routes/lists';
import interactionsRoutes from './routes/interactions';
import scriptsRoutes from './routes/scripts';
import importRoutes from './routes/import';
import dashboardRoutes from './routes/dashboard';
import emailRoutes from './routes/email';
import customFieldsRoutes from './routes/custom-fields';

const app = express();

// Trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.APP_URL 
    : 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'voterpulse-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/voters', votersRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/scripts', scriptsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/custom-fields', customFieldsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/client')));
  
  // Handle client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/client/index.html'));
  });
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  
  // Handle Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large' });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  
  // Generic error
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗   ██╗ ██████╗ ████████╗███████╗██████╗                 ║
║   ██║   ██║██╔═══██╗╚══██╔══╝██╔════╝██╔══██╗                ║
║   ██║   ██║██║   ██║   ██║   █████╗  ██████╔╝                ║
║   ╚██╗ ██╔╝██║   ██║   ██║   ██╔══╝  ██╔══██╗                ║
║    ╚████╔╝ ╚██████╔╝   ██║   ███████╗██║  ██║                ║
║     ╚═══╝   ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝                ║
║                                                               ║
║   ██████╗ ██╗   ██╗██╗     ███████╗███████╗                   ║
║   ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝                   ║
║   ██████╔╝██║   ██║██║     ███████╗█████╗                     ║
║   ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝                     ║
║   ██║     ╚██████╔╝███████╗███████║███████╗                   ║
║   ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝                   ║
║                                                               ║
║   Political Organizing CRM                                    ║
║   Server running on port ${PORT}                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
