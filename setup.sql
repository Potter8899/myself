-- Potter Personal Space — setup.sql  (สร้างตารางใหม่ + ย้ายข้อมูลเก่า + ล็อก RLS)
-- รันทั้งไฟล์ครั้งเดียวใน Supabase > SQL Editor  รันซ้ำได้ และถ้าไม่มีตาราง chat_* เดิมจะข้ามส่วนย้ายข้อมูลเอง

-- ===== ส่วนที่ 1: ตารางใหม่ + RLS =====
create table if not exists users(
  id bigserial primary key,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  email text not null check (length(email) <= 254),
  pass_hash text not null,
  role text not null default 'user' check (role in ('user','admin')),
  notified boolean not null default false,
  created_at timestamptz not null default now());
create table if not exists tickets(
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','claimed','closed')),
  channel_id text, claimed_by text,
  created_at timestamptz not null default now(), closed_at timestamptz);
create unique index if not exists one_active_ticket on tickets(user_id) where status <> 'closed';
create table if not exists messages(
  id bigserial primary key,
  ticket_id bigint not null references tickets(id) on delete cascade,
  sender text not null check (sender in ('web','admin','system')),
  author text not null,
  body text not null check (length(body) between 1 and 1500),
  pushed boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists messages_ticket on messages(ticket_id, id);
create table if not exists used_captcha(token_hash text primary key, used_at timestamptz not null default now());
create table if not exists activity_logs(
  id bigserial primary key, kind text not null, detail text, ip_hash text,
  notified boolean not null default false, created_at timestamptz not null default now());
create table if not exists settings(key text primary key, value text);
alter table tickets add column if not exists legacy_session text unique;

-- RLS: เปิดและไม่สร้าง policy = anon/authenticated อ่านเขียนไม่ได้เลย
-- มีเพียง service_role (Backend + Bot) เท่านั้นที่เข้าถึง และ Frontend ไม่เคยคุยกับ Supabase ตรง
alter table users enable row level security;
alter table tickets enable row level security;
alter table messages enable row level security;
alter table used_captcha enable row level security;
alter table activity_logs enable row level security;
alter table settings enable row level security;
revoke all on users,tickets,messages,used_captcha,activity_logs,settings from anon, authenticated;


-- ===== ส่วนที่ 2: ย้ายข้อมูลจากระบบเดิม (chat_accounts / chat_tickets / chat_messages) + ล็อกตารางเก่า =====
-- username ที่ไม่ตรงรูปแบบ A-Za-z0-9_ 3-20 ตัวจะถูกข้าม (แจ้งจำนวนใน Messages)
do $mig$
declare skipped int; p record; tbl text;
begin
  if to_regclass('public.chat_accounts') is null then raise notice 'ไม่มีตารางเดิม ข้ามการย้ายข้อมูล'; return; end if;

  -- 1) บัญชี (username ที่ไม่ตรงรูปแบบ A-Za-z0-9_ 3-20 ตัว จะถูกข้าม ดูรายชื่อที่ถูกข้ามด้วย query ท้ายไฟล์)
  insert into public.users(username,email,pass_hash,notified,created_at)
  select username,email,'legacy:'||password,true,created_at from public.chat_accounts
  where username ~ '^[A-Za-z0-9_]{3,20}$' on conflict (username) do nothing;

  -- 2) ตั๋ว: เก็บเปิดไว้เฉพาะใบล่าสุดของแต่ละผู้ใช้ ที่เหลือเป็นปิด
  with t as (select c.*, row_number() over (partition by username order by created_at desc) rn from public.chat_tickets c)
  insert into public.tickets(user_id,status,channel_id,created_at,closed_at,legacy_session)
  select u.id, case when t.status='open' and t.rn=1 then 'open' else 'closed' end, t.discord_channel_id, t.created_at,
         case when t.status='open' and t.rn=1 then null else coalesce(t.closed_at, now()) end, t.session_id
  from t join public.users u on u.username=t.username
  on conflict (legacy_session) do nothing;

  -- 3) ข้อความ (ย้ายครั้งเดียว: ข้ามถ้าตั๋วนั้นมีข้อความแล้ว)
  insert into public.messages(ticket_id,sender,author,body,pushed,created_at)
  select tk.id, case m.sender_role when 'user' then 'web' else m.sender_role end, m.sender_name, left(m.content,1500), true, m.created_at
  from public.chat_messages m join public.tickets tk on tk.legacy_session=m.session_id
  where length(trim(m.content))>0 and not exists (select 1 from public.messages x where x.ticket_id=tk.id)
  order by m.created_at;

  -- 4) ล็อกตารางเก่า: ลบ policy ที่เปิดทุกอย่าง + ถอนสิทธิ์ anon/authenticated + เลิก realtime
  foreach tbl in array array['chat_accounts','chat_tickets','chat_messages'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=tbl loop
      execute format('drop policy %I on public.%I', p.policyname, tbl);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
      execute format('alter publication supabase_realtime drop table public.%I', tbl);
    end if;
  end loop;
  select count(*) into skipped from public.chat_accounts where username !~ '^[A-Za-z0-9_]{3,20}$';
  raise notice 'ย้ายเสร็จ บัญชีที่ถูกข้าม: %', skipped;
end $mig$;

-- ===== ส่วนที่ 3: ตารางแจกโค้ด (Discord) =====
create table if not exists code_snippets(
  id bigserial primary key,
  title text unique not null check (length(title) between 1 and 50),
  language text not null default 'text',
  description text not null default '',
  content text not null check (length(content) <= 200000),
  downloads int not null default 0,
  created_by text, created_at timestamptz not null default now());
alter table code_snippets enable row level security;
revoke all on code_snippets from anon, authenticated;
