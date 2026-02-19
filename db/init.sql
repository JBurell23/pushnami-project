-- Create ab_config table for storing experiment configuration
CREATE TABLE IF NOT EXISTS ab_config (
    experiment VARCHAR(255) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create events table for storing metrics
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL,
    experiment VARCHAR(255) NOT NULL,
    variant VARCHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
    event_type VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_events_experiment_variant ON events(experiment, variant);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON events(visitor_id);

-- Insert default config for arc-raiders experiment
INSERT INTO ab_config (experiment, enabled, toggles)
VALUES ('arc-raiders', true, '{"showTrailerSection": true, "ctaTargetUrl": "https://arcraiders.com", "showPollSection": true, "showFavoriteGunSection": true, "showTierRankingSection": true, "useVariantSpecificCta": true, "enablePollBasedReassignment": true}'::jsonb)
ON CONFLICT (experiment) DO NOTHING;
