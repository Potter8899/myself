-- Potter Personal Space — 002_portfolio.sql
-- รันหลัง 001_base_setup.sql (รันซ้ำได้) ใน Supabase > SQL Editor
-- เพิ่ม: roles 5 ระดับ, ตาราง portfolio/blog/guestbook/contact, storage bucket, RLS
-- ไม่แตะข้อมูล users / tickets / messages เดิม

-- ===== users: role ใหม่ + token_ver (ใช้ "ออกจากระบบทุกเครื่อง") =====
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('user','moderator','admin','owner'));
alter table users add column if not exists token_ver int not null default 0;

-- ===== tickets / messages: เพิ่มคอลัมน์ที่ Bot ใช้ =====
alter table tickets add column if not exists assigned_to text;
alter table messages add column if not exists push_attempts int not null default 0;
create index if not exists messages_unpushed on messages(id) where pushed = false;

-- ===== Portfolio content =====
create table if not exists profiles(
  id int primary key default 1 check (id = 1),
  name text not null default 'Potter',
  tagline jsonb not null default '{"th":"","en":""}',
  intro jsonb not null default '{"th":"","en":""}',
  who jsonb not null default '{"th":"","en":""}',
  story jsonb not null default '{"th":"","en":""}',
  journey jsonb not null default '{"th":"","en":""}',
  goals jsonb not null default '{"th":"","en":""}',
  building jsonb not null default '{"th":"","en":""}',
  learning jsonb not null default '[]',
  interests jsonb not null default '[]',
  photo_url text not null default '',
  contact_email text not null default '',
  socials jsonb not null default '[]',
  updated_at timestamptz not null default now());

create table if not exists skills(
  id bigserial primary key,
  name text unique not null check (length(name) between 1 and 60),
  category text not null check (category in ('programming','development','tools','other')),
  icon text not null default '',
  note jsonb not null default '{"th":"","en":""}',
  sort int not null default 100,
  created_at timestamptz not null default now());

create table if not exists projects(
  id bigserial primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in ('website','application','discord_bot','minecraft','ai','experiment')),
  status text not null default 'wip' check (status in ('live','wip','planned','archived')),
  featured boolean not null default false,
  visible boolean not null default true,
  sort int not null default 100,
  cover_url text not null default '', github_url text not null default '', demo_url text not null default '',
  tags jsonb not null default '[]',
  title jsonb not null, summary jsonb not null default '{"th":"","en":""}', body jsonb not null default '{"th":"","en":""}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists projects_list on projects(visible, featured desc, sort);

create table if not exists project_images(
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  image_url text not null,
  caption jsonb not null default '{"th":"","en":""}',
  sort int not null default 100);
create index if not exists project_images_p on project_images(project_id, sort);

create table if not exists gallery_items(
  id bigserial primary key,
  image_url text not null,
  category text not null check (category in ('personal','projects','screenshots','workspace','models','creative')),
  caption jsonb not null default '{"th":"","en":""}',
  visible boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now());
create index if not exists gallery_list on gallery_items(visible, category, sort);

