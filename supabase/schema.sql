-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clients Table
create table clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products Table
create table products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price decimal(10, 2) not null default 0,
  stock integer not null default 0,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Movements Table (Debts and Payments)
create type movement_type as enum ('DEBT', 'PAYMENT');

create table movements (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete cascade not null,
  type movement_type not null,
  amount decimal(10, 2) not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index idx_movements_client_id on movements(client_id);

-- Enums for Orders
create type order_channel as enum ('WEB', 'WHATSAPP', 'PHONE', 'OTHER');
create type order_status as enum ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- Orders Table
create table orders (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete restrict, -- Don't delete client if they have orders
  channel order_channel not null default 'WEB',
  status order_status not null default 'PENDING',
  total_amount decimal(10, 2) not null default 0,
  delivery_date date,
  time_slot text, -- e.g., "09:00 - 12:00"
  notes text,
  original_text text, -- Original WhatsApp message text if imported
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Order Items Table
create table order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  product_id uuid references products(id) on delete restrict not null,
  quantity integer not null check (quantity > 0),
  unit_price decimal(10, 2) not null, -- Snapshot of price at time of order
  subtotal decimal(10, 2) generated always as (quantity * unit_price) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Routes Table
create type route_status as enum ('DRAFT', 'ACTIVE', 'COMPLETED');

create table routes (
  id uuid default uuid_generate_v4() primary key,
  name text not null, -- e.g., "Ruta Norte - 10/02"
  date date not null,
  status route_status not null default 'DRAFT',
  driver_name text,
  vehicle_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Route Orders (Linking Orders to Routes)
create table route_orders (
  id uuid default uuid_generate_v4() primary key,
  route_id uuid references routes(id) on delete cascade not null,
  order_id uuid references orders(id) on delete restrict not null,
  sequence_number integer not null, -- For ordering delivery stops
  estimated_arrival time,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(route_id, order_id)
);

-- Indexes for new tables
create index idx_orders_client_id on orders(client_id);
create index idx_orders_status on orders(status);
create index idx_orders_date on orders(delivery_date);
create index idx_order_items_order_id on order_items(order_id);
create index idx_route_orders_route_id on route_orders(route_id);

-- ===========================================
-- WhatsApp Integration Tables
-- ===========================================

-- WhatsApp Session (connection to Evolution API)
create table whatsapp_sessions (
  id uuid default uuid_generate_v4() primary key,
  instance_name text not null unique,
  status text not null default 'disconnected', -- disconnected, connecting, connected
  phone_number text,
  qr_code text, -- base64 QR for pairing
  api_url text, -- Evolution API base URL
  api_key text, -- Evolution API key
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- WhatsApp Conversations (one per contact)
create table whatsapp_conversations (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete set null,
  phone text not null unique,
  contact_name text,
  last_message text,
  last_message_at timestamp with time zone,
  unread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- WhatsApp Messages
create type wa_message_direction as enum ('INBOUND', 'OUTBOUND');

create table whatsapp_messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references whatsapp_conversations(id) on delete cascade not null,
  direction wa_message_direction not null,
  content text,
  media_url text,
  message_type text default 'text', -- text, image, audio, document
  wa_message_id text, -- External WhatsApp message ID
  is_read boolean default false,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- WhatsApp Indexes
create index idx_wa_conversations_client on whatsapp_conversations(client_id);
create index idx_wa_conversations_phone on whatsapp_conversations(phone);
create index idx_wa_messages_conversation on whatsapp_messages(conversation_id);
create index idx_wa_messages_timestamp on whatsapp_messages(timestamp);

-- Enable Realtime for WhatsApp tables
alter publication supabase_realtime add table whatsapp_messages;
alter publication supabase_realtime add table whatsapp_conversations;

-- WhatsApp Config (welcome messages, etc.)
create table whatsapp_config (
  id bigint primary key generated always as identity,
  welcome_message text default '¡Hola {nombre}! 👋 Gracias por escribirnos. ¿En qué podemos ayudarte hoy?',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Insert default config
insert into whatsapp_config (welcome_message, is_active)
values ('¡Hola {nombre}! 👋 Gracias por escribirnos. ¿En qué podemos ayudarte hoy?', false);

-- ─── PHASE 10: CATEGORIES & STOCK ───

-- Add category to products if not exists
alter table products add column category text default 'General';

-- ─── PHASE 11 & 12: LOGISTICS ───

-- Delivery Time Slots (Franjas Horarias)
create table delivery_slots (
  id bigint primary key generated always as identity,
  label text not null, -- e.g. "Mañana (9 - 13hs)"
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Shipping Zones (Zonas de Envío)
create table shipping_zones (
  id bigint primary key generated always as identity,
  name text not null, -- e.g. "Zona Centro"
  cost numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Update Orders to support logistics
alter table orders add column shipping_zone_id bigint references shipping_zones(id);
alter table orders add column shipping_cost numeric default 0;
alter table orders add column delivery_slot_id bigint references delivery_slots(id);
alter table orders add column is_assembled boolean default false; -- Para estado "Armado"

-- Phase 14: Bot State Machine
CREATE TABLE chat_sessions (
  phone TEXT PRIMARY KEY,
  step TEXT DEFAULT 'START',
  temp_data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data for Logistics
insert into delivery_slots (label) values
('Mañana (09:00 - 13:00)'),
('Tarde (16:00 - 20:00)');

insert into shipping_zones (name, cost) values 
('Radio 1 (Cerca)', 500),
('Radio 2 (Lejos)', 1000);

