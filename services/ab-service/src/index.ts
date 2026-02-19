import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 4001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'app',
  database: process.env.DB_NAME || 'app',
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Error handling middleware
interface AppError extends Error {
  status?: number;
  code?: string;
}

const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;
  
  // Log with context for server errors
  if (!isClientError) {
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Don't expose internal error details to clients
  const message = isClientError 
    ? err.message 
    : 'An internal server error occurred';
  
  res.status(status).json({ 
    error: message,
    ...(isClientError && err.code && { code: err.code })
  });
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ab-service' });
});

// Get config
app.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = req.query.experiment as string || 'arc-raiders';
    const result = await pool.query(
      'SELECT enabled, toggles FROM ab_config WHERE experiment = $1',
      [experiment]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json({
      experiment,
      enabled: result.rows[0].enabled,
      toggles: result.rows[0].toggles,
    });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to fetch experiment configuration');
    appError.status = 500;
    appError.code = 'CONFIG_FETCH_ERROR';
    next(appError);
  }
});

// Update config
app.put('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { experiment = 'arc-raiders', enabled, toggles } = req.body;

    if (typeof enabled !== 'boolean') {
      const error: AppError = new Error('enabled must be a boolean');
      error.status = 400;
      error.code = 'INVALID_ENABLED_TYPE';
      return next(error);
    }

    if (toggles && typeof toggles !== 'object') {
      const error: AppError = new Error('toggles must be an object');
      error.status = 400;
      error.code = 'INVALID_TOGGLES_TYPE';
      return next(error);
    }

    await pool.query(
      `INSERT INTO ab_config (experiment, enabled, toggles, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (experiment)
       DO UPDATE SET enabled = $2, toggles = $3, updated_at = CURRENT_TIMESTAMP`,
      [experiment, enabled, JSON.stringify(toggles || {})]
    );

    res.json({ success: true, experiment, enabled, toggles });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to update experiment configuration');
    appError.status = 500;
    appError.code = 'CONFIG_UPDATE_ERROR';
    next(appError);
  }
});

// Assign variant
app.get('/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = (req.query.experiment as string) || 'arc-raiders';
    const forceVariant = req.query.forceVariant as string | undefined;

    // Get experiment config
    const configResult = await pool.query(
      'SELECT enabled, toggles FROM ab_config WHERE experiment = $1',
      [experiment]
    );

    const enabled = configResult.rows.length > 0 ? configResult.rows[0].enabled : true;
    const toggles = configResult.rows.length > 0 ? configResult.rows[0].toggles : {};

    // Get or create visitor ID from cookie
    let visitorId = req.cookies.vid;
    if (!visitorId) {
      visitorId = uuidv4();
      res.cookie('vid', visitorId, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        sameSite: 'lax',
      });
    }

    // Check if visitor already has a variant assignment
    const variantCookieName = `exp_${experiment.replace(/-/g, '_')}_variant`;
    let variant = req.cookies[variantCookieName] as string | undefined;

    // Allow forcing variant via query parameter (useful for testing)
    if (forceVariant && ['A', 'B'].includes(forceVariant.toUpperCase())) {
      variant = forceVariant.toUpperCase();
      res.cookie(variantCookieName, variant, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
    } else if (!enabled) {
      // If experiment is disabled, always return variant A
      variant = 'A';
      res.cookie(variantCookieName, variant, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      return res.json({
        visitorId,
        experiment,
        variant,
        enabled: false,
        features: toggles,
      });
    } else if (!variant || !['A', 'B'].includes(variant)) {
      // If no variant assigned, assign one consistently based on visitor ID
      // Use hash of visitor ID to ensure consistent assignment
      const hash = visitorId.split('').reduce((acc: number, char: string) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      variant = Math.abs(hash) % 2 === 0 ? 'A' : 'B';
      res.cookie(variantCookieName, variant, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
    }

    res.json({
      visitorId,
      experiment,
      variant,
      enabled: true,
      features: toggles,
    });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to assign variant');
    appError.status = 500;
    appError.code = 'VARIANT_ASSIGNMENT_ERROR';
    next(appError);
  }
});

// Update variant based on preference
app.post('/assign/preference', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { experiment = 'arc-raiders', preference } = req.body;
    
    if (!preference || !['pvp', 'pve', 'both'].includes(preference)) {
      const error: AppError = new Error('Invalid preference. Must be pvp, pve, or both');
      error.status = 400;
      error.code = 'INVALID_PREFERENCE';
      return next(error);
    }

    // Get visitor ID from cookie
    let visitorId = req.cookies.vid;
    if (!visitorId) {
      visitorId = uuidv4();
      res.cookie('vid', visitorId, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
    }

    const variantCookieName = `exp_${experiment.replace(/-/g, '_')}_variant`;
    
    // Determine target variant based on preference
    // pvp -> Variant A, pve -> Variant B, both -> keep current or assign randomly
    let targetVariant: string;
    if (preference === 'pvp') {
      targetVariant = 'A';
    } else if (preference === 'pve') {
      targetVariant = 'B';
    } else {
      // For 'both', keep current variant or assign randomly
      const currentVariant = req.cookies[variantCookieName];
      if (currentVariant && ['A', 'B'].includes(currentVariant)) {
        targetVariant = currentVariant;
      } else {
        const hash = visitorId.split('').reduce((acc: number, char: string) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        targetVariant = Math.abs(hash) % 2 === 0 ? 'A' : 'B';
      }
    }

    // Update variant cookie
    res.cookie(variantCookieName, targetVariant, {
      httpOnly: false,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      visitorId,
      experiment,
      variant: targetVariant,
      preference,
      variantChanged: req.cookies[variantCookieName] !== targetVariant,
    });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to update variant preference');
    appError.status = 500;
    appError.code = 'PREFERENCE_UPDATE_ERROR';
    next(appError);
  }
});

app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Database connected');

    app.listen(PORT, () => {
      console.log(`AB Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
