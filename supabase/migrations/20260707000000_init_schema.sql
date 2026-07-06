-- Cadence initial schema: preferences, tasks, plan_items.
-- Every table is per-user with Row-Level Security (auth.uid() = user_id) and
-- explicit grants to the authenticated role (auto-expose is off by design).

-- ── preferences: one row per user, their planning defaults ──
create table if not exists public.preferences (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  work_start      time        not null default '09:00',
  work_end        time        not null default '18:00',
  focus_windows   jsonb       not null default '[]'::jsonb,
  blocked_windows jsonb       not null default '[]'::jsonb,
  buffer_minutes  int         not null default 5,
  updated_at      timestamptz not null default now()
);

-- ── tasks ──
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  title             text        not null,
  estimated_minutes int         not null check (estimated_minutes > 0),
  priority          text        not null default 'med' check (priority in ('low', 'med', 'high')),
  deadline          timestamptz,
  type              text,
  status            text        not null default 'todo' check (status in ('todo', 'scheduled', 'done')),
  created_at        timestamptz not null default now()
);
create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- ── plan_items: the scheduler's output for a given day ──
create table if not exists public.plan_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  task_id    uuid        not null references public.tasks (id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  day        date        not null,
  created_at timestamptz not null default now()
);
create index if not exists plan_items_user_day_idx on public.plan_items (user_id, day);

-- ── Row-Level Security: each user sees only their own rows ──
alter table public.preferences enable row level security;
alter table public.tasks       enable row level security;
alter table public.plan_items  enable row level security;

create policy "own preferences" on public.preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plan_items" on public.plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Explicit grants to the API's authenticated role (anon gets nothing) ──
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.preferences to authenticated;
grant select, insert, update, delete on public.tasks       to authenticated;
grant select, insert, update, delete on public.plan_items  to authenticated;
