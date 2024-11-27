-- Create token configuration table
create table if not exists token_config (
    id uuid primary key default gen_random_uuid(),
    token_address text not null,
    min_token_amount numeric not null,
    min_token_value_usd numeric not null,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create user access table
create table if not exists user_access (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    wallet_address text not null,
    token_balance numeric,
    has_access boolean default false,
    last_checked timestamptz default now(),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Insert initial token configuration
insert into token_config (token_address, min_token_amount, min_token_value_usd)
values ('9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump', 0, 20);

-- Add RLS policies
alter table token_config enable row level security;
alter table user_access enable row level security;

-- Only allow authenticated users to read token config
create policy "Enable read access for authenticated users"
    on token_config for select
    to authenticated
    using (true);

-- Only allow admins to update token config
create policy "Enable update for admins"
    on token_config for update
    using (auth.uid() in (
        select user_id from user_roles where role = 'admin'
    ));

-- Users can only see their own access records
create policy "Users can view own access"
    on user_access for select
    using (auth.uid() = user_id);
