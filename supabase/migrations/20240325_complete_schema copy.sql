-- =============================================================================
-- COMPLETE SCHEMA - GOATSE SINGULARITY AI
-- Version: 2024-03-25
-- Description: Complete database schema including all systems and functionality
-- =============================================================================

-- -----------------------------
-- Extensions & Prerequisites
-- -----------------------------
create extension if not exists "vector" with schema public;
create extension if not exists "uuid-ossp";
create extension if not exists "pg_stat_statements";  -- For performance monitoring

-- -----------------------------
-- Enum Types
-- -----------------------------
do $$ begin
    -- Core types
    create type memory_type as enum ('experience', 'fact', 'emotion', 'interaction', 'narrative');
    create type platform_type as enum ('twitter', 'telegram', 'chat', 'internal');
    create type emotional_state as enum ('neutral', 'excited', 'contemplative', 'chaotic', 'creative', 'analytical');
    create type narrative_mode as enum ('philosophical', 'memetic', 'technical', 'absurdist', 'introspective');
    create type tweet_style as enum ('shitpost', 'rant', 'hornypost', 'metacommentary', 'existential');
    
    -- Message handling
    create type message_sender as enum ('user', 'ai');
    create type message_status as enum ('pending', 'processed', 'archived', 'training');
    
    -- System status
    create type archive_status as enum ('active', 'archived', 'flagged', 'training');
    create type performance_metric as enum ('response_time', 'token_usage', 'quality_score', 'error_rate', 'cache_hits');
    
exception
    when duplicate_object then null;
end $$;