create table if not exists blog_posts(
  id bigserial primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'draft' check (status in ('draft','published')),
  category text not null default '',
  tags jsonb not null default '[]',
  cover_url text not null default '',
  title jsonb not null, excerpt jsonb not null default '{"th":"","en":""}', body jsonb not null default '{"th":"","en":""}',
  read_min int not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists blog_list on blog_posts(status, published_at desc);

create table if not exists timeline_events(
  id bigserial primary key,
  when_label text not null check (length(when_label) <= 30),
  kind text not null check (kind in ('milestone','project','learning','tech','future')),
  title jsonb not null, body jsonb not null default '{"th":"","en":""}',
  visible boolean not null default true,
  sort int not null default 100);

create table if not exists guestbook_entries(
  id bigserial primary key,
  display_name text not null check (length(display_name) between 1 and 40),
  message text not null check (length(message) between 1 and 500),
  status text not null default 'approved' check (status in ('approved','pending','hidden')),
  reports int not null default 0,
  ip_hash text,
  created_at timestamptz not null default now());
create index if not exists guestbook_list on guestbook_entries(status, id desc);

create table if not exists contact_messages(
  id bigserial primary key,
  name text not null check (length(name) between 1 and 60),
  subject text not null check (length(subject) between 1 and 120),
  message text not null check (length(message) between 1 and 3000),
  email text not null default '',
  status text not null default 'new' check (status in ('new','read')),
  notified boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now());
create index if not exists contact_unnotified on contact_messages(id) where notified = false;

create table if not exists password_resets(
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists password_resets_u on password_resets(user_id, used);

-- ===== RLS: เปิดทุกตาราง ไม่มี policy = anon/authenticated อ่านเขียนไม่ได้ (เฉพาะ service_role ของ Backend/Bot) =====
do $rls$ declare t text; begin
  foreach t in array array['profiles','skills','projects','project_images','gallery_items','blog_posts','timeline_events','guestbook_entries','contact_messages','password_resets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $rls$;

-- ===== Storage bucket (public read, เขียนได้เฉพาะ service_role ผ่าน Backend) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio','portfolio', true, 3145728, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ===== Seed: เฉพาะข้อมูลที่เจ้าของเว็บให้ไว้แล้ว (ไม่แต่งประวัติ/ความสำเร็จเพิ่ม, ไม่มีเปอร์เซ็นต์ทักษะ) =====
insert into profiles(id,name,tagline,intro,who,goals,learning,interests,socials) values (1,'Potter',
 '{"th":"Developer · Minecraft · 3D Modeling","en":"Developer · Minecraft · 3D Modeling"}',
 '{"th":"ผมสร้างเว็บ โปรแกรม และม็อด Minecraft พร้อมโมเดล 3D ด้วย Blockbench","en":"I build websites, programs and Minecraft mods, with 3D models made in Blockbench."}',
 '{"th":"ผมคือ Potter นักพัฒนาที่หลงใหลในเทคโนโลยี ชอบสร้างระบบที่ใช้งานได้จริง ตั้งแต่เว็บไซต์ บอท Discord ไปจนถึงม็อดและปลั๊กอินสำหรับเซิร์ฟเวอร์ Minecraft","en":"I am Potter, a developer who loves technology and building systems that really work — from websites and Discord bots to mods and plugins for Minecraft servers."}',
 '{"th":"","en":""}','[]',
 '["Programming","Python","Web Development","Minecraft Development","Discord Bot Development","3D Modeling","Badminton","Technology"]',
 '[{"label":"GitHub","url":"https://github.com/Potter8899"}]')
on conflict (id) do nothing;

insert into skills(name,category,icon,sort) values
 ('Python','programming','🐍',10),('JavaScript','programming','🟨',20),('HTML','programming','🌐',30),('CSS','programming','🎨',40),('Kotlin','programming','🟣',50),('Java','programming','☕',60),
 ('Frontend','development','🖥️',10),('Backend','development','⚙️',20),('REST API','development','🔌',30),('Database','development','🗄️',40),('Discord Bot','development','🤖',50),
 ('VS Code','tools','🧩',10),('Git','tools','🌿',20),('GitHub','tools','🐙',30),('PowerShell','tools','💠',40),
 ('Minecraft Development','other','⛏️',10),('3D Modeling','other','🧊',20),('UI Design','other','✨',30)
on conflict (name) do nothing;

insert into projects(slug,category,status,featured,sort,tags,title,summary) values
 ('deadzone-server-tools','minecraft','live',true,10,'["Forge","Java","GeckoLib"]',
  '{"th":"DeadZone Server Tools","en":"DeadZone Server Tools"}',
  '{"th":"ม็อดและปลั๊กอินสำหรับเซิร์ฟเวอร์ Minecraft 1.20.1","en":"Mods and plugins for a Minecraft 1.20.1 server."}'),
 ('discord-ticket-bot','discord_bot','live',true,20,'["Python","discord.py","Supabase"]',
  '{"th":"Discord Ticket Bot","en":"Discord Ticket Bot"}',
  '{"th":"ระบบตั๋วสองทางเชื่อมเว็บไซต์แบบเรียลไทม์","en":"A two-way ticket system connected to the website in near real time."}'),
 ('3d-models','minecraft','live',false,30,'["Blockbench","Animation"]',
  '{"th":"3D Models","en":"3D Models"}',
  '{"th":"โมเดลและแอนิเมชันสำหรับ Minecraft","en":"Models and animations for Minecraft."}')
on conflict (slug) do nothing;

-- ===== หลังสมัครบัญชีของคุณบนเว็บแล้ว ให้ตั้งตัวเองเป็น owner (แก้ชื่อผู้ใช้ก่อนรัน) =====
-- update users set role = 'owner' where username = 'YOUR_USERNAME';
