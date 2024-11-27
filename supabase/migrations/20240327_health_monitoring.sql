-- Continue from previous migration

END;
$$ LANGUAGE plpgsql;

-- Trigger for status changes
CREATE TRIGGER calculate_uptime_on_status_change
    AFTER UPDATE ON service_status
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION calculate_service_uptime();

-- Function to aggregate health metrics
CREATE OR REPLACE FUNCTION get_service_health_metrics(
    p_service TEXT,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    avg_latency NUMERIC,
    error_rate NUMERIC,
    uptime_percentage NUMERIC,
    total_incidents INTEGER,
    avg_resolution_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH health_metrics AS (
        SELECT
            AVG(latency)::NUMERIC as avg_latency,
            (COUNT(*) FILTER (WHERE status = 'down')::NUMERIC / COUNT(*)::NUMERIC * 100) as error_rate,
            COUNT(*) FILTER (WHERE status = 'down') as incident_count
        FROM health_checks
        WHERE service = p_service
        AND timestamp BETWEEN p_start_time AND p_end_time
    ),
    incident_metrics AS (
        SELECT
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::NUMERIC as avg_resolution_minutes
        FROM service_errors
        WHERE service = p_service
        AND created_at BETWEEN p_start_time AND p_end_time
        AND resolved = true
    ),
    uptime_calc AS (
        SELECT
            (EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60) as total_minutes,
            SUM(CASE 
                WHEN status != 'down' THEN 
                    EXTRACT(EPOCH FROM (LEAST(updated_at, p_end_time) - GREATEST(created_at, p_start_time))) / 60
                ELSE 0
            END) as uptime_minutes
        FROM service_status
        WHERE service = p_service
        AND created_at <= p_end_time
        AND (updated_at >= p_start_time OR updated_at IS NULL)
    )
    SELECT
        hm.avg_latency,
        hm.error_rate,
        CASE 
            WHEN uc.total_minutes > 0 THEN
                (uc.uptime_minutes / uc.total_minutes * 100)::NUMERIC
            ELSE
                0
        END as uptime_percentage,
        hm.incident_count,
        COALESCE(im.avg_resolution_minutes, 0) as avg_resolution_time
    FROM health_metrics hm
    CROSS JOIN uptime_calc uc
    LEFT JOIN incident_metrics im ON true;
END;
$$ LANGUAGE plpgsql;

-- Create view for service health summary
CREATE OR REPLACE VIEW service_health_summary AS
WITH recent_checks AS (
    SELECT DISTINCT ON (service)
        service,
        status,
        latency,
        metrics,
        timestamp
    FROM health_checks
    ORDER BY service, timestamp DESC
),
recent_errors AS (
    SELECT
        service,
        COUNT(*) as error_count,
        MAX(created_at) as last_error
    FROM service_errors
    WHERE created_at > now() - interval '24 hours'
    GROUP BY service
)
SELECT
    rc.service,
    rc.status as current_status,
    rc.latency as current_latency,
    rc.metrics as current_metrics,
    ss.uptime_minutes,
    ss.active_connections,
    ss.last_started_at,
    COALESCE(re.error_count, 0) as errors_24h,
    re.last_error as last_error_time
FROM recent_checks rc
LEFT JOIN service_status ss ON rc.service = ss.service
LEFT JOIN recent_errors re ON rc.service = re.service;

-- Function to mark error as resolved
CREATE OR REPLACE FUNCTION resolve_service_error(
    p_error_id UUID,
    p_resolution_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE service_errors
    SET 
        resolved = true,
        resolved_at = now(),
        metadata = metadata || jsonb_build_object('resolution_notes', p_resolution_notes)
    WHERE id = p_error_id
    AND resolved = false;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;