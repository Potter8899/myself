-- ========================================================
-- Potter Portfolio: Supabase Database Setup & Schema
-- Run this SQL in your Supabase Project -> SQL Editor
-- ========================================================

-- 1. Create table for registered chat users and sessions
create table if not exists public.chat_users (
    id uuid default gen_random_uuid() primary key,
    username text not null unique,
    session_id text not null unique,
    language text default 'th',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_active timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create table for inquiry messages
create table if not exists public.chat_messages (
    id uuid default gen_random_uuid() primary key,
    session_id text not null,
    sender_name text not null,
    sender_role text not null check (sender_role in ('user', 'admin')),
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Indexes for ultra-fast queries
create index if not exists idx_chat_messages_session on public.chat_messages (session_id, created_at asc);
create index if not exists idx_chat_users_username on public.chat_users (username);
create index if not exists idx_chat_users_session on public.chat_users (session_id);

-- 4. Enable Row Level Security (RLS)
alter table public.chat_users enable row level security;
alter table public.chat_messages enable row level security;

-- 5. Policies for public / anonymous client access
-- Allow anyone to read messages
create policy "Allow read messages"
on public.chat_messages for select
using (true);

-- Allow anyone to insert messages
create policy "Allow insert messages"
on public.chat_messages for insert
with check (true);

-- Allow deletion of messages
create policy "Allow delete messages"
on public.chat_messages for delete
using (true);

-- Allow reading chat users
create policy "Allow read chat_users"
on public.chat_users for select
using (true);

-- Allow inserting or updating chat users
create policy "Allow insert or update chat_users"
on public.chat_users for all
using (true);

-- 6. Enable Realtime on tables for live two-way chat
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_users;
