-- Anchor AI: target relational schema (PostgreSQL / Supabase). Phase 1 runs on the in-memory repository;
-- this file is the normalized design the Postgres repository will implement. Not executed by the app yet.
create extension if not exists pgcrypto;
create type app_role as enum ('admin','manager','viewer');
create type sku_status as enum ('active','inactive','stranded');
create type task_status as enum ('open','in_progress','done','dismissed');
create type po_status as enum ('draft','ordered','in_transit','partially_received','received','cancelled');

create table teams (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table users (
  id uuid primary key,                         -- = auth.users.id (Supabase)
  team_id uuid references teams(id),
  email text unique, display_name text not null,
  role app_role not null default 'manager',
  last_active_at timestamptz, created_at timestamptz not null default now());
create table warehouses (id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id), code text not null, name text, marketplace text not null default 'US', unique (team_id, code));
create table suppliers (id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id), name text not null, lead_time_days int not null default 21 check (lead_time_days >= 0), contact_email text, unique (team_id, name));
create table products (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id),
  sku text not null, asin text not null check (asin ~ '^[A-Z0-9]{10}$'), name text not null, category text not null,
  supplier_id uuid references suppliers(id), unit_cost numeric(12,2) not null check (unit_cost >= 0), price numeric(12,2) not null check (price > 0),
  lead_time_days int not null check (lead_time_days >= 0), safety_stock int not null default 0 check (safety_stock >= 0), reorder_point int not null default 0,
  status sku_status not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (team_id, sku));
create table inventory (                        -- mirrors FBA Inventory API buckets
  product_id uuid not null references products(id) on delete cascade, warehouse_id uuid not null references warehouses(id),
  fulfillable int not null default 0 check (fulfillable >= 0), inbound int not null default 0 check (inbound >= 0),
  reserved int not null default 0 check (reserved >= 0), unfulfillable int not null default 0 check (unfulfillable >= 0),
  researching int not null default 0 check (researching >= 0), source text not null default 'demo' check (source in ('demo','spapi','manual')),
  updated_at timestamptz not null default now(), primary key (product_id, warehouse_id));
create table sales_history (product_id uuid not null references products(id) on delete cascade, day date not null, units int not null check (units >= 0), revenue numeric(12,2), primary key (product_id, day));
create table forecasts (id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id) on delete cascade, horizon_days int not null check (horizon_days in (7,30,60)), generated_at timestamptz not null default now(), units numeric(12,2) not null, adjusted_units numeric(12,2), confidence numeric(4,3), assumptions jsonb not null default '{}');
create table purchase_orders (id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id), supplier_id uuid not null references suppliers(id), status po_status not null default 'draft', ordered_at date, expected_at date, created_by uuid references users(id));
create table purchase_order_lines (id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references purchase_orders(id) on delete cascade, product_id uuid not null references products(id), ordered_qty int not null check (ordered_qty > 0), received_qty int not null default 0 check (received_qty >= 0));
create table tasks (id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id), product_id uuid references products(id), title text not null, description text, priority text not null default 'medium', status task_status not null default 'open', assignee_id uuid references users(id), due_date date, ai_recommendation text, completion_notes text, created_at timestamptz not null default now());
create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, product_id uuid references products(id), kind text not null, message text not null, read_at timestamptz, created_at timestamptz not null default now());
create table audit_logs (id uuid primary key default gen_random_uuid(), team_id uuid references teams(id), user_id uuid references users(id), action text not null, entity_type text not null, entity_id text, summary text, created_at timestamptz not null default now());

create index on products (team_id, category); create index on sales_history (product_id, day desc);
create index on tasks (team_id, status, due_date); create index on audit_logs (team_id, created_at desc);
-- Row-level security: every table is team-scoped; example for products (repeat per table).
alter table products enable row level security;
create policy products_team on products using (team_id = (select team_id from users where id = auth.uid()));
