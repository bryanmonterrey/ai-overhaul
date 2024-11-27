-- Add system_state table
create table if not exists system_state (
    id uuid primary key default gen_random_uuid(),
    emotional_state emotional_state default 'neutral',
    narrative_mode narrative_mode default 'technical',
    memory_usage integer default 0,
    runtime_seconds integer default 0,
    last_update timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index for faster lookups
create index if not exists system_state_last_update_idx on system_state(last_update);

-- Add RLS policy
alter table system_state enable row level security;

create policy "Enable read access for authenticated users"
    on system_state for select
    to authenticated
    using (true);

create policy "Enable insert/update for authenticated users"
    on system_state for insert
    to authenticated
    with check (true);

create policy "Enable update for authenticated users"
    on system_state for update
    to authenticated
    using (true);