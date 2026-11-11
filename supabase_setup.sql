-- ========================================================
-- Potter Portfolio: Supabase Database Setup & Schema
-- Complete Discord Bot & Ticket System Integration
-- Run this SQL in your Supabase Project -> SQL Editor
-- ========================================================

-- 1. Create table for user accounts (with unique username, email & password hash)
create table if not exists public.chat_accounts (
    id uuid default gen_random_uuid() primary key,
    username text not null unique,
    email text not null,
    password text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_login timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create table for tickets (synced with Discord channels)
create table if not exists public.chat_tickets (
    id uuid default gen_random_uuid() primary key,
    session_id text not null unique,
    username text not null,
    email text not null,
    discord_channel_id text,
    status text not null default 'open' check (status in ('open', 'closed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    closed_at timestamp with time zone
);

-- 3. Create table for ticket messages
create table if not exists public.chat_messages (
    id uuid default gen_random_uuid() primary key,
    session_id text not null,
    sender_name text not null,
    sender_role text not null check (sender_role in ('user', 'admin', 'system')),
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Indexes for high performance
create index if not exists idx_chat_messages_session on public.chat_messages (session_id, created_at asc);
create index if not exists idx_chat_tickets_session on public.chat_tickets (session_id);
create index if not exists idx_chat_tickets_channel on public.chat_tickets (discord_channel_id);
create index if not exists idx_chat_accounts_username on public.chat_accounts (username);

-- 5. Enable Row Level Security (RLS)
alter table public.chat_accounts enable row level security;
alter table public.chat_tickets enable row level security;
alter table public.chat_messages enable row level security;

-- 6. Policies for public / anonymous client access
create policy "Allow all read messages"
on public.chat_messages for select using (true);

create policy "Allow all insert messages"
on public.chat_messages for insert with check (true);

create policy "Allow all read tickets"
on public.chat_tickets for select using (true);

create policy "Allow all insert tickets"
on public.chat_tickets for insert with check (true);

create policy "Allow all update tickets"
on public.chat_tickets for update using (true);

create policy "Allow all read accounts"
on public.chat_accounts for select using (true);

create policy "Allow all insert accounts"
on public.chat_accounts for insert with check (true);

-- 7. Enable Realtime on tables for live two-way chat sync
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_tickets;
