create table if not exists dashboard_config (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete cascade,
  widgets jsonb not null default '{"stats": true, "whatsapp": true, "routes": true, "system": true, "chart": true, "activity": true}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id) -- One config per user
);

-- Insert a default global config if no user-specific is needed right now or for general purpose
insert into dashboard_config (widgets) 
values ('{"stats": true, "whatsapp": true, "routes": true, "system": true, "chart": true, "activity": true}')
on conflict do nothing;
