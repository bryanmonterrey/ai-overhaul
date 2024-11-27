-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create telegram_chats table
CREATE TABLE IF NOT EXISTS telegram_chats (
    chat_id TEXT PRIMARY KEY,
    active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
    message_count INTEGER DEFAULT 0,
    context JSONB[] DEFAULT ARRAY[]::JSONB[],
    settings JSONB DEFAULT '{
        "notificationsEnabled": true,
        "language": "en",
        "timezone": "UTC",
        "personalityMode": "friendly",
        "autoRespond": true
    }'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create telegram_messages table
CREATE TABLE IF NOT EXISTS telegram_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id TEXT REFERENCES telegram_chats(chat_id),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    response_id UUID
);

-- Create twitter_interactions table
CREATE TABLE IF NOT EXISTS twitter_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('tweet', 'reply', 'retweet', 'like', 'mention')),
    content TEXT,
    author_id TEXT,
    author_username TEXT,
    metrics JSONB DEFAULT '{}'::JSONB,
    context JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    response_id UUID
);

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create analytics_metrics table
CREATE TABLE IF NOT EXISTS analytics_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create functions and triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_telegram_chats_updated_at
    BEFORE UPDATE ON telegram_chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON telegram_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_timestamp ON telegram_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_twitter_interactions_tweet_id ON twitter_interactions(tweet_id);
CREATE INDEX IF NOT EXISTS idx_twitter_interactions_type ON twitter_interactions(type);
CREATE INDEX IF NOT EXISTS idx_twitter_interactions_author_id ON twitter_interactions(author_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_service_type ON analytics_metrics(service, metric_type);

-- Add RLS policies
ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
    ON telegram_chats FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users"
    ON telegram_messages FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users"
    ON twitter_interactions FOR SELECT
    USING (auth.role() = 'authenticated');

-- Create functions for analytics
CREATE OR REPLACE FUNCTION get_chat_metrics(
    p_chat_id TEXT,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    message_count BIGINT,
    avg_response_time NUMERIC,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as message_count,
        AVG(EXTRACT(EPOCH FROM (
            SELECT MIN(timestamp)
            FROM telegram_messages rm
            WHERE rm.response_id = m.id
        ) - m.timestamp))::NUMERIC as avg_response_time,
        (COUNT(CASE WHEN processed AND processing_error IS NULL THEN 1 END)::NUMERIC / 
         COUNT(*)::NUMERIC * 100)::NUMERIC as success_rate
    FROM telegram_messages m
    WHERE m.chat_id = p_chat_id
    AND m.timestamp BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;