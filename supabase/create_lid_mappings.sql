-- Table to map WhatsApp LIDs (Linked Device IDs) to Real Phone Numbers
create table if not exists public.lid_mappings (
  lid text primary key,
  phone text not null,
  created_at timestamptz default now()
);

-- RLS (Optional for now, but good practice)
alter table public.lid_mappings enable row level security;
create policy "Allow all access for bot" on public.lid_mappings for all using (true);
