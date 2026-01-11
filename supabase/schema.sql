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
