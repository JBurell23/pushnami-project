import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 4002;

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

// Validation schema for events
const eventSchema = z.object({
  visitorId: z.string().uuid(),
  experiment: z.string(),
  variant: z.enum(['A', 'B']),
  eventType: z.string(),
  metadata: z.record(z.any()).optional(),
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'metrics-service' });
});

// Post event
app.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = eventSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid event data',
        details: validationResult.error.errors,
      });
    }

    const { visitorId, experiment, variant, eventType, metadata } = validationResult.data;

    await pool.query(
      `INSERT INTO events (visitor_id, experiment, variant, event_type, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitorId, experiment, variant, eventType, JSON.stringify(metadata || {})]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to store event');
    appError.status = 500;
    appError.code = 'EVENT_STORAGE_ERROR';
    next(appError);
  }
});

// Get stats
app.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = req.query.experiment as string || 'arc-raiders';

    // Get aggregated counts by variant and eventType
    const countsResult = await pool.query(
      `SELECT variant, event_type, COUNT(*) as count
       FROM events
       WHERE experiment = $1
       GROUP BY variant, event_type
       ORDER BY variant, event_type`,
      [experiment]
    );

    // Calculate conversion rates and engagement metrics
    const conversionResult = await pool.query(
      `SELECT 
         variant,
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as page_views,
         SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) as cta_clicks,
         SUM(CASE WHEN event_type = 'bounce' THEN 1 ELSE 0 END) as bounces,
         AVG(CASE WHEN event_type = 'time_on_page' THEN (metadata->>'seconds')::numeric ELSE NULL END) as avg_time_on_page
       FROM events
       WHERE experiment = $1
       GROUP BY variant`,
      [experiment]
    );

    // Get scroll depth statistics
    const scrollDepthResult = await pool.query(
      `SELECT 
         variant,
         metadata->>'depth' as depth,
         COUNT(*) as count
       FROM events
       WHERE experiment = $1 AND event_type = 'scroll_depth'
       GROUP BY variant, metadata->>'depth'
       ORDER BY variant, (metadata->>'depth')::numeric`,
      [experiment]
    );

    const counts = countsResult.rows.map(row => ({
      variant: row.variant,
      eventType: row.event_type,
      count: parseInt(row.count),
    }));

    const conversions = conversionResult.rows.map(row => {
      const pageViews = parseInt(row.page_views || '0');
      const ctaClicks = parseInt(row.cta_clicks || '0');
      const bounces = parseInt(row.bounces || '0');
      const avgTimeOnPage = row.avg_time_on_page ? parseFloat(row.avg_time_on_page).toFixed(1) : '0.0';
      
      return {
        variant: row.variant,
        pageViews,
        ctaClicks,
        bounces,
        bounceRate: pageViews > 0 ? ((bounces / pageViews) * 100).toFixed(2) : '0.00',
        conversionRate: pageViews > 0
          ? ((ctaClicks / pageViews) * 100).toFixed(2)
          : '0.00',
        avgTimeOnPage: `${avgTimeOnPage}s`,
      };
    });

    // Organize scroll depth by variant
    const scrollDepths: Record<string, Record<string, number>> = {};
    scrollDepthResult.rows.forEach((row) => {
      if (!scrollDepths[row.variant]) {
        scrollDepths[row.variant] = {};
      }
      scrollDepths[row.variant][row.depth] = parseInt(row.count);
    });

    res.json({
      experiment,
      counts,
      conversions,
      scrollDepths,
    });
  } catch (error) {
    const dbError = error as Error;
    const appError: AppError = new Error('Failed to retrieve statistics');
    appError.status = 500;
    appError.code = 'STATS_RETRIEVAL_ERROR';
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
      console.log(`Metrics Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
