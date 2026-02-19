-- SQL Queries for Viewing Metrics in the Database
-- Connect to the database using: docker exec -it pushnami-project-db-1 psql -U app -d app

-- ============================================
-- BASIC METRICS OVERVIEW
-- ============================================

-- View all events with details
SELECT 
    id,
    visitor_id,
    variant,
    event_type,
    metadata,
    created_at
FROM events
WHERE experiment = 'arc-raiders'
ORDER BY created_at DESC
LIMIT 100;

-- Count events by type and variant
SELECT 
    variant,
    event_type,
    COUNT(*) as count
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY variant, event_type
ORDER BY variant, event_type;

-- ============================================
-- TIME ON PAGE METRICS
-- ============================================

-- Average time on page by variant
SELECT 
    variant,
    COUNT(*) as sessions,
    AVG((metadata->>'seconds')::numeric) as avg_seconds,
    MIN((metadata->>'seconds')::numeric) as min_seconds,
    MAX((metadata->>'seconds')::numeric) as max_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (metadata->>'seconds')::numeric) as median_seconds
FROM events
WHERE experiment = 'arc-raiders' 
  AND event_type = 'time_on_page'
GROUP BY variant;

-- Time on page distribution
SELECT 
    variant,
    CASE 
        WHEN (metadata->>'seconds')::numeric < 10 THEN '0-10s'
        WHEN (metadata->>'seconds')::numeric < 30 THEN '10-30s'
        WHEN (metadata->>'seconds')::numeric < 60 THEN '30-60s'
        WHEN (metadata->>'seconds')::numeric < 120 THEN '60-120s'
        ELSE '120s+'
    END as time_bucket,
    COUNT(*) as count
FROM events
WHERE experiment = 'arc-raiders' 
  AND event_type = 'time_on_page'
GROUP BY variant, time_bucket
ORDER BY variant, time_bucket;

-- ============================================
-- SCROLL DEPTH METRICS
-- ============================================

-- Scroll depth by variant
SELECT 
    variant,
    (metadata->>'depth')::integer as depth_percent,
    COUNT(*) as users_reached
FROM events
WHERE experiment = 'arc-raiders' 
  AND event_type = 'scroll_depth'
GROUP BY variant, (metadata->>'depth')::integer
ORDER BY variant, depth_percent;

-- Percentage of users reaching each scroll milestone
SELECT 
    variant,
    (metadata->>'depth')::integer as depth_percent,
    COUNT(DISTINCT visitor_id) as unique_users,
    (COUNT(DISTINCT visitor_id)::float / 
     (SELECT COUNT(DISTINCT visitor_id) 
      FROM events 
      WHERE experiment = 'arc-raiders' 
        AND event_type = 'page_view' 
        AND variant = e.variant) * 100) as percentage_reached
FROM events e
WHERE experiment = 'arc-raiders' 
  AND event_type = 'scroll_depth'
GROUP BY variant, (metadata->>'depth')::integer
ORDER BY variant, depth_percent;

-- ============================================
-- BOUNCE RATE METRICS
-- ============================================

-- Bounce rate by variant
SELECT 
    variant,
    COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) as total_visitors,
    COUNT(DISTINCT CASE WHEN event_type = 'bounce' THEN visitor_id END) as bounced_visitors,
    ROUND(
        (COUNT(DISTINCT CASE WHEN event_type = 'bounce' THEN visitor_id END)::float /
         NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END), 0)) * 100,
        2
    ) as bounce_rate_percent
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY variant;

-- Visitors who bounced (no interactions)
SELECT 
    visitor_id,
    variant,
    (metadata->>'timeOnPage')::numeric as time_on_page_seconds,
    created_at
FROM events
WHERE experiment = 'arc-raiders' 
  AND event_type = 'bounce'
ORDER BY created_at DESC;

-- ============================================
-- ENGAGEMENT METRICS
-- ============================================

-- Conversion rates (poll_submit / page_view)
SELECT 
    variant,
    COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) as page_views,
    COUNT(DISTINCT CASE WHEN event_type = 'poll_submit' THEN visitor_id END) as poll_submits,
    COUNT(DISTINCT CASE WHEN event_type = 'cta_click' THEN visitor_id END) as cta_clicks,
    ROUND(
        (COUNT(DISTINCT CASE WHEN event_type = 'poll_submit' THEN visitor_id END)::float /
         NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END), 0)) * 100,
        2
    ) as conversion_rate_percent
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY variant;

-- Visitor journey analysis
SELECT 
    visitor_id,
    variant,
    COUNT(*) as total_events,
    STRING_AGG(event_type, ' -> ' ORDER BY created_at) as event_sequence,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as session_duration_seconds
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY visitor_id, variant
ORDER BY first_event DESC
LIMIT 50;

-- ============================================
-- COMPARATIVE ANALYSIS
-- ============================================

-- Side-by-side comparison of key metrics
SELECT 
    variant,
    COUNT(DISTINCT visitor_id) as unique_visitors,
    COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) as page_views,
    COUNT(DISTINCT CASE WHEN event_type = 'cta_click' THEN visitor_id END) as cta_clicks,
    COUNT(DISTINCT CASE WHEN event_type = 'poll_submit' THEN visitor_id END) as poll_submits,
    COUNT(DISTINCT CASE WHEN event_type = 'bounce' THEN visitor_id END) as bounces,
    AVG(CASE WHEN event_type = 'time_on_page' THEN (metadata->>'seconds')::numeric END) as avg_time_on_page,
    COUNT(DISTINCT CASE WHEN event_type = 'scroll_depth' AND (metadata->>'depth')::integer >= 75 THEN visitor_id END) as users_scrolled_75_percent
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY variant;

-- ============================================
-- RECENT ACTIVITY
-- ============================================

-- Recent events (last hour)
SELECT 
    created_at,
    variant,
    event_type,
    visitor_id,
    metadata
FROM events
WHERE experiment = 'arc-raiders'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Events by hour (for time series analysis)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    variant,
    event_type,
    COUNT(*) as count
FROM events
WHERE experiment = 'arc-raiders'
GROUP BY hour, variant, event_type
ORDER BY hour DESC, variant, event_type;
