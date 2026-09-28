create extension if not exists pgcrypto;

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_managers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  primary key(task_id, manager_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.managers enable row level security;
alter table public.tasks enable row level security;
alter table public.task_managers enable row level security;

create policy "signed in managers read" on public.managers for select to authenticated using (true);
create policy "signed in managers write" on public.managers for all to authenticated using (true) with check (true);
create policy "signed in tasks read" on public.tasks for select to authenticated using (true);
create policy "signed in tasks write" on public.tasks for all to authenticated using (true) with check (true);
create policy "signed in assignments read" on public.task_managers for select to authenticated using (true);
create policy "signed in assignments write" on public.task_managers for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.managers;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_managers;
