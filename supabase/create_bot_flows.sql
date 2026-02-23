
-- Create table for Visual Bot Builder
create table if not exists bot_flows (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  trigger_keyword text,
  nodes jsonb default '[]'::jsonb,
  edges jsonb default '[]'::jsonb,
  is_active boolean default false
);

-- Add RLS policies (optional, but good practice)
alter table bot_flows enable row level security;

create policy "Enable read access for all users" on bot_flows
  for select using (true);

create policy "Enable insert for all users" on bot_flows
  for insert with check (true);

create policy "Enable update for all users" on bot_flows
  for update using (true);