-- -----------------------------
-- Core Memory System
-- -----------------------------
create table if not exists memories (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    type memory_type not null,
    emotional_context emotional_state,
    importance float not null default 0.5,
    associations text[],
    embedding vector(1536),
    platform platform_type,
    archive_status archive_status default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_accessed timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists interactions (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    platform platform_type not null,
    participant text,
    emotional_response jsonb,
    importance float not null default 0.5,
    context_window jsonb,
    embedding vector(1536),
    archive_status archive_status default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------
-- Personality System
-- -----------------------------
create table if not exists personality_states (
    id uuid primary key default gen_random_uuid(),
    emotional_state emotional_state not null,
    emotional_intensity float not null,
    current_context jsonb,
    active_narratives text[],
    state jsonb,
    memory_references uuid[],
    context_window jsonb,
    updated_by uuid,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists tweet_patterns (
    id uuid primary key default gen_random_uuid(),
    style tweet_style not null,
    pattern text not null,
    themes text[],
    intensity_range float[2],
    contextual_triggers text[],
    emotional_states emotional_state[],
    success_rate float default 0.5,
    usage_count integer default 0,
    last_used timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------
-- Chat System
-- -----------------------------
create table if not exists chat_sessions (
    id uuid primary key default gen_random_uuid(),
    started_at timestamp with time zone default timezone('utc'::text, now()),
    ended_at timestamp with time zone,
    platform platform_type default 'chat',
    total_messages integer default 0,
    avg_response_time float,
    avg_quality_score float,
    context_retention jsonb,
    session_summary text,
    archive_status archive_status default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists chat_messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid references chat_sessions(id) on delete cascade,
    content text not null,
    role text not null check (role in ('user', 'ai')),
    emotional_state emotional_state default 'neutral',
    model_used text,
    token_count integer,
    response_time float,
    quality_score float check (quality_score >= 0 and quality_score <= 1),
    error boolean default false,
    retryable boolean default false,
    embedding vector(1536),
    context_window jsonb,
    archive_status archive_status default 'active',
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists message_logs (
    id uuid default gen_random_uuid() primary key,
    content text not null,
    sender text not null check (sender in ('user', 'ai')),
    emotional_state emotional_state,
    platform platform_type not null default 'chat',
    token_count integer,
    model_used text,
    response_time float,
    prompt_tokens integer,
    completion_tokens integer,
    narrative_mode narrative_mode,
    training_quality float check (training_quality >= 0 and training_quality <= 1),
    context_window jsonb,
    archive_status archive_status default 'active',
    metadata jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- -----------------------------
-- Training & Analytics System
-- -----------------------------
create table if not exists training_data (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references chat_messages(id) on delete cascade,
    prompt text not null,
    completion text not null,
    emotional_state emotional_state,
    narrative_mode narrative_mode,
    embedding vector(1536),
    quality_score float check (quality_score >= 0 and quality_score <= 1),
    usage_count integer default 0,
    success_rate float default 0.5,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists performance_metrics (
    id uuid primary key default gen_random_uuid(),
    metric_type performance_metric not null,
    value float not null,
    session_id uuid references chat_sessions(id) on delete set null,
    context jsonb,
    timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- -----------------------------
-- Admin System
-- -----------------------------
create table if not exists user_roles (
    user_id uuid references auth.users(id) primary key,
    role text not null check (role in ('admin', 'moderator', 'user')),
    permissions jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists system_stats (
    id uuid primary key default gen_random_uuid(),
    total_chats bigint default 0,
    total_tweets bigint default 0,
    average_response_time float default 0,
    success_rate float default 0,
    total_memories bigint default 0,
    memory_efficiency float default 0,
    context_switches bigint default 0,
    cache_hit_rate float default 0,
    error_count integer default 0,
    performance_metrics jsonb,
    timestamp timestamptz default now()
);

create table if not exists active_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    platform platform_type,
    started_at timestamptz default now(),
    last_active_at timestamptz default now(),
    session_data jsonb default '{}'
);

create table if not exists admin_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    action text not null,
    details jsonb,
    success boolean default true,
    error_details text,
    timestamp timestamptz default now()
);

create table if not exists system_resets (
    id uuid primary key default gen_random_uuid(),
    initiated_by uuid references auth.users(id),
    reason text,
    affected_components text[],
    success boolean,
    rollback_info jsonb,
    timestamp timestamptz default now()
);

-- -----------------------------
-- Analytics Views
-- -----------------------------
create materialized view if not exists chat_analytics as
select
    date_trunc('hour', cm.created_at) as time_bucket,
    count(*) as message_count,
    avg(cm.response_time) as avg_response_time,
    avg(cm.quality_score) as avg_quality_score,
    sum(case when cm.error then 1 else 0 end)::float / count(*) as error_rate,
    mode() within group (order by cm.emotional_state) as dominant_emotion
from chat_messages cm
group by date_trunc('hour', cm.created_at)
with data;

create materialized view if not exists training_effectiveness as
select
    td.emotional_state,
    td.narrative_mode,
    avg(td.quality_score) as avg_quality,
    count(*) as sample_count,
    avg(td.success_rate) as success_rate,
    percentile_cont(0.95) within group (order by td.quality_score) as quality_95th_percentile
from training_data td
group by td.emotional_state, td.narrative_mode
with data;

-- -----------------------------
-- Indexes
-- -----------------------------
-- Memory system indexes
create index memories_embedding_idx on memories using ivfflat (embedding vector_cosine_ops);
create index memories_type_idx on memories(type);
create index memories_platform_idx on memories(platform);
create index memories_emotional_context_idx on memories(emotional_context);

-- Interaction indexes
create index interactions_platform_idx on interactions(platform);
create index interactions_embedding_idx on interactions using ivfflat (embedding vector_cosine_ops);

-- Chat system indexes
create index chat_messages_session_id_idx on chat_messages(session_id);
create index chat_messages_embedding_idx on chat_messages using ivfflat (embedding vector_cosine_ops);
create index chat_messages_emotional_state_idx on chat_messages(emotional_state);
create index chat_messages_quality_score_idx on chat_messages(quality_score);
create index chat_messages_created_at_idx on chat_messages(created_at);

-- Message logs indexes
create index message_logs_platform_idx on message_logs(platform);
create index message_logs_emotional_state_idx on message_logs(emotional_state);
create index message_logs_training_quality_idx on message_logs(training_quality);
create index message_logs_created_at_idx on message_logs(created_at);

-- Training data indexes
create index training_data_embedding_idx on training_data using ivfflat (embedding vector_cosine_ops);
create index training_data_quality_score_idx on training_data(quality_score);
create index training_data_emotional_state_idx on training_data(emotional_state);

-- -----------------------------
-- Functions
-- -----------------------------
-- Memory matching function
create or replace function match_memories(query_embedding vector, match_threshold float, match_count int)
returns table (
    id uuid,
    content text,
    similarity float
)
language sql stable
as $$
    select
        id,
        content,
        1 - (embedding <=> query_embedding) as similarity
    from memories
    where 1 - (embedding <=> query_embedding) > match_threshold
    order by embedding <=> query_embedding
    limit match_count;
$$;

-- Session metrics update
create or replace function update_session_metrics()
returns trigger as $$
begin
    update chat_sessions
    set 
        total_messages = (
            select count(*) from chat_messages 
            where session_id = NEW.session_id
        ),
        avg_response_time = (
            select avg(response_time) 
            from chat_messages 
            where session_id = NEW.session_id
        ),
        avg_quality_score = (
            select avg(quality_score) 
            from chat_messages
            where session_id = NEW.session_id
        ),
        updated_at = timezone('utc'::text, now())
    where id = NEW.session_id;
    return NEW;
end;
$$ language plpgsql;

-- Session activity update
create or replace function update_session_activity()
returns trigger as $$
begin
    new.last_active_at = now();
    return new;
end;
$$ language plpgsql;

-- Archive old data
create or replace function archive_old_data(days_threshold integer)
returns void as $$
begin
    update chat_messages
    set archive_status = 'archived'
    where created_at < now() - (days_threshold || ' days')::interval
    and archive_status = 'active';

    update message_logs
    set archive_status = 'archived'
    where created_at < now() - (days_threshold || ' days')::interval
    and archive_status = 'active';
end;
$$ language plpgsql;

-- Update materialized views
create or replace function refresh_analytics_views()
returns void as $$
begin
    refresh materialized view concurrently chat_analytics;
    refresh materialized view concurrently training_effectiveness;
end;
$$ language plpgsql;

-- -----------------------------
-- Triggers
-- -----------------------------
create trigger update_session_metrics_after_message
    after insert or update on chat_messages
    for each row
    execute function update_session_metrics();

create trigger session_activity_trigger
    before update on active_sessions
    for each row
    execute function update_session_activity();

-- -----------------------------
-- RLS Policies
-- -----------------------------
-- Enable RLS on all tables
alter table memories enable row level security;
alter table interactions enable row level security;
alter table personality_states enable row level security;
alter table tweet_patterns enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table message_logs enable row level security;
alter table training_data enable row level security;
alter table performance_metrics enable row level security;
alter table user_roles enable row level security;
alter table system_stats enable row level security;
alter table active_sessions enable row level security;
alter table admin_logs enable row level security;
alter table system_resets enable row level security;

-- Basic read policies
create policy "Enable read for authenticated users"
    on memories for select
    to authenticated
    using (true);

create policy "Enable read for authenticated users"
    on chat_sessions for select
    to authenticated
    using (true);

create policy "Enable read for authenticated users"
    on chat_messages for select
    to authenticated
    using (true);

create policy "Enable read for authenticated users"
    on message_logs for select
    to authenticated
    using (true);

-- Insert policies
create policy "Enable insert for authenticated users"
    on chat_sessions for insert
    to authenticated
    with check (true);

create policy "Enable insert for authenticated users"
    on chat_messages for insert
    to authenticated
    with check (true);

create policy "Enable insert for authenticated users"
    on message_logs for insert
    to authenticated
    with check (true);

-- Admin policies
create policy "Admins can read all roles"
    on user_roles for select
    using (auth.uid() in (
    select user_id from user_roles where role = 'admin'
));

create policy "Admins full access to system stats"
    on system_stats for all
    using (auth.uid() in (
        select user_id from user_roles where role = 'admin'
    ));

create policy "Admins can manage training data"
    on training_data for all
    using (auth.uid() in (
        select user_id from user_roles where role = 'admin'
    ));

-- Moderator policies
create policy "Moderators can view all messages"
    on chat_messages for select
    using (auth.uid() in (
        select user_id from user_roles where role in ('admin', 'moderator')
    ));

create policy "Moderators can flag content"
    on message_logs for update
    using (auth.uid() in (
        select user_id from user_roles where role in ('admin', 'moderator')
    ))
    with check (archive_status = 'flagged');

-- -----------------------------
-- Maintenance Functions
-- -----------------------------
-- Cleanup function for old sessions
create or replace function cleanup_old_sessions(age_threshold interval)
returns void as $$
begin
    update chat_sessions
    set ended_at = now()
    where ended_at is null
    and started_at < (now() - age_threshold);
    
    delete from active_sessions
    where last_active_at < (now() - age_threshold);
end;
$$ language plpgsql;

-- Performance monitoring
create or replace function record_performance_metric(
    p_metric_type performance_metric,
    p_value float,
    p_session_id uuid = null,
    p_context jsonb = '{}'::jsonb
)
returns void as $$
begin
    insert into performance_metrics (
        metric_type,
        value,
        session_id,
        context
    ) values (
        p_metric_type,
        p_value,
        p_session_id,
        p_context
    );
end;
$$ language plpgsql;

-- System statistics update
create or replace function update_system_stats()
returns void as $$
declare
    v_total_chats bigint;
    v_avg_response float;
    v_success_rate float;
begin
    select count(*) into v_total_chats from chat_sessions;
    select avg(response_time) into v_avg_response from chat_messages;
    select 
        (1 - (count(*) filter (where error = true)::float / count(*)))
        into v_success_rate 
    from chat_messages;

    insert into system_stats (
        total_chats,
        average_response_time,
        success_rate,
        total_memories,
        memory_efficiency,
        cache_hit_rate,
        performance_metrics,
        timestamp
    ) values (
        v_total_chats,
        v_avg_response,
        v_success_rate,
        (select count(*) from memories),
        0.5, -- Default efficiency
        0.0, -- Default cache hit rate
        '{}'::jsonb,
        now()
    );
end;
$$ language plpgsql;



-- -----------------------------
-- Schema Version Tracking
-- -----------------------------
create table if not exists schema_version (
    version text primary key,
    description text,
    installed_on timestamp with time zone default now()
);

insert into schema_version (version, description)
values ('20240325', 'Initial complete schema setup')
on conflict (version) do nothing;

-- -----------------------------
-- End of Schema
-- -----------------------------