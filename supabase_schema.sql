-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Trades Table
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  instrument text not null,
  direction text not null check (direction in ('Long', 'Short')),
  time bigint not null,
  end_time bigint not null,
  pnl numeric not null default 0,
  equity_curve numeric not null default 0,
  setup text,

  -- JSONB columns for structured data
  executions jsonb default '[]'::jsonb,
  annotations jsonb default '[]'::jsonb,
  notes jsonb default '{"entry": "", "exit": "", "mgmt": "", "general": ""}'::jsonb,

  -- Array columns for tags
  mistakes text[] default array[]::text[],
  successes text[] default array[]::text[],
  mindsets text[] default array[]::text[],

  chart_image_path text, -- Path to storage bucket

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table public.trades enable row level security;

-- 3. Create RLS Policies
create policy "Users can view their own trades"
on public.trades for select
using (auth.uid() = user_id);

create policy "Users can insert their own trades"
on public.trades for insert
with check (auth.uid() = user_id);

create policy "Users can update their own trades"
on public.trades for update
using (auth.uid() = user_id);

create policy "Users can delete their own trades"
on public.trades for delete
using (auth.uid() = user_id);

-- 4. Create Storage Bucket for Charts
insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', true)
on conflict (id) do nothing;

-- 5. Storage Policies
create policy "Give users access to own folder"
on storage.objects for all
using ( bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1] )
with check ( bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Public Read Access"
on storage.objects for select
using ( bucket_id = 'trade-images' );
